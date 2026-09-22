/**
 * Small serverless backend for shared voucher history.
 * Runs as a Vercel Node.js Function (zero dependencies — uses the built-in
 * global fetch to talk to a Supabase Postgres table over its REST API).
 *
 * Required environment variables (set in Vercel Project Settings -> Environment Variables):
 *   SUPABASE_URL          e.g. https://xxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  the "service_role" secret key from Supabase (Settings -> API)
 *                         NEVER put this key in the frontend — it stays server-side only.
 *
 * Expected table (create once via the Supabase SQL editor — see BACKEND_SETUP.md):
 *   create table vouchers (
 *     id uuid primary key default gen_random_uuid(),
 *     created_at timestamptz not null default now(),
 *     data jsonb not null
 *   );
 */

const RETENTION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

function cutoffIso() {
  return new Date(Date.now() - RETENTION_MS).toISOString();
}

function supabaseHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: "Bearer " + serviceKey,
    "Content-Type": "application/json"
  };
}

function rowToVoucher(row) {
  return Object.assign({ id: row.id, createdAt: row.created_at }, row.data || {});
}

module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({
      error: "Backend not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your Vercel project's Environment Variables, then redeploy. See BACKEND_SETUP.md."
    });
    return;
  }

  const headers = supabaseHeaders(SERVICE_KEY);
  const base = SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/vouchers";

  try {
    if (req.method === "GET") {
      // Best-effort cleanup of anything older than the 2-day retention window.
      await fetch(base + "?created_at=lt." + encodeURIComponent(cutoffIso()), {
        method: "DELETE",
        headers
      }).catch(function () {});

      const listUrl =
        base +
        "?select=id,created_at,data&created_at=gte." +
        encodeURIComponent(cutoffIso()) +
        "&order=created_at.desc";
      const r = await fetch(listUrl, { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } });
      if (!r.ok) throw new Error("Supabase GET failed: " + r.status + " " + (await r.text()));
      const rows = await r.json();
      res.status(200).json({ vouchers: rows.map(rowToVoucher) });
      return;
    }

    if (req.method === "POST") {
      var body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
      }
      body = body || {};

      const r = await fetch(base, {
        method: "POST",
        headers: Object.assign({}, headers, { Prefer: "return=representation" }),
        body: JSON.stringify([{ data: body }])
      });
      if (!r.ok) throw new Error("Supabase POST failed: " + r.status + " " + (await r.text()));
      const rows = await r.json();
      res.status(200).json({ voucher: rowToVoucher(rows[0]) });
      return;
    }

    if (req.method === "DELETE") {
      var id = req.query && req.query.id;
      if (!id) {
        try { id = new URL(req.url, "http://internal").searchParams.get("id"); } catch (e) {}
      }
      if (!id) { res.status(400).json({ error: "Missing id" }); return; }

      const r = await fetch(base + "?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }
      });
      if (!r.ok) throw new Error("Supabase DELETE failed: " + r.status + " " + (await r.text()));
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
