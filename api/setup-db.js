module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ ok: false, message: "Supabase not configured" });
  }

  // 用 Supabase Management API 執行 SQL（service role 有權限）
  const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) {
    return res.status(500).json({ ok: false, message: "Cannot parse project ref from SUPABASE_URL" });
  }

  const sql = `ALTER TABLE training_records ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}';`;

  const result = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await result.text();
  return res.status(result.ok ? 200 : result.status).json({
    ok: result.ok,
    status: result.status,
    body: text,
  });
};
