// Vercel serverless function: per-day-per-IP visit counter + survey gate.
// URL: /api/visit  (served by Vercel's filesystem before the Railway rewrite)
//
// Required Vercel environment variables (Project → Settings → Environment Variables):
//   SUPABASE_URL                = https://cpoumpdgmjbqhmjqrgec.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = <your service-role key>   (server-side only, never VITE_)
//   SURVEY_IP_SALT              = <any long random string>  (used to hash IPs)
//
// Survey appears when: visit_count > 30 AND first seen >= ~1 month ago AND not already done.
// Fails closed: any error returns { show_survey: false } and never breaks the page.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SALT = process.env.SURVEY_IP_SALT || "swingai-default-salt";

const SURVEY_MIN_VISITS = 0;   // TEMP: 0 for testing — set back to 30 before going live
const SURVEY_MIN_AGE_DAYS = 0; // TEMP: 0 for testing — set back to 30 before going live

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  return typeof real === "string" ? real : "";
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(200).json({ show_survey: false, error: "server not configured" });
    }

    const ip = clientIp(req);
    if (!ip) return res.status(200).json({ show_survey: false });

    const hashed = crypto.createHash("sha256").update(`${SALT}:${ip}`).digest("hex");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Mark this IP as done — called after the survey is shown or submitted.
    if (req.method === "POST" && req.body && req.body.action === "survey_done") {
      await supabase.rpc("mark_ip_survey_done", { p_hashed_ip: hashed });
      return res.status(200).json({ ok: true });
    }

    // Record a visit (counts once per calendar day) and read the row back.
    const { data, error } = await supabase.rpc("record_ip_visit", { p_hashed_ip: hashed });
    if (error) return res.status(200).json({ show_survey: false, error: error.message });

    const row = Array.isArray(data) ? data[0] : data;
    const ageMs = SURVEY_MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
    const oldEnough = row?.first_seen
      ? Date.now() - new Date(row.first_seen).getTime() >= ageMs
      : false;

    const show =
      !!row &&
      row.survey_done === false &&
      Number(row.visit_count) > SURVEY_MIN_VISITS &&
      oldEnough;

    return res.status(200).json({ show_survey: show, visit_count: row?.visit_count ?? 0 });
  } catch (e) {
    return res.status(200).json({ show_survey: false, error: String(e?.message || e) });
  }
}
