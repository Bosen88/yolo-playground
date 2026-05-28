const crypto = require("crypto");

function signToken(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASS;

  if (!expectedUser || !expectedPass) {
    return res.status(503).json({
      ok: false,
      message: "Admin login is not configured. Set ADMIN_USER and ADMIN_PASS."
    });
  }

  const { username, password } = readBody(req);
  const valid = username === expectedUser && password === expectedPass;

  if (!valid) {
    return res.status(401).json({ ok: false, message: "Invalid credentials" });
  }

  const token = signToken({
    role: "admin",
    exp: Date.now() + 8 * 60 * 60 * 1000
  });

  return res.status(200).json({ ok: true, token });
};
