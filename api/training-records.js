const crypto = require("crypto");

const SUPABASE_TABLE = "training_records";

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  };
}

function headers() {
  const { key } = getSupabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

function mapRecord(body = {}) {
  const payload = {
    dept: body.dept,
    name: body.name,
    emp_id: body.empId
  };
  if (body.quiz1Score !== undefined) payload.quiz1_score = body.quiz1Score;
  if (body.quiz2Score !== undefined) payload.quiz2_score = body.quiz2Score;
  if (body.progress !== undefined) payload.progress = body.progress;
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function verifyAdminToken(req) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS;
  const token = req.headers["x-admin-token"];
  if (!secret || !token || !token.includes(".")) return false;

  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const safeSig = Buffer.from(sig);
  const safeExpected = Buffer.from(expected);
  if (safeSig.length !== safeExpected.length || !crypto.timingSafeEqual(safeSig, safeExpected)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

async function supabaseFetch(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return {
      ok: false,
      status: 503,
      json: async () => ({ message: "Supabase is not configured" }),
      text: async () => "Supabase is not configured"
    };
  }
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "POST") {
    const payload = mapRecord(readBody(req));
    const result = await supabaseFetch(`${SUPABASE_TABLE}?on_conflict=emp_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload)
    });
    if (!result.ok) return res.status(result.status).json({ ok: false, message: await result.text() });
    return res.status(200).json({ ok: true });
  }

  // 學員查自己的進度（不需要 admin token，但必須帶 empId）
  if (req.method === "GET" && req.query.empId && !verifyAdminToken(req)) {
    const empId = encodeURIComponent(req.query.empId);
    const result = await supabaseFetch(`${SUPABASE_TABLE}?emp_id=eq.${empId}&select=progress,quiz1_score,quiz2_score`);
    if (!result.ok) return res.status(result.status).json({ ok: false });
    const data = await result.json();
    return res.status(200).json(data[0] || null);
  }

  // 公開排行榜（不需要 admin token，只回傳姓名、部門、分數）
  if (req.method === "GET" && req.query.leaderboard === "1") {
    const result = await supabaseFetch(
      `${SUPABASE_TABLE}?select=name,dept,quiz1_score,quiz2_score&order=quiz1_score.desc.nullslast`
    );
    if (!result.ok) return res.status(result.status).json([]);
    const data = await result.json();
    return res.status(200).json(data);
  }

  if (!verifyAdminToken(req)) {
    return res.status(401).json({ ok: false, message: "Admin token required" });
  }

  if (req.method === "GET") {
    const result = await supabaseFetch(`${SUPABASE_TABLE}?select=*&order=created_at.desc`);
    const data = await result.json();
    return res.status(result.status).json(data);
  }

  if (req.method === "PATCH") {
    const empId = encodeURIComponent(req.query.empId || "");
    const payload = mapRecord(readBody(req));
    delete payload.emp_id;
    const result = await supabaseFetch(`${SUPABASE_TABLE}?emp_id=eq.${empId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload)
    });
    if (!result.ok) return res.status(result.status).json({ ok: false, message: await result.text() });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const empId = encodeURIComponent(req.query.empId || "");
    const result = await supabaseFetch(`${SUPABASE_TABLE}?emp_id=eq.${empId}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    if (!result.ok) return res.status(result.status).json({ ok: false, message: await result.text() });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ ok: false, message: "Method not allowed" });
};
