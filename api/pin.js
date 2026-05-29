const crypto = require("crypto");

const SUPABASE_TABLE = "training_records";

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  };
}

function supabaseHeaders() {
  const { key } = getSupabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

async function supabaseFetch(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return { ok: false, status: 503, json: async () => ({}), text: async () => "" };
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) }
  });
}

function verifyAdminToken(req) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS;
  const token = req.headers["x-admin-token"];
  if (!secret || !token || !token.includes(".")) return false;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const safeSig = Buffer.from(sig);
  const safeExp = Buffer.from(expected);
  if (safeSig.length !== safeExp.length || !crypto.timingSafeEqual(safeSig, safeExp)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && payload.exp > Date.now();
  } catch { return false; }
}

// 用 scrypt 雜湊 PIN（輸出固定長度的 hex 字串）
function hashPin(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, 32, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
}

function makeSalt() {
  return crypto.randomBytes(16).toString("hex");
}

// 儲存格式："salt:hash"
async function makeHash(pin) {
  const salt = makeSalt();
  const hash = await hashPin(pin, salt);
  return `${salt}:${hash}`;
}

async function verifyPin(pin, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = await hashPin(pin, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

module.exports = async function handler(req, res) {
  const body = readBody(req);

  // ── 查詢是否已設定 PIN ──────────────────────────────────────
  if (req.method === "GET" && req.query.empId) {
    const empId = encodeURIComponent(req.query.empId);
    const result = await supabaseFetch(`${SUPABASE_TABLE}?emp_id=eq.${empId}&select=pin_hash`);
    if (!result.ok) return res.status(500).json({ ok: false });
    const data = await result.json();
    if (!data.length) return res.status(404).json({ ok: false, message: "找不到此工號" });
    return res.status(200).json({ hasPin: !!data[0].pin_hash });
  }

  // ── 驗證 PIN ────────────────────────────────────────────────
  if (req.method === "POST" && req.query.action === "verify") {
    const { empId, pin } = body;
    if (!empId || !pin) return res.status(400).json({ ok: false, message: "缺少參數" });
    const result = await supabaseFetch(`${SUPABASE_TABLE}?emp_id=eq.${encodeURIComponent(empId)}&select=pin_hash`);
    if (!result.ok) return res.status(500).json({ ok: false });
    const data = await result.json();
    if (!data.length) return res.status(404).json({ ok: false, message: "找不到此工號" });
    const ok = await verifyPin(String(pin), data[0].pin_hash);
    return res.status(200).json({ ok });
  }

  // ── 設定 PIN（新用戶，尚未有 PIN） ──────────────────────────
  if (req.method === "POST" && req.query.action === "set") {
    const { empId, pin } = body;
    if (!empId || !pin || String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ ok: false, message: "PIN 必須是 4 位數字" });
    }
    // 確認此工號存在且尚未設定 PIN
    const check = await supabaseFetch(`${SUPABASE_TABLE}?emp_id=eq.${encodeURIComponent(empId)}&select=pin_hash`);
    const data = await check.json();
    if (!data.length) return res.status(404).json({ ok: false, message: "找不到此工號，請先填寫姓名報到" });
    if (data[0].pin_hash) return res.status(409).json({ ok: false, message: "此工號已設定過 PIN" });

    const pin_hash = await makeHash(String(pin));
    const result = await supabaseFetch(
      `${SUPABASE_TABLE}?emp_id=eq.${encodeURIComponent(empId)}`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ pin_hash }) }
    );
    if (!result.ok) return res.status(500).json({ ok: false });
    return res.status(200).json({ ok: true });
  }

  // ── 管理員重設 PIN ──────────────────────────────────────────
  if (req.method === "POST" && req.query.action === "reset") {
    if (!verifyAdminToken(req)) return res.status(401).json({ ok: false, message: "需要管理員權限" });
    const { empId } = body;
    if (!empId) return res.status(400).json({ ok: false, message: "缺少 empId" });
    const result = await supabaseFetch(
      `${SUPABASE_TABLE}?emp_id=eq.${encodeURIComponent(empId)}`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ pin_hash: null }) }
    );
    if (!result.ok) return res.status(500).json({ ok: false });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, message: "Method not allowed" });
};
