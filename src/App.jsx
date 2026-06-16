import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import heroBg from "./assets/swingai-hero-bg.jpg";
import SurveyAdmin from "./SurveyAdmin.jsx";
import SurveyModal from "./SurveyModal.jsx";

// ─── Config ─────────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || "https://swingai-api-production.up.railway.app";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cpoumpdgmjbqhmjqrgec.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb3VtcGRnbWpicWhtanFyZ2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDcxNDcsImV4cCI6MjA5NTI4MzE0N30.q4-QleVM5flNGGltA7veVwrQq0e8NX-luz6eNdJ3lNs";
const CONTACT_EMAIL = "seed2success.financial@outlook.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
const GUEST_ZONE_DISCLAIMER_KEY = "swingaiGuestSuggestedEntryZoneDisclaimerAccepted";
const FRONTEND_BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || "phase12-launch-ux";
const SAFETY_DISCLAIMER = "SwingAI is a trading research and alert assistant. It does not place trades or guarantee outcomes. Always review signals manually and manage your own risk.";
const PRODUCT_POSITIONING = "AI-assisted market research, setup analysis, risk preview, portfolio monitoring, and alerts. Manual review is required before every trade.";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const sessionFlag = key => {
  try {
    return window.sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
};

const setSessionFlag = (key, value) => {
  try {
    window.sessionStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Session persistence is optional; the current page state still gates access.
  }
};

// Returns { data, error } — never throws
const api = async (path, opts = {}) => {
  try {
    let authHeader = {};
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) authHeader = { Authorization: `Bearer ${token}` };
    } catch { /* send request without a token */ }
    const r = await fetch(`${API_URL.replace(/\/$/, "")}${path}`, {
      headers: { "Content-Type": "application/json", ...authHeader, ...opts.headers },
      ...opts,
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = json?.detail;
      const message = typeof detail === "string" ? detail : detail?.detail || json?.message || `Server error ${r.status}`;
      return { data: json, error: message };
    }
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: `Cannot reach backend: ${e.message}` };
  }
};

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useLocalStorage(key, def) {
  const [v, setV] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch { return def; }
  });
  const set = useCallback(val => {
    setV(val);
    localStorage.setItem(key, JSON.stringify(val));
  }, [key]);
  return [v, set];
}

// ─── Design Tokens ───────────────────────────────────────────────────────────
const SCORE_COLOR = (score) =>
  score >= 80 ? "#00FFB2" : score >= 70 ? "#A3F7BF" : score >= 60 ? "#F59E0B" : "#6B7280";

const PNL_COLOR = (pnl) => pnl >= 0 ? "#00FFB2" : "#FF4D4D";

const confidenceValue = item => item?.estimated_confidence ?? item?.win_rate ?? item?.score?.estimated_confidence ?? item?.score?.win_rate;
const formatConfidence = item => {
  const value = confidenceValue(item);
  return value == null || value === "" || Number.isNaN(Number(value)) ? "-" : `${Number(value).toFixed(0)}%`;
};
const formatFreshness = value => {
  if (!value) return "Updated time unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Updated time unknown";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return `Updated ${d.toLocaleString()}`;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `Updated ${d.toLocaleString()}`;
};
const normalizeActionLabel = value => ({
  entry_ready: "Entry Ready",
  near_entry: "Near Entry",
  wait_for_confirmation: "Wait for Confirmation",
  wait_for_confirmation_constructive: "Wait for Confirmation",
  wait_for_1h_confirmation: "Wait — 1H Pending",
  wait_for_trigger: "Waiting for Trigger",
  wait_for_pullback: "Wait for Pullback",
  wait_for_breakout: "Wait for Breakout",
  watch_only: "Watch Only",
  too_extended: "Too Extended",
  missed_first_entry: "Missed First Entry",
  pullback_forming: "Pullback Forming",
  reconfirmation_needed: "Reconfirmation Needed",
  setup_forming: "Setup Forming",
  momentum_continuation_forming: "Momentum Forming",
  no_clean_setup: "No Clean Setup",
  invalidated: "Invalidated",
  avoid: "Avoid",
  market_hostile: "Market Hostile",
  data_limited: "Data Limited",
  data_stale: "Price Stale",
}[String(value || "").toLowerCase()] || compactStatus(value));
const VOLUME_CONFIDENCE_STYLE = {
  High: { color: "var(--green)", borderColor: "rgba(34,197,94,0.42)", background: "rgba(34,197,94,0.08)" },
  Medium: { color: "var(--blue)", borderColor: "rgba(77,166,255,0.42)", background: "rgba(77,166,255,0.08)" },
  Limited: { color: "var(--amber)", borderColor: "rgba(251,176,36,0.42)", background: "rgba(251,176,36,0.08)" },
  Unknown: { color: "var(--muted)", borderColor: "var(--border2)", background: "rgba(255,255,255,0.035)" },
};
const marketRegimeStyle = regime => {
  const value = String(regime || "");
  if (value === "Bull") return { color: "var(--green)", borderColor: "rgba(34,197,94,0.42)", background: "rgba(34,197,94,0.08)" };
  if (value === "Constructive") return { color: "var(--green2)", borderColor: "rgba(163,247,191,0.42)", background: "rgba(163,247,191,0.08)" };
  if (value === "Choppy") return { color: "var(--amber)", borderColor: "rgba(251,176,36,0.42)", background: "rgba(251,176,36,0.08)" };
  if (value === "Defensive") return { color: "var(--amber)", borderColor: "rgba(251,176,36,0.42)", background: "rgba(251,176,36,0.08)" };
  if (value === "Bear") return { color: "var(--red)", borderColor: "rgba(255,77,77,0.42)", background: "rgba(255,77,77,0.08)" };
  return { color: "var(--muted)", borderColor: "var(--border2)", background: "rgba(255,255,255,0.035)" };
};
const decisionStatusStyle = status => {
  const value = String(status || "");
  if (value === "entry_ready") return { color: "var(--green)", borderColor: "rgba(34,197,94,0.42)", background: "rgba(34,197,94,0.08)" };
  if (["wait_for_confirmation", "wait_for_1h_confirmation", "market_hostile"].includes(value)) return { color: "var(--blue)", borderColor: "rgba(77,166,255,0.42)", background: "rgba(77,166,255,0.08)" };
  if (["watch_only", "too_extended", "missed_first_entry", "pullback_forming", "data_stale"].includes(value)) return { color: "var(--amber)", borderColor: "rgba(251,176,36,0.42)", background: "rgba(251,176,36,0.08)" };
  if (["avoid", "invalidated", "market_hostile"].includes(value)) return { color: "var(--red)", borderColor: "rgba(255,77,77,0.42)", background: "rgba(255,77,77,0.08)" };
  if (["reconfirmation_needed", "setup_forming"].includes(value)) return { color: "var(--blue)", borderColor: "rgba(77,166,255,0.42)", background: "rgba(77,166,255,0.08)" };
  return { color: "var(--muted)", borderColor: "var(--border2)", background: "rgba(255,255,255,0.035)" };
};
const leadershipStyle = label => {
  const value = String(label || "");
  if (value === "Leader") return { color: "var(--green)", borderColor: "rgba(34,197,94,0.42)", background: "rgba(34,197,94,0.08)" };
  if (value === "Emerging Leader") return { color: "var(--green2)", borderColor: "rgba(163,247,191,0.42)", background: "rgba(163,247,191,0.08)" };
  if (value === "Constructive") return { color: "var(--blue)", borderColor: "rgba(77,166,255,0.42)", background: "rgba(77,166,255,0.08)" };
  if (value === "Neutral") return { color: "var(--muted)", borderColor: "var(--border2)", background: "rgba(255,255,255,0.035)" };
  if (["Laggard", "Avoid Leadership"].includes(value)) return { color: "var(--red)", borderColor: "rgba(255,77,77,0.42)", background: "rgba(255,77,77,0.08)" };
  return { color: "var(--muted)", borderColor: "var(--border2)", background: "rgba(255,255,255,0.035)" };
};
const sectorStrengthStyle = label => {
  const value = String(label || "");
  if (value === "Leading") return { color: "var(--green)", borderColor: "rgba(34,197,94,0.42)", background: "rgba(34,197,94,0.08)" };
  if (value === "Strong") return { color: "var(--green2)", borderColor: "rgba(163,247,191,0.42)", background: "rgba(163,247,191,0.08)" };
  if (value === "Neutral") return { color: "var(--blue)", borderColor: "rgba(77,166,255,0.42)", background: "rgba(77,166,255,0.08)" };
  if (value === "Weakening") return { color: "var(--amber)", borderColor: "rgba(251,176,36,0.42)", background: "rgba(251,176,36,0.08)" };
  if (value === "Weak") return { color: "var(--red)", borderColor: "rgba(255,77,77,0.42)", background: "rgba(255,77,77,0.08)" };
  return { color: "var(--muted)", borderColor: "var(--border2)", background: "rgba(255,255,255,0.035)" };
};
const fmtPctSigned = value => value == null || value === "" || Number.isNaN(Number(value)) ? "-" : `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
const compactStatus = value => String(value || "-").replaceAll("_", " ");
const timingLabel = value => ({
  entry_ready: "Entry Ready",
  tradeable_now: "Entry Ready",
  near_entry: "Near Entry",
  wait_for_1h_confirmation: "Wait — 1H Pending",
  wait_for_confirmation: "Wait for Confirmation",
  wait_for_confirmation_constructive: "Wait for Confirmation",
  wait_for_trigger: "Waiting for Trigger",
  wait_for_pullback: "Wait for Pullback",
  wait_for_breakout: "Wait for Breakout",
  watch_only: "Watch Only",
  watch_for_entry: "Watch Only",
  missed_first_entry: "Missed First Entry",
  pullback_forming: "Pullback Forming",
  reconfirmation_needed: "Reconfirmation Needed",
  setup_forming: "Setup Forming",
  momentum_continuation_forming: "Momentum Forming",
  no_clean_setup: "No Clean Setup",
  too_extended: "Too Extended",
  market_hostile: "Market Hostile",
  data_limited: "Data Limited",
  data_stale: "Price Stale",
  avoid: "Avoid",
  invalidated: "Invalidated",
}[value] || compactStatus(value));
const actionLabel = value => ({
  enter_now: "Entry Ready",
  entry_ready: "Entry Ready",
  consider_entry: "Near Entry",
  buy_signal_ready: "Entry Ready",
  near_entry: "Near Entry",
  wait_for_1h_confirmation: "Wait — 1H Pending",
  wait_for_confirmation: "Wait for Confirmation",
  wait_for_trigger: "Waiting for Trigger",
  market_hostile: "Market Hostile",
  too_extended: "Too Extended",
  watch_only: "Watch Only",
  wait_for_pullback: "Wait for Pullback",
  wait_for_breakout: "Wait for Breakout",
  missed_first_entry: "Missed First Entry",
  pullback_forming: "Pullback Forming",
  reconfirmation_needed: "Reconfirmation Needed",
  setup_forming: "Setup Forming",
  no_clean_setup: "No Clean Setup",
  data_limited: "Data Limited",
  data_stale: "Price Stale",
  watch: "Watch Only",
  wait: "Wait for Confirmation",
  avoid: "Avoid",
  invalidated: "Invalidated",
  cancelled: "Cancelled",
}[value] || compactStatus(value));
const priceZoneLabel = value => ({
  in_entry_zone: "In entry zone",
  above_entry_zone: "Above entry zone",
  below_entry_zone: "Below entry zone",
  unavailable: "Unavailable",
}[value] || (value === true ? "In entry zone" : value === false ? "Not in entry zone" : "-"));
const confirmationLabel = value => value ? "Passed" : "Waiting";
const normalizedWatchEntryTiming = row => {
  const timing = row?.entry_timing;
  const action = String(row?.entry_signal_action || "");
  if (
    timing === "avoid" &&
    row?.status === "waiting_for_1h_confirmation" &&
    row?.entry_signal_status === "pending" &&
    action.startsWith("wait")
  ) {
    return "wait_for_1h_confirmation";
  }
  if (timing === "wait_for_confirmation") return "wait_for_confirmation";
  if (timing === "wait_for_pullback") return "wait_for_pullback";
  if (timing === "missed_first_entry") return "missed_first_entry";
  if (timing === "pullback_forming") return "pullback_forming";
  if (timing === "reconfirmation_needed") return "reconfirmation_needed";
  if (timing === "enter_now_aggressive") return "entry_ready";
  return timing || row?.status;
};
const listItems = value => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];

const URGENCY_BADGE = {
  0: { label: "HOLD",    bg: "rgba(0,255,178,0.15)", text: "#00FFB2", border: "#00FFB2" },
  1: { label: "WATCH",   bg: "rgba(251,191,36,0.15)", text: "#FBB024", border: "#FBB024" },
  2: { label: "SELL",    bg: "rgba(255,77,77,0.15)",  text: "#FF4D4D", border: "#FF4D4D" },
  3: { label: "URGENT!", bg: "rgba(255,0,80,0.25)",   text: "#FF0050", border: "#FF0050" },
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const GUEST_TERMS_ACCEPTED_KEY = "guestDisclaimerAccepted";
const GUEST_TERMS_ACCEPTED_AT_KEY = "guestDisclaimerAcceptedAt";
const GUEST_TERMS_ACCEPTED_V1_KEY = "swingai_terms_accepted_v1";

const hasAcceptedGuestTerms = () =>
  localStorage.getItem(GUEST_TERMS_ACCEPTED_KEY) === "true" ||
  localStorage.getItem(GUEST_TERMS_ACCEPTED_V1_KEY) === "true";

const markGuestTermsAccepted = () => {
  const acceptedAt = new Date().toISOString();
  localStorage.setItem(GUEST_TERMS_ACCEPTED_KEY, "true");
  localStorage.setItem(GUEST_TERMS_ACCEPTED_V1_KEY, "true");
  localStorage.setItem(GUEST_TERMS_ACCEPTED_AT_KEY, acceptedAt);
  return acceptedAt;
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #06080D;
    --bg2:      #0D1118;
    --bg3:      #121821;
    --bg4:      #18202B;
    --border:   rgba(0,255,178,0.14);
    --border2:  rgba(255,255,255,0.08);
    --green:    #00FFB2;
    --green2:   #A3F7BF;
    --red:      #FF4D4D;
    --amber:    #FBB024;
    --blue:     #4DA6FF;
    --muted:    rgba(223,232,244,0.42);
    --text:     rgba(246,248,251,0.92);
    --text2:    rgba(223,232,244,0.66);
    --mono:     'JetBrains Mono', monospace;
    --ui:       'Inter', sans-serif;
  }

  html, body, #root { min-height: 100%; background: var(--bg); color: var(--text); font-family: var(--ui); overflow-x: hidden; }
  body { font-size: 14px; line-height: 1.45; overflow-y: auto; }
  ::-webkit-scrollbar { width: 7px; height: 7px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; }
  .app { display: flex; flex-direction: column; min-height: 100dvh; overflow: visible; }

  .header { display: flex; align-items: center; gap: 18px; padding: 0 22px; min-height: 56px; background: rgba(13,17,24,0.96); border-bottom: 1px solid var(--border2); flex-shrink: 0; box-shadow: 0 1px 0 rgba(255,255,255,0.03); }
  .logo { font-family: var(--ui); font-weight: 800; font-size: 18px; letter-spacing: 0; background: linear-gradient(135deg, var(--green), #7CC2FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; flex-shrink: 0; }
  .logo span { font-weight: 400; opacity: 0.5; }
  .header-nav { display: flex; gap: 4px; margin-left: 4px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .header-nav::-webkit-scrollbar { display: none; }
  .nav-btn { min-height: 32px; padding: 7px 12px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-family: var(--ui); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; background: transparent; color: var(--text2); transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s; }
  .nav-btn:hover { background: rgba(255,255,255,0.045); color: var(--text); border-color: var(--border2); }
  .nav-btn.active { background: rgba(0,255,178,0.10); color: var(--green); border-color: rgba(0,255,178,0.22); }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); }
  .user-pill { max-width: 160px; overflow: hidden; text-overflow: ellipsis; padding: 5px 11px; border-radius: 999px; background: var(--bg3); border: 1px solid var(--border2); font-size: 11px; color: var(--text2); cursor: pointer; white-space: nowrap; }
  .logout-btn { min-height: 28px; padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border2); background: transparent; color: var(--muted); font-size: 11px; cursor: pointer; }
  .logout-btn:hover { border-color: var(--red); color: var(--red); }

  .main { display: flex; flex: 1 1 auto; min-height: 0; overflow: visible; }
  .content { flex: 1; overflow-y: auto; padding: 22px; padding-bottom: calc(22px + env(safe-area-inset-bottom)); }

  .card { background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005)), var(--bg2); border: 1px solid var(--border2); border-radius: 8px; padding: 18px; box-shadow: 0 12px 28px rgba(0,0,0,0.18); }
  .card-title { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }

  .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: stretch; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
  .mt-3 { margin-top: 12px; }
  .mt-4 { margin-top: 16px; }
  .w-full { width: 100%; }

  .stat-card { background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.006)), var(--bg2); border: 1px solid var(--border2); border-radius: 8px; padding: 16px; min-height: 108px; display: flex; flex-direction: column; justify-content: center; }
  .stat-label { font-size: 10px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); }
  .stat-value { font-family: var(--mono); font-size: 24px; font-weight: 700; margin-top: 6px; line-height: 1.1; }
  .stat-sub { font-size: 11px; color: var(--text2); margin-top: 6px; line-height: 1.35; }

  .table-wrap { width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: auto; border-radius: inherit; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: var(--mono); min-width: 760px; }
  th { text-align: left; padding: 10px 12px; font-size: 9px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border2); white-space: nowrap; position: sticky; top: 0; background: #0F141C; z-index: 1; }
  td { padding: 11px 12px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.045); white-space: nowrap; vertical-align: middle; color: var(--text2); }
  .market-col-label-mobile { display: none; }
  tbody tr:nth-child(even) td { background: rgba(255,255,255,0.012); }
  tr:hover td { background: rgba(0,255,178,0.035); }
  tr:last-child td { border-bottom: none; }
  td:first-child, th:first-child { color: var(--text); padding-left: 14px; }

  .score-bar { display: flex; align-items: center; gap: 8px; }
  .score-bar-bg { flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }

  .badge { display: inline-flex; align-items: center; justify-content: center; min-height: 20px; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; border: 1px solid currentColor; white-space: nowrap; }

  .pos-progress { position: relative; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: visible; min-width: 80px; }
  .pos-fill { height: 100%; border-radius: 3px; }
  .pos-marker { position: absolute; top: -4px; width: 2px; height: 14px; background: white; border-radius: 1px; box-shadow: 0 0 4px rgba(255,255,255,0.6); }

  .btn { min-height: 32px; padding: 7px 14px; border-radius: 6px; border: none; cursor: pointer; font-family: var(--ui); font-size: 12px; font-weight: 800; transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .btn:hover:not(:disabled) { transform: translateY(-1px); }
  .btn:active:not(:disabled) { transform: translateY(0); }
  .btn:focus-visible, .nav-btn:focus-visible, .logout-btn:focus-visible, .input:focus-visible { outline: 2px solid rgba(77,166,255,0.45); outline-offset: 2px; }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .btn-green { background: rgba(0,255,178,0.15); color: var(--green); border: 1px solid rgba(0,255,178,0.3); }
  .btn-green:hover:not(:disabled) { background: rgba(0,255,178,0.25); }
  .btn-red { background: rgba(255,77,77,0.15); color: var(--red); border: 1px solid rgba(255,77,77,0.3); }
  .btn-red:hover:not(:disabled) { background: rgba(255,77,77,0.25); }
  .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border2); }
  .btn-ghost:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
  .btn-blue { background: rgba(77,166,255,0.15); color: var(--blue); border: 1px solid rgba(77,166,255,0.3); }
  .btn-amber { background: rgba(251,176,36,0.15); color: var(--amber); border: 1px solid rgba(251,176,36,0.3); }

  .input { background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px; padding: 9px 12px; color: var(--text); font-family: var(--mono); font-size: 13px; outline: none; width: 100%; min-height: 36px; }
  .input:focus { border-color: var(--green); }
  .input::placeholder { color: var(--muted); }
  label { font-size: 11px; font-weight: 600; color: var(--text2); margin-bottom: 4px; display: block; }

  .login-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 0%, rgba(0,255,178,0.04) 0%, transparent 60%), var(--bg); }
  .login-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 40px 36px; width: min(360px, calc(100vw - 32px)); box-shadow: 0 0 60px rgba(0,255,178,0.05); }
  .login-logo { font-size: 28px; font-weight: 800; margin-bottom: 6px; background: linear-gradient(135deg, var(--green), var(--blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .login-sub { font-size: 13px; color: var(--muted); margin-bottom: 28px; }

  .loader { text-align: center; padding: 60px; color: var(--muted); font-size: 13px; }
  .spin { display: inline-block; width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--green); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 10px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.3s ease forwards; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .pulse { animation: pulse 2s ease infinite; }

  .empty { text-align: center; padding: 40px 20px; color: var(--muted); }
  .empty h3 { font-size: 15px; color: var(--text2); margin-bottom: 8px; }
  .empty p { font-size: 12px; }

  .err-box { background: rgba(255,77,77,.08); border: 1px solid rgba(255,77,77,.25); border-radius: 8px; padding: 12px 14px; font-size: 12px; color: var(--red); margin-bottom: 12px; }
  .ok-box  { background: rgba(0,255,178,.08); border: 1px solid rgba(0,255,178,.25); border-radius: 8px; padding: 12px 14px; font-size: 12px; color: var(--green); margin-bottom: 12px; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; overflow-y: auto; }
  .modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 24px; width: min(92vw, 520px); max-height: 85dvh; overflow-y: auto; box-shadow: 0 20px 80px rgba(0,0,0,0.5); }
  .guest-zone-modal-overlay { z-index: 1200; }
  .guest-zone-modal { width: min(92vw, 520px); max-height: 85dvh; }
  .modal-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
  .guest-disclaimer-overlay { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,0.78); backdrop-filter: blur(6px); }
  .guest-disclaimer-modal { width: min(860px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; background: var(--bg2); border: 1px solid rgba(251,176,36,0.28); border-radius: 8px; padding: clamp(20px, 4vw, 30px); box-shadow: 0 24px 80px rgba(0,0,0,0.55); }
  .guest-disclaimer-kicker { color: var(--amber); font-size: 10px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase; margin-bottom: 10px; }
  .guest-disclaimer-title { font-size: clamp(18px, 3vw, 24px); font-weight: 800; margin-bottom: 12px; }
  .guest-disclaimer-text { display: grid; gap: 10px; color: var(--text2); font-size: 13px; line-height: 1.6; }
  .guest-warning-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
  .guest-warning-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 9px; border-radius: 999px; color: var(--amber); background: rgba(251,176,36,0.10); border: 1px solid rgba(251,176,36,0.28); font-size: 10px; font-weight: 800; letter-spacing: .4px; }
  .guest-checks { display: grid; gap: 9px; margin: 16px 0; }
  .guest-check { display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start; padding: 11px 12px; border-radius: 8px; background: var(--bg3); border: 1px solid var(--border2); color: var(--text2); font-size: 12px; line-height: 1.4; }
  .guest-check input { width: 16px; height: 16px; accent-color: var(--green); margin-top: 1px; }
  .guest-terms { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border2); color: var(--text2); font-size: 12px; line-height: 1.65; }
  .guest-terms h3 { color: var(--text); font-size: 16px; margin-bottom: 8px; }
  .guest-terms h4 { color: var(--text); font-size: 13px; margin: 16px 0 6px; }
  .guest-terms p { margin-bottom: 8px; }
  .guest-footer-link { margin-top: 14px; padding: 0; border: 0; background: transparent; color: var(--blue); font: inherit; font-size: 11px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

  .alert-card { background: var(--bg3); border: 1px solid var(--border2); border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
  .alert-buy  { border-left: 3px solid var(--green); }
  .alert-sell { border-left: 3px solid var(--red); }
  .alert-info { border-left: 3px solid var(--blue); }

  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.07); color: var(--text2); border: 1px solid rgba(255,255,255,0.04); }
  .signals-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .signal-pill { padding: 2px 8px; border-radius: 4px; font-size: 10px; background: rgba(0,255,178,0.08); color: var(--green2); border: 1px solid rgba(0,255,178,0.15); }

  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .section-title { font-size: 15px; font-weight: 700; }
  .section-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .grid-2.gap-3 { gap: 12px; }

  .screener-hero { position: relative; overflow: hidden; margin-bottom: 16px; padding: clamp(22px, 4vw, 34px); border-radius: 8px; border: 1px solid rgba(77,166,255,0.18); background-image: linear-gradient(90deg, rgba(5,11,18,0.96) 0%, rgba(6,16,26,0.93) 34%, rgba(6,18,29,0.66) 58%, rgba(5,11,18,0.26) 100%), radial-gradient(circle at 76% 46%, rgba(0,255,178,0.12), transparent 31%), var(--hero-bg); background-size: cover; background-position: center right; box-shadow: 0 18px 48px rgba(0,0,0,0.28); isolation: isolate; }
  .screener-hero::before { content: ""; position: absolute; inset: -35%; background: radial-gradient(circle at 78% 44%, rgba(0,255,178,0.10), transparent 24%), linear-gradient(120deg, transparent 20%, rgba(77,166,255,0.08), rgba(0,255,178,0.08), transparent 78%); transform: translateX(-18%); animation: heroGlow 18s ease-in-out infinite alternate; z-index: -3; }
  .screener-hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.055) 46%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.035) 54%, transparent 100%); transform: translateX(-110%); animation: heroShimmer 8s ease-in-out infinite; z-index: -1; pointer-events: none; }
  .hero-grid { position: absolute; inset: 0; opacity: .20; z-index: -2; background-image: linear-gradient(rgba(77,166,255,0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,178,0.045) 1px, transparent 1px); background-size: 58px 44px; mask-image: linear-gradient(90deg, transparent 0%, black 24%, black 96%); }
  .hero-market-scene { position: absolute; inset: 0; opacity: .72; z-index: -1; overflow: hidden; background: transparent; box-shadow: none; pointer-events: none; mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.16) 34%, rgba(0,0,0,0.72) 56%, black 100%); }
  .hero-market-scene::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(77,166,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,178,0.035) 1px, transparent 1px); background-size: 48px 34px; opacity: .28; mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.25) 42%, black 100%); }
  .hero-market-scene::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 76% 34%, rgba(0,255,178,0.11), transparent 30%); pointer-events: none; }
  .hero-market-scene svg { position: absolute; top: 0; right: 0; width: min(54%, 640px); height: 100%; min-height: 190px; overflow: visible; }
  .market-trend { fill: none; stroke: rgba(0,255,178,0.56); stroke-width: 2.2; stroke-linecap: round; stroke-dasharray: 540; stroke-dashoffset: 540; filter: drop-shadow(0 0 9px rgba(0,255,178,0.42)); animation: trendDraw 9s ease-in-out infinite; }
  .market-trend-blue { fill: none; stroke: rgba(77,166,255,0.42); stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 500; stroke-dashoffset: 500; filter: drop-shadow(0 0 8px rgba(77,166,255,0.30)); animation: trendDraw 11s ease-in-out infinite reverse; }
  .market-fill { fill: url(#heroTrendFill); opacity: .24; animation: marketLift 8s ease-in-out infinite; }
  .market-dot { fill: rgba(0,255,178,0.72); filter: drop-shadow(0 0 7px rgba(0,255,178,0.45)); animation: linePulse 5s ease-in-out infinite; }
  .market-dot:nth-of-type(2) { animation-delay: .8s; }
  .market-dot:nth-of-type(3) { animation-delay: 1.6s; }
  .hero-content { position: relative; z-index: 1; max-width: 760px; padding-right: 0; }
  .hero-kicker { display: inline-flex; align-items: center; min-height: 22px; padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(0,255,178,0.24); background: rgba(0,255,178,0.08); color: var(--green2); font-size: 10px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; margin-bottom: 12px; }
  .hero-title { font-size: clamp(28px, 5vw, 48px); line-height: 1.02; font-weight: 800; letter-spacing: 0; color: var(--text); margin-bottom: 10px; }
  .hero-subtitle { color: var(--text2); font-size: clamp(14px, 2vw, 17px); line-height: 1.55; max-width: 560px; margin-bottom: 16px; }
  .hero-reminders { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; max-width: 760px; margin: 16px 0 20px; }
  .hero-reminder { display: flex; gap: 8px; align-items: flex-start; color: rgba(223,232,244,0.72); font-size: 12px; line-height: 1.45; }
  .hero-reminder::before { content: ""; width: 6px; height: 6px; flex: 0 0 6px; margin-top: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 10px rgba(0,255,178,0.52); }
  .hero-cta { min-height: 38px; padding: 9px 16px; border-radius: 6px; border: 1px solid rgba(0,255,178,0.34); background: linear-gradient(135deg, rgba(0,255,178,0.18), rgba(77,166,255,0.16)); color: var(--green2); font-size: 12px; font-weight: 800; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
  .hero-cta:hover { transform: translateY(-2px); border-color: rgba(0,255,178,0.58); box-shadow: 0 12px 28px rgba(0,255,178,0.13); }
  .hero-chips { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
  .hero-chip { position: absolute; display: inline-flex; align-items: center; min-height: 24px; padding: 4px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.10); background: rgba(13,17,24,0.64); backdrop-filter: blur(8px); color: rgba(246,248,251,0.72); font-family: var(--mono); font-size: 10px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.22); animation: chipFloat 6s ease-in-out infinite; }
  .hero-chip:nth-child(1) { top: 16%; right: 31%; animation-delay: 0s; }
  .hero-chip:nth-child(2) { top: 13%; right: 8%; animation-delay: .8s; }
  .hero-chip:nth-child(3) { top: 48%; right: 10%; animation-delay: 1.6s; }
  .hero-chip:nth-child(4) { bottom: 20%; right: 29%; animation-delay: 2.4s; }
  .hero-chip:nth-child(5) { bottom: 12%; right: 7%; animation-delay: 3.2s; }

  .app-footer { margin-top: 28px; padding: 18px 0 4px; border-top: 1px solid var(--border2); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; color: rgba(148,163,184,0.78); font-size: 11px; }
  .app-footer-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .app-footer-link { padding: 0; border: 0; background: transparent; color: rgba(148,163,184,0.82); font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .app-footer-link:hover { color: var(--text2); }
  .legal-modal-body { color: var(--text2); font-size: 13px; line-height: 1.65; }
  .legal-modal-body p { margin: 0 0 10px; }

  @keyframes heroGlow { from { transform: translate3d(-18%, -2%, 0) rotate(0deg); opacity: .72; } to { transform: translate3d(12%, 4%, 0) rotate(6deg); opacity: 1; } }
  @keyframes heroShimmer { 0%, 38% { transform: translateX(-115%); opacity: 0; } 48% { opacity: .72; } 64%, 100% { transform: translateX(115%); opacity: 0; } }
  @keyframes trendDraw { 0% { stroke-dashoffset: 540; opacity: .18; } 34%, 70% { stroke-dashoffset: 0; opacity: .78; } 100% { stroke-dashoffset: -540; opacity: .24; } }
  @keyframes marketLift { 0%,100% { transform: translateY(5px); opacity: .20; } 50% { transform: translateY(-4px); opacity: .44; } }
  @keyframes linePulse { 0%,100% { opacity: .30; transform: scale(.82); } 50% { opacity: .86; transform: scale(1); } }
  @keyframes chipFloat { 0%,100% { transform: translate3d(0,0,0); opacity: .66; } 50% { transform: translate3d(0,-7px,0); opacity: .95; } }

  @media (max-width: 900px) {
    .content { padding: 18px; padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
    .grid-3, .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .header { gap: 12px; }
    .header-right { gap: 8px; }
    .hero-content { max-width: 720px; }
    .hero-market-scene { opacity: .42; }
    .hero-market-scene svg { width: 62%; }
    .hero-chip:nth-child(4), .hero-chip:nth-child(5) { display: none; }
  }
  @media (max-width: 720px) {
    .header { flex-wrap: wrap; align-items: center; padding: 10px 14px; }
    .header-nav { order: 3; width: 100%; margin-left: 0; padding-bottom: 1px; }
    .header-right { margin-left: auto; }
    .content { padding: 14px; padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
    .section-header { align-items: flex-start; flex-direction: column; gap: 10px; }
    .section-header > div:last-child { width: 100%; }
    .modal-actions { flex-wrap: wrap; }
    .screener-hero { padding: 22px 18px; }
    .hero-reminders { grid-template-columns: 1fr; }
    .hero-market-scene { display: block; opacity: .20; mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.22) 24%, black 100%); }
    .hero-market-scene svg { width: 100%; }
    .hero-chips { position: relative; display: flex; flex-wrap: wrap; gap: 7px; margin-top: 18px; }
    .hero-chip { position: static; animation: chipFloat 7s ease-in-out infinite; }
  }
  @media (max-width: 640px) {
    html, body, #root, .app, .content { max-width: 100%; overflow-x: hidden; }
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
    .card, .stat-card { padding: 14px; }
    .header-nav .nav-btn { font-size: 10px; padding: 6px 9px; }
    .user-pill { max-width: 110px; }
    .logout-btn { padding-inline: 8px; }
    table { min-width: 720px; }
    th { padding: 9px 10px; }
    td { padding: 10px; }
    .filters .btn { flex: 1 1 150px; white-space: normal; }
    .table-wrap table th:first-child, .table-wrap table td:first-child { position: sticky; left: 0; z-index: 2; background: #0F141C; box-shadow: 8px 0 14px rgba(0,0,0,0.16); }
    .table-wrap table td:first-child { background: #101720; }
    .market-table-card { width: 100%; max-width: 100%; overflow: hidden; }
    .market-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; }
    .market-table { min-width: 0; table-layout: fixed; font-size: 11px; }
    .market-table th { padding: 6px 4px; font-size: 8px; letter-spacing: 0; }
    .market-table td { padding: 6px 4px; font-size: 11px; }
    .market-table th:first-child, .market-table td:first-child { padding-left: 6px; width: 23%; }
    .market-table th:nth-child(2), .market-table td:nth-child(2),
    .market-table th:nth-child(3), .market-table td:nth-child(3),
    .market-table th:nth-child(4), .market-table td:nth-child(4),
    .market-table th:nth-child(5), .market-table td:nth-child(5) { text-align: right; }
    .market-table th:nth-child(2), .market-table td:nth-child(2) { width: 25%; }
    .market-table th:nth-child(3), .market-table td:nth-child(3) { width: 20%; }
    .market-table th:nth-child(4), .market-table td:nth-child(4) { width: 28%; }
    .market-table.has-dollar-volume th:first-child, .market-table.has-dollar-volume td:first-child { width: 19%; }
    .market-table.has-dollar-volume th:nth-child(2), .market-table.has-dollar-volume td:nth-child(2) { width: 21%; }
    .market-table.has-dollar-volume th:nth-child(3), .market-table.has-dollar-volume td:nth-child(3) { width: 17%; }
    .market-table.has-dollar-volume th:nth-child(4), .market-table.has-dollar-volume td:nth-child(4) { width: 22%; }
    .market-table.has-dollar-volume th:nth-child(5), .market-table.has-dollar-volume td:nth-child(5) { width: 21%; }
    .market-col-label-full { display: none; }
    .market-col-label-mobile { display: inline; }
    .modal-overlay { align-items: center; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); z-index: 1000; }
    .modal { width: min(92vw, 520px); max-height: 85dvh; padding: 18px; }
    .modal-actions { justify-content: stretch; }
    .modal-actions .btn { flex: 1; min-height: 42px; }
    .guest-disclaimer-modal { padding: 18px; }
    .guest-disclaimer-overlay .modal-actions { justify-content: stretch; }
    .guest-disclaimer-overlay .modal-actions .btn { flex: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .screener-hero::before, .screener-hero::after, .market-trend, .market-trend-blue, .market-fill, .market-dot, .hero-chip, .hero-cta, .fade-up, .pulse, .spin { animation: none !important; transition: none !important; }
    .hero-cta:hover { transform: none; }
  }
`;

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, fontFamily: "var(--mono)" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

function ScoreGauge({ score }) {
  const color = SCORE_COLOR(score);
  return (
    <div className="score-bar">
      <div className="score-bar-bg">
        <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13, color, minWidth: 28 }}>{score}</span>
    </div>
  );
}

function ScreenerHero({
  kicker = "SwingAI Screener",
  title = "SwingAI Trading Research",
  subtitle = "AI-assisted market research, stock setup analysis, risk previews, and alerts",
  reminders,
  chips = ["AI SCORE", "TOP 100", "1D SIGNAL", "4H CONFIRM", "U.S. MARKET"],
  showCta = true,
}) {
  const focusTickerInput = () => {
    const input = document.querySelector("[data-single-ticker-input='true']");
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => input.focus(), 250);
    }
  };

  const defaultReminders = [
    "Research and alerts only - SwingAI does not place trades",
    "Review every setup manually before acting",
    "Entry, stop, target, and sizing values are planning estimates",
    "Need another stock? Type any ticker below",
    "No profit guarantee and no personalized financial advice",
  ];
  const heroReminders = reminders || defaultReminders;

  return (
    <section className="screener-hero" aria-label="SwingAI screener overview" style={{ "--hero-bg": `url(${heroBg})` }}>
      <div className="hero-grid" />
      <div className="hero-market-scene" aria-hidden="true">
        <svg viewBox="0 0 460 240" role="presentation" focusable="false">
          <defs>
            <linearGradient id="heroTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#00FFB2" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4DA6FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="market-fill" d="M24 184 C62 172, 82 176, 116 154 S168 116, 202 134 S258 142, 292 108 S358 66, 436 78 L436 220 L24 220 Z" />
          <path className="market-trend-blue" d="M18 150 C58 142, 88 156, 124 128 S176 92, 216 112 S270 124, 316 84 S374 58, 444 62" />
          <path className="market-trend" d="M24 184 C62 172, 82 176, 116 154 S168 116, 202 134 S258 142, 292 108 S358 66, 436 78" />
          <circle className="market-dot" cx="202" cy="134" r="3.8" />
          <circle className="market-dot" cx="292" cy="108" r="3.8" />
          <circle className="market-dot" cx="436" cy="78" r="4.4" />
        </svg>
      </div>
      <div className="hero-content">
        <div className="hero-kicker">{kicker}</div>
        <h1 className="hero-title">{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
        <div className="hero-reminders">
          {heroReminders.map(item => <div key={item} className="hero-reminder">{item}</div>)}
        </div>
        {showCta && <button className="hero-cta" onClick={focusTickerInput}>Analyze a Stock</button>}
      </div>
      <div className="hero-chips" aria-hidden="true">
        {chips.map(label => (
          <span key={label} className="hero-chip">{label}</span>
        ))}
      </div>
    </section>
  );
}

const LEGAL_CONTENT = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "Nexus Milestone Inc. may collect limited technical and usage information to operate SwingAI, protect the service, understand product usage, and maintain legal records.",
      "This placeholder policy will be replaced with a full privacy policy before broader public release.",
    ],
  },
  terms: {
    title: "Terms & Agreement",
    body: [
      "By using SwingAI, you agree to use the service for educational and research purposes only and to verify all market data and analysis before making decisions.",
      "This placeholder agreement will be replaced with full terms before broader public release.",
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    body: [
      SAFETY_DISCLAIMER,
      "SwingAI does not connect to a brokerage for order execution. It does not auto-buy, auto-sell, or place trades.",
      "Signals, suggested entries, stops, targets, sizing previews, and exit previews are research aids only. They are not personalized financial advice.",
    ],
  },
  contact: {
    title: "Contact Nexus Milestone Inc.",
    body: [
      "For SwingAI support or business inquiries, please contact Nexus Milestone Inc.",
      CONTACT_EMAIL,
    ],
  },
};

function LegalModal({ type, onClose }) {
  const content = LEGAL_CONTENT[type];
  if (!content) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div id="legal-modal-title" className="modal-title">{content.title}</div>
        <div className="legal-modal-body">
          {content.body.map((paragraph, i) => (
            <p key={i}>
              {paragraph === CONTACT_EMAIL ? <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a> : paragraph}
            </p>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AppFooter({ onOpenLegal }) {
  return (
    <footer className="app-footer">
      <div>Nexus Milestone Inc.</div>
      <div className="app-footer-links">
        <button className="app-footer-link" type="button" onClick={() => onOpenLegal("privacy")}>Privacy Policy</button>
        <button className="app-footer-link" type="button" onClick={() => onOpenLegal("terms")}>Terms &amp; Agreement</button>
        <button className="app-footer-link" type="button" onClick={() => onOpenLegal("disclaimer")}>Disclaimer</button>
        <button className="app-footer-link" type="button" onClick={() => onOpenLegal("contact")}>Contact</button>
      </div>
    </footer>
  );
}

function SafetyNote({ compact = false }) {
  return (
    <div className="note" style={{ marginTop: compact ? 8 : 12, fontSize: compact ? 11 : 12 }}>
      {SAFETY_DISCLAIMER}
    </div>
  );
}

function PageBrief({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 14, borderColor: "rgba(77,166,255,0.22)", background: "rgba(77,166,255,0.045)" }}>
      <div className="card-title">{title}</div>
      <div style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function FreshnessLine({ items = [] }) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
      {filtered.map(item => <span key={item} className="tag" style={{ fontSize: 10 }}>{item}</span>)}
    </div>
  );
}

function PositionBar({ entry, current, target, stop }) {
  const range = target - stop;
  if (!range || range <= 0) return null;
  const filled = Math.min(Math.max(((current - stop) / range) * 100, 0), 100);
  return (
    <div className="pos-progress">
      <div className="pos-fill" style={{ width: `${filled}%`, background: "linear-gradient(90deg, rgba(255,77,77,.4) 0%, rgba(251,176,36,.5) 40%, rgba(0,255,178,.5) 100%)" }} />
      <div className="pos-marker" style={{ left: `${Math.min(Math.max(((entry - stop) / range) * 100, 1), 99)}%` }} />
    </div>
  );
}

function PriceReliabilityBadge({ position }) {
  if (!position?.fallback_to_entry && !position?.quote_is_stale && position?.data_freshness !== "stale") return null;
  return (
    <span
      className="badge"
      title={`Price source: ${position.quote_source || position.price_source || "unknown"}${position.quote_updated_at ? ` | Updated: ${formatQuoteTimeEt(position.quote_updated_at)}` : ""}`}
      style={{
        background: "rgba(251, 176, 36, .12)",
        color: "var(--amber)",
        borderColor: "rgba(251, 176, 36, .35)",
        fontSize: 9,
        marginTop: 3,
      }}
    >
      data stale
    </span>
  );
}

function MarketRegimeBadge({ analysis }) {
  const regime = analysis?.market_regime || analysis?.market_regime_snapshot?.market_regime;
  if (!regime) return null;
  const score = analysis?.market_regime_score ?? analysis?.market_regime_snapshot?.market_regime_score;
  return (
    <span className="badge" title={analysis?.market_regime_reason || analysis?.market_regime_snapshot?.market_regime_reason || ""} style={marketRegimeStyle(regime)}>
      Market {regime}{score != null ? ` ${Number(score).toFixed(0)}` : ""}
    </span>
  );
}

function VolumeConfidenceBadge({ analysis }) {
  const confidence = analysis?.volume_confidence;
  if (!confidence) return null;
  return (
    <span className="badge" title={analysis?.volume_confidence_reason || analysis?.volume_warning || ""} style={VOLUME_CONFIDENCE_STYLE[confidence] || VOLUME_CONFIDENCE_STYLE.Unknown}>
      Volume confidence: {confidence}
    </span>
  );
}

function ActionStatusBadge({ analysis }) {
  const status = analysis?.action_status;
  if (!status && !analysis?.action_label) return null;
  const label = analysis?.action_label || timingLabel(status);
  return (
    <span className="badge" title={analysis?.action_reason || analysis?.entry_block_reason || ""} style={decisionStatusStyle(status)}>
      {label}
    </span>
  );
}

function LeadershipBadge({ analysis }) {
  const label = analysis?.leadership_rank_label;
  if (!label) return null;
  const score = analysis?.leadership_score;
  return (
    <span className="badge" title={analysis?.leadership_reason || analysis?.leadership_warning || ""} style={leadershipStyle(label)}>
      {label}{score != null ? ` ${Number(score).toFixed(0)}` : ""}
    </span>
  );
}

function sectorMappingMissing(analysis) {
  const label = String(analysis?.sector_strength_label || "").trim();
  const sector = String(analysis?.sector_name || "").trim();
  const score = analysis?.sector_strength_score;
  const status = analysis?.sector_mapping_status || analysis?.leadership_metadata_json?.sector_mapping_status || analysis?.details_json?.sector_mapping_status;
  return (
    status === "missing" ||
    label === "Mapping Missing" ||
    (sector.toLowerCase() === "unknown" && label === "Neutral" && Number(score) === 45)
  );
}

function leadershipDetails(analysis) {
  return analysis?.leadership_metadata_json || analysis?.details_json || {};
}

function rsAnomalyFlagged(analysis) {
  const details = leadershipDetails(analysis);
  return Boolean(analysis?.rs_anomaly_flag || details?.rs_anomaly_flag || analysis?.corporate_action_risk || details?.corporate_action_risk);
}

function rsAnomalyReason(analysis) {
  const details = leadershipDetails(analysis);
  return analysis?.rs_anomaly_reason || details?.rs_anomaly_reason || "Relative-strength value may be distorted by a split or ADS ratio change.";
}

function rsValueAnomalous(analysis, key) {
  const value = Number(analysis?.[key]);
  if (!Number.isFinite(value)) return false;
  const details = leadershipDetails(analysis);
  const fields = analysis?.rs_anomaly_fields || details?.rs_anomaly_fields || [];
  return fields.includes(key) || Math.abs(value) > Number(analysis?.rs_anomaly_threshold || details?.rs_anomaly_threshold || 300);
}

function rsCellValue(analysis, key) {
  if (rsAnomalyFlagged(analysis) && rsValueAnomalous(analysis, key)) {
    return <span className="badge" title={rsAnomalyReason(analysis)} style={leadershipStyle("Laggard")}>Data anomaly</span>;
  }
  return fmtPctSigned(analysis?.[key]);
}

function SectorStrengthBadge({ analysis }) {
  const label = analysis?.sector_strength_label;
  if (!label && !analysis?.sector_name) return null;
  if (sectorMappingMissing(analysis)) {
    return (
      <span className="badge" title="Ticker sector mapping is missing." style={sectorStrengthStyle("Mapping Missing")}>
        Sector mapping missing
      </span>
    );
  }
  const score = analysis?.sector_strength_score;
  const sector = analysis?.sector_name || analysis?.sector_etf || "Sector";
  return (
    <span className="badge" title={analysis?.sector_strength_reason || ""} style={sectorStrengthStyle(label)}>
      {sector}: {label || "Unknown"}{score != null ? ` ${Number(score).toFixed(0)}` : ""}
    </span>
  );
}

function RelativeStrengthBadge({ analysis }) {
  const rs = analysis?.rs_3m_vs_spy ?? analysis?.rs_1m_vs_spy;
  if (rs == null || rs === "") return null;
  if (rsAnomalyFlagged(analysis) && rsValueAnomalous(analysis, "rs_3m_vs_spy")) {
    return (
      <span className="badge" title={rsAnomalyReason(analysis)} style={leadershipStyle("Laggard")}>
        RS data anomaly
      </span>
    );
  }
  return (
    <span className="badge" title={`1M vs SPY ${fmtPctSigned(analysis?.rs_1m_vs_spy)} | 3M vs SPY ${fmtPctSigned(analysis?.rs_3m_vs_spy)} | 1M vs sector ${fmtPctSigned(analysis?.rs_1m_vs_sector)} | 3M vs sector ${fmtPctSigned(analysis?.rs_3m_vs_sector)}`} style={Number(rs) >= 0 ? leadershipStyle("Constructive") : leadershipStyle("Laggard")}>
      RS vs SPY 3M {fmtPctSigned(analysis?.rs_3m_vs_spy)}
    </span>
  );
}

function BoardRankBadge({ analysis }) {
  const rank = analysis?.current_leadership_rank;
  const label = analysis?.leadership_board_label || analysis?.leadership_trend;
  if (rank == null && !label) return null;
  return (
    <span className="badge" title={analysis?.leadership_trend || ""} style={leadershipStyle(label === "Top Leader" ? "Leader" : label === "Strong Leader" ? "Emerging Leader" : label)}>
      {rank != null ? `Rank #${rank}` : label}{label ? ` ${label}` : ""}
    </span>
  );
}

function AnalysisMetaBadges({ analysis }) {
  if (!analysis) return null;
  return (
    <>
      <MarketRegimeBadge analysis={analysis} />
      <SectorStrengthBadge analysis={analysis} />
      <LeadershipBadge analysis={analysis} />
      <BoardRankBadge analysis={analysis} />
      <RelativeStrengthBadge analysis={analysis} />
      <VolumeConfidenceBadge analysis={analysis} />
    </>
  );
}

const GUEST_DISCLAIMER_CHECKS = [
  "I understand SwingAI is a trading research and alert assistant only.",
  "I understand SwingAI does not place trades, auto-buy, auto-sell, or guarantee outcomes.",
  "I understand this is not personalized financial advice.",
  "I understand I am fully responsible for my own trading, brokerage activity, and risk management.",
  "I agree to the Terms of Use and Disclaimer.",
];

const TERMS_SECTIONS = [
  ["1. Public Guest-View Website Only", "This website provides a public guest-view display of selected AI stock scanner information. Guest users may view certain scanner results and general market-related information. Guest users cannot access private admin features, portfolio information, trading accounts, alerts, API settings, user accounts, or any restricted dashboard areas. We may change, limit, suspend, or remove guest-view access at any time without notice."],
  ["2. Educational and Informational Use Only", "All content on this website is provided for educational and informational purposes only. The website may display tickers, AI scanner scores, technical setups, indicator summaries, watchlist entries, price-related information, change percentages, risk levels, target zones, stop zones, model confidence estimates, AI-generated explanations, and last scanned time. This information is general in nature and does not consider your financial situation, objectives, risk tolerance, investment knowledge, tax situation, or personal circumstances."],
  ["3. No Financial Advice", "Nothing on this website is financial, investment, trading, legal, tax, accounting, or professional advice. Nexus Milestone Inc. does not recommend that you buy, sell, hold, short, trade, or invest in any security, stock, option, ETF, cryptocurrency, derivative, financial product, or investment. Any scanner result, score, setup, target zone, stop zone, confidence estimate, or AI explanation is a general informational output only and is not a personalized recommendation."],
  ["4. No Advisor, Broker, Dealer, or Fiduciary Relationship", "Your use of this website does not create any advisor-client, broker-client, dealer-client, fiduciary, professional, agency, partnership, joint venture, or employment relationship between you and Nexus Milestone Inc. Nexus Milestone Inc. does not manage money, execute trades, provide brokerage services, provide portfolio management, or make investment decisions for users. You are solely responsible for all decisions you make."],
  ["5. Trading and Investment Risk", "Trading and investing involve risk. You understand and agree that you can lose money, you can lose your entire investment, market prices can change quickly, scanner results can be wrong, AI analysis can be wrong, technical indicators can fail, target zones and stop zones are not guarantees, model confidence or win-rate estimates are not promises of profit, past performance does not guarantee future results, and market data may be delayed, incomplete, inaccurate, or unavailable."],
  ["6. Delayed and Inaccurate Data Risk", "The website may use market data from third-party sources, APIs, brokers, exchanges, or public information sources. Information shown may be delayed, incomplete, inaccurate, unavailable, or different from prices or data shown by your broker or other sources. You must verify all prices, quotes, and trading information directly with your broker or another reliable source before making any decision."],
  ["7. AI-Generated Content", "The website may use artificial intelligence, algorithms, automation, scoring models, or third-party AI tools. AI-generated content may be inaccurate, incomplete, outdated, biased, unsuitable, or misleading. You agree not to rely on AI-generated content as financial advice or guaranteed truth. Nexus Milestone Inc. does not guarantee the accuracy, completeness, reliability, usefulness, or suitability of any AI-generated content."],
  ["8. No Guarantee of Results", "Nexus Milestone Inc. does not guarantee profits, trading success, investment returns, accuracy of scanner results, accuracy of AI analysis, accuracy of market data, future performance, identification of winning trades, avoidance of losing trades, continuous website availability, or any specific financial result."],
  ["9. User Responsibility", "You are solely responsible for your own financial decisions, research, risk management, broker account activity, tax consequences, investment gains or losses, verifying information before relying on it, and complying with applicable laws and regulations. You agree that you will not rely on this website as your only source of information."],
  ["10. Third-Party Services and Links", "This website may contain information from, references to, or links to third-party services, APIs, websites, market data providers, news sources, brokers, advertisers, or external content. Nexus Milestone Inc. does not control third-party services and is not responsible for their accuracy, availability, policies, actions, content, or failures."],
  ["11. Advertising and Sponsored Content", "This website may display advertisements, affiliate links, sponsored content, or promotional material. Advertisements or sponsored content do not represent financial advice, investment advice, endorsement, or recommendation by Nexus Milestone Inc. You are responsible for evaluating any advertiser, product, service, or offer before using it."],
  ["12. Acceptable Use", "You agree not to copy, scrape, reproduce, or redistribute website content without permission; use automated bots or scraping tools against the website; attempt to access private admin areas; attempt to bypass security controls; misuse scanner results as guaranteed recommendations; republish content as your own financial advice; use the website for unlawful purposes; or interfere with website operation or security."],
  ["13. Intellectual Property", "All website content, design, layout, scanner presentation, AI-generated summaries, branding, text, software, workflows, and related materials are owned by or licensed to Nexus Milestone Inc., unless otherwise stated. You may view the website for personal informational use only."],
  ["14. No Warranties", "The website and all content are provided on an as is and as available basis. To the maximum extent permitted by law, Nexus Milestone Inc. disclaims all warranties, representations, and conditions, whether express, implied, statutory, or otherwise, including warranties of accuracy, completeness, reliability, merchantability, fitness for a particular purpose, non-infringement, uninterrupted operation, security, and error-free performance."],
  ["15. Limitation of Liability", "To the maximum extent permitted by law, Nexus Milestone Inc., its directors, officers, shareholders, employees, contractors, developers, affiliates, service providers, and licensors will not be liable for any direct, indirect, incidental, consequential, special, punitive, exemplary, or other damages arising from or related to your use of this website, including trading losses, investment losses, lost profits, lost opportunities, incorrect scanner results, incorrect AI analysis, market data errors, delayed information, software errors, website outages, third-party service failures, or decisions made after viewing the website. If liability cannot be fully excluded, total liability will be limited to CAD $100."],
  ["16. Indemnification", "You agree to indemnify, defend, and hold harmless Nexus Milestone Inc., its directors, officers, shareholders, employees, contractors, developers, affiliates, service providers, and licensors from any claims, losses, damages, liabilities, costs, expenses, or demands arising from your use of the website, your trading or investment decisions, your violation of these Terms, your misuse of scanner results, your violation of laws or regulations, your unauthorized copying, scraping, sharing, or redistribution of website content, or any claim made by another person based on your use or sharing of website content."],
  ["17. Privacy and Analytics", "We may collect limited technical and usage information, such as IP address, device information, browser type, approximate location, pages viewed, timestamps, cookie data, analytics data, and disclaimer acceptance records. This information may be used to operate the website, improve the service, protect security, analyze usage, prevent abuse, and maintain legal records."],
  ["18. Changes to These Terms", "Nexus Milestone Inc. may update these Terms at any time. The updated version will be posted on this website with a new effective date. Continued use of the website after changes are posted means you accept the updated Terms."],
  ["19. Governing Law", "These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein. Any dispute relating to these Terms or the website will be handled in the courts located in Ontario, Canada, unless applicable law requires otherwise."],
  ["20. Final Acknowledgement", "By using this website, you confirm that you understand this website is for educational and informational purposes only; Nexus Milestone Inc. does not provide financial advice; scanner results are not recommendations; market data and AI outputs may be inaccurate or delayed; trading and investing involve risk; you accept full responsibility for your own decisions; and you agree not to hold Nexus Milestone Inc. responsible for trading losses, investment losses, missed opportunities, or decisions made after using this website. If you do not agree, you must stop using this website immediately."],
];

function TermsContent() {
  return (
    <div className="guest-terms">
      <h3>Website Terms of Use and Disclaimer</h3>
      <p><b>Effective Date:</b> May 31, 2026</p>
      <p><b>Company:</b> Nexus Milestone Inc.</p>
      <p><b>Website/App Name:</b> SwingAI</p>
      <p><b>Contact:</b> <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a></p>
      <p>These Website Terms of Use and Disclaimer apply to your access to and use of the public guest-view website, scanner results, AI-generated analysis, watchlists, tables, reports, charts, content, and related information provided by Nexus Milestone Inc. ("Nexus Milestone," "we," "us," or "our").</p>
      <p>By accessing or using this website, you agree to these Terms. If you do not agree, do not use this website.</p>
      {TERMS_SECTIONS.map(([title, text]) => (
        <section key={title}>
          <h4>{title}</h4>
          <p>{text}</p>
        </section>
      ))}
    </div>
  );
}

function GuestDisclaimerModal({ readOnlyTerms = false, onAccept, onClose }) {
  const [checks, setChecks] = useState(() => GUEST_DISCLAIMER_CHECKS.map(() => false));
  const [showTerms, setShowTerms] = useState(readOnlyTerms);
  const allChecked = checks.every(Boolean);

  const accept = () => {
    const acceptedAt = markGuestTermsAccepted();
    // TODO: Add backend acceptance logging if a database table/API is added.
    onAccept?.(acceptedAt);
  };

  return (
    <div className="guest-disclaimer-overlay" role="dialog" aria-modal="true" aria-labelledby="guest-disclaimer-title">
      <div className="guest-disclaimer-modal">
        <div className="guest-disclaimer-kicker">Important Disclaimer</div>
        <div id="guest-disclaimer-title" className="guest-disclaimer-title">Before viewing this AI stock scanner, please read and agree.</div>
        <div className="guest-disclaimer-text">
          <p>This website is operated by Nexus Milestone Inc. and provides general AI-generated stock scanner results for educational and informational purposes only.</p>
          <p>This website does not provide financial advice, investment advice, trading advice, legal advice, tax advice, or portfolio management services. Nexus Milestone Inc. is not your financial advisor, broker, dealer, portfolio manager, or fiduciary.</p>
          <p>The scanner may show tickers, scores, setups, indicators, price-related information, target zones, stop zones, risk levels, confidence estimates, and AI-generated explanations. These are general scanner outputs only. They are not instructions or recommendations to buy, sell, hold, short, trade, or invest in any security.</p>
          <p>Prices and data may be delayed, incomplete, inaccurate, or different from your broker or other data sources. AI analysis and scanner results may be wrong, outdated, incomplete, or unsuitable for your situation.</p>
          <p>Stock trading and investing involve risk. You can lose money, including your entire investment. Past performance, AI scores, scanner results, technical indicators, model confidence, or historical patterns do not guarantee future results.</p>
          <p>By continuing, you agree that you will make your own independent decisions, verify all information yourself, and accept full responsibility for your own trading and investment decisions. You agree not to hold Nexus Milestone Inc., its owners, directors, officers, employees, contractors, developers, affiliates, or service providers responsible for any trading losses, investment losses, missed opportunities, data errors, software errors, AI errors, API failures, delayed information, or decisions you make after viewing this website.</p>
        </div>

        <div className="guest-warning-row" aria-label="Key warnings">
          <span className="guest-warning-badge">Last scanned prices may be delayed</span>
          <span className="guest-warning-badge">Scanner results are not recommendations</span>
          <span className="guest-warning-badge">Not financial advice</span>
        </div>

        {!readOnlyTerms && (
          <div className="guest-checks">
            {GUEST_DISCLAIMER_CHECKS.map((label, index) => (
              <label className="guest-check" key={label}>
                <input
                  type="checkbox"
                  checked={checks[index]}
                  onChange={e => setChecks(prev => prev.map((checked, i) => i === index ? e.target.checked : checked))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="modal-actions">
          {readOnlyTerms ? (
            <button className="btn btn-ghost" onClick={onClose}>Back to Screener</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setShowTerms(v => !v)}>{showTerms ? "Hide Terms" : "Read More"}</button>
              <button className="btn btn-green" onClick={accept} disabled={!allChecked}>I Understand and Agree</button>
            </>
          )}
        </div>

        {showTerms && <TermsContent />}
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage({ embedded = false }) {
  const [email, setEmail] = useState("katiepham2302@gmail.com");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault(); setLoading(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setErr(error.message);
    setLoading(false);
  };

  const box = (
      <div className="login-box fade-up">
        <div className="login-logo">SwingAI</div>
        <div className="login-sub">Intelligent Swing Trading Platform</div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} type="email" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input className="input" value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="••••••••" autoFocus />
          </div>
          <button className="btn btn-green" style={{ width: "100%", padding: 10 }} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        {err && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>{err}</div>}
        <div style={{ marginTop: 16, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
          Semi-Automated · AI-Powered · Review Before Trading
        </div>
      </div>
  );

  return embedded ? box : <div className="login-screen">{box}</div>;
}

// ─── Market Today ─────────────────────────────────────────────────────────────
function formatCompactNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMarketPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function formatMarketPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatMarketUpdated(value) {
  if (!value) return "Pending scheduled update";
  try {
    return `${new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`;
  } catch {
    return value;
  }
}

function formatLocalDateTime(value) {
  if (!value) return "-";
  try {
    const raw = String(value);
    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const normalized = hasTimezone ? raw : `${raw}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return raw;
    return `${date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })} local`;
  } catch {
    return String(value);
  }
}

function parseQuoteTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  try {
    if (typeof value === "number") {
      const epoch = Math.abs(value) >= 1_000_000_000_000 ? value : value * 1000;
      const date = new Date(epoch);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{10,13}$/.test(raw)) {
      const numeric = Number(raw);
      const epoch = raw.length >= 13 ? numeric : numeric * 1000;
      const date = new Date(epoch);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(hasTimezone ? raw : `${raw}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatQuoteTimeEt(value) {
  const date = parseQuoteTimestamp(value);
  if (!date) return "unavailable";
  return `${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })} ET`;
}

function MarketTable({ title, rows = [], showDollarVolume = false, message = "", unavailableMessage = "" }) {
  const emptyMessage = message || unavailableMessage || "No cached rows yet.";
  return (
    <div className="card market-table-card">
      <div className="card-title">{title}</div>
      {rows.length === 0 ? (
        <div className="empty" style={{ padding: "22px 0" }}><p>{emptyMessage}</p></div>
      ) : (
        <div className="table-wrap market-table-wrap">
          <table className={`market-table${showDollarVolume ? " has-dollar-volume" : ""}`}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Price</th>
                <th><span className="market-col-label-full">Change</span><span className="market-col-label-mobile">Chg</span></th>
                <th>Volume</th>
                {showDollarVolume && <th><span className="market-col-label-full">Dollar Vol</span><span className="market-col-label-mobile">$ Vol</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => {
                const pct = Number(row.change_pct);
                return (
                  <tr key={`${row.ticker}-${i}`}>
                    <td style={{ fontWeight: 800 }}>{row.ticker}</td>
                    <td>{formatMarketPrice(row.price)}</td>
                    <td style={{ color: Number.isFinite(pct) ? PNL_COLOR(pct) : "var(--muted)" }}>{formatMarketPct(row.change_pct)}</td>
                    <td>{formatCompactNumber(row.volume)}</td>
                    {showDollarVolume && <td>{formatCompactNumber(row.dollar_volume)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MarketTodayPage({ admin = false }) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [refreshStatus, setRefreshStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    api("/api/market-today").then(({ data, error }) => {
      if (!mounted) return;
      setMarket(data || null);
      setError(error || "");
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const summary = market?.market_snapshot_summary || {};
  const snapshotUnavailable = summary.available === false;
  const pendingMarketMessage = "Market Today data will update after the next scheduled refresh. The cache may be empty after a backend redeploy.";
  const marketStatusMessage = market?.message === "Market Today data will update after the next scheduled fetch."
    ? pendingMarketMessage
    : market?.message;
  const stockStaleTime = market?.stock_updated_at ? formatLocalDateTime(market.stock_updated_at) : "an earlier refresh";
  const stockStaleWarning = market?.stock_data_stale
    ? `Market movers are temporarily showing cached data from ${stockStaleTime}. News is updated separately.`
    : "";
  const marketHeroReminders = [
    "Market overview only - not a buy/sell signal",
    "Swing trading context, not day-trading advice",
    "Market data updates on a scheduled cache",
    "Always verify before making decisions",
  ];

  const refreshMarketToday = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    setRefreshStatus("");
    const { data, error } = await api("/api/market-today/refresh", { method: "POST" });
    setRefreshing(false);
    if (error) {
      setRefreshError(error);
      return;
    }
    setMarket(data || null);
    setError("");
    setRefreshStatus(data?.source ? `Market Today refreshed from ${data.source}.` : "Market Today refreshed.");
  };

  return (
    <div className="fade-up">
      <ScreenerHero
        kicker="Market Overview"
        title="Market Today"
        subtitle="U.S. market overview, movers, and news for swing-trading context"
        reminders={marketHeroReminders}
        chips={["BREADTH", "MOVERS", "VOLUME", "NEWS", "CACHE"]}
        showCta={false}
      />
      <PageBrief title="Market Today">
        Market regime, movers, volume, and news are context for research only. This page is not a buy list and does not trigger trades.
      </PageBrief>
      {admin && (
        <div className="card" style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>Market Today Refresh</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Admin-only backend refresh for cached market data.</div>
          </div>
          <button className="btn btn-green" onClick={refreshMarketToday} disabled={refreshing}>
            {refreshing ? "Refreshing Market Today..." : "Refresh Market Today"}
          </button>
          {refreshError && <div className="err-box" style={{ width: "100%", marginBottom: 0 }}>{refreshError}</div>}
          {refreshStatus && <div className="ok-box" style={{ width: "100%", marginBottom: 0 }}>{refreshStatus}</div>}
        </div>
      )}

      {loading && <div className="card"><div className="spin" style={{ width: 22, height: 22 }} /></div>}
      {!loading && (error || !market?.available) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Market Today</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {error || marketStatusMessage || pendingMarketMessage}
          </div>
        </div>
      )}
      {!loading && market?.available && snapshotUnavailable && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Market Snapshot</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Market breadth summary is unavailable on the current data plan.</div>
        </div>
      )}
      {!loading && market?.available && stockStaleWarning && (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(251,176,36,0.35)", background: "rgba(251,176,36,0.08)" }}>
          <div style={{ color: "var(--amber)", fontSize: 13, lineHeight: 1.5 }}>
            {stockStaleWarning}
            {market?.stock_stale_reason && <span style={{ color: "var(--muted)" }}> {market.stock_stale_reason}</span>}
          </div>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 16 }}>
        {[
          { label: "Advancers", val: formatCompactNumber(summary.advancers), sub: "stocks up", color: "var(--green)" },
          { label: "Decliners", val: formatCompactNumber(summary.decliners), sub: "stocks down", color: "var(--red)" },
          { label: "Total Volume", val: formatCompactNumber(summary.total_volume), sub: "estimated shares", color: "var(--blue)" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.className || ""}`} style={{ color: s.color }}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <MarketTable title="Top Gainers" rows={market?.top_gainers || []} message={market?.top_gainers_message || "Yahoo market data is temporarily unavailable. Scheduled refresh will try again later."} />
        <MarketTable title="Top Losers" rows={market?.top_losers || []} message={market?.top_losers_message || "Yahoo market data is temporarily unavailable. Scheduled refresh will try again later."} />
      </div>

      <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <MarketTable title="Top 20 by Volume" rows={market?.most_active || []} message="Volume movers are temporarily unavailable. Scheduled refresh will try again later." />
        <MarketTable title="Top 20 by Dollar Volume" rows={market?.highest_volume || []} showDollarVolume message="Volume movers are temporarily unavailable. Scheduled refresh will try again later." />
      </div>

      <div className="card">
        <div className="card-title">News / Events</div>
        {(market?.news || []).length > 0 ? (
          (market.news || []).slice(0, 10).map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noreferrer" style={{ display: "block", color: "var(--text2)", textDecoration: "none", padding: "10px 0", borderBottom: "1px solid var(--border2)" }}>
              <div style={{ fontWeight: 500, fontSize: 13, color: "rgba(223,232,244,0.78)" }}>{item.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>
                {[item.publisher, formatMarketUpdated(item.published_at), ...(item.tickers || []).slice(0, 3)].filter(Boolean).join(" · ")}
              </div>
            </a>
          ))
        ) : (
          <div className="empty" style={{ padding: "22px 0" }}><p>News will update after the next scheduled Market Today refresh.</p></div>
        )}
      </div>
    </div>
  );
}

// ─── Screener ─────────────────────────────────────────────────────────────────
function SingleTickerCheck({ guest = false }) {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [guestZoneAccepted, setGuestZoneAccepted] = useState(() => !guest || sessionFlag(GUEST_ZONE_DISCLAIMER_KEY));
  const [showGuestZoneDisclaimer, setShowGuestZoneDisclaimer] = useState(false);

  const checkTicker = async () => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol || loading || limitReached) return;
    setLoading(true);
    setError("");
    const { data, error } = await api("/api/screener/single", {
      method: "POST",
      body: JSON.stringify({ ticker: symbol }),
    });
    setLoading(false);
    if (error) {
      setResult(null);
      setError(error);
      if (data?.limit_reached) setLimitReached(true);
      return;
    }
    setResult(data);
    if (typeof data?.guest_scans_remaining === "number") setRemaining(data.guest_scans_remaining);
  };

  const score = result?.score?.score ?? result?.score;
  const setup = result?.score?.setup ?? result?.setup;
  const price = result?.quote?.price ?? result?.price ?? result?.current_price;
  const stop = result?.stop_loss ?? result?.stop;
  const volumeRatio = result?.volume_ratio ?? result?.vol_ratio;
  const formatMoney = value => value == null || value === "" ? "-" : `$${Number(value).toFixed(2)}`;
  const formatNumber = value => value == null || value === "" ? "-" : Number(value).toFixed(2);
  const suggestedZone = result?.suggested_entry_zone;
  const quoteTimestamp = result?.selected_price_timestamp ?? result?.quote?.selected_price_timestamp;
  const quoteTime = formatQuoteTimeEt(quoteTimestamp);
  const priceStale = Boolean(result?.price_stale ?? result?.quote?.price_stale);
  const canShowSuggestedZone = Boolean(suggestedZone && (!guest || guestZoneAccepted));
  const acceptGuestZoneDisclaimer = () => {
    console.log("GUEST_DISCLAIMER_ACCEPTED");
    setSessionFlag(GUEST_ZONE_DISCLAIMER_KEY, true);
    setGuestZoneAccepted(true);
    setShowGuestZoneDisclaimer(false);
  };
  const openGuestZoneDisclaimer = () => {
    console.log("GUEST_ZONE_VIEW_CLICKED");
    console.log("GUEST_DISCLAIMER_OPEN");
    setShowGuestZoneDisclaimer(true);
  };
  const singleTickerColumns = guest
    ? ["Price", "RSI", "Vol Ratio", "Target", "Stop Loss"]
    : ["Price", "Chg%", "RSI", "Vol Ratio", "Target", "Stop Loss", "R:R", "Source"];

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-title">{guest ? "Type stock ticker to check" : "Check Single Ticker"}</div>
      <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
        {guest ? "Check a ticker for a simplified research summary." : "Run a single-stock research check with setup, price, risk, and timing context."}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === "Enter" && checkTicker()}
          placeholder="Type stock ticker to check"
          style={{ flex: "1 1 220px" }}
          disabled={limitReached}
          data-single-ticker-input="true"
        />
        <button className="btn btn-blue" onClick={checkTicker} disabled={loading || limitReached}>
          {loading ? "Checking..." : "Check"}
        </button>
      </div>
      {guest && remaining !== null && !limitReached && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Guest scans left today: {remaining}/20</div>
      )}
      {guest && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Indicators based mainly on Daily candles</div>
      )}
      {error && <div className="err-box" style={{ marginTop: 10 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 12, padding: 12, background: "var(--bg3)", borderRadius: 8, border: "1px solid var(--border2)" }}>
          <SafetyNote compact />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <b style={{ fontFamily: "var(--mono)", fontSize: 16 }}>{result.ticker || ticker.toUpperCase()}</b>
            {score !== undefined && <span className="badge" style={{ color: SCORE_COLOR(score), borderColor: SCORE_COLOR(score) }}>Score {score}</span>}
            {confidenceValue(result) != null && <span className="badge">Confidence {formatConfidence(result)}</span>}
            {setup && <span className="badge">{setup}</span>}
            <AnalysisMetaBadges analysis={result} />
            {price && <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>${Number(price).toFixed(2)}</span>}
            {!guest && <EntryWatchButton analysis={result} compact />}
          </div>
          <FreshnessLine items={[
            quoteTimestamp ? `Quote ${formatFreshness(quoteTimestamp).replace("Updated ", "")}` : null,
            result?.data_source ? `Data source: ${result.data_source}` : null,
            result?.volume_confidence ? `Volume confidence: ${result.volume_confidence}` : null,
          ]} />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>{singleTickerColumns.map(col => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatMoney(result.current_price ?? result.price ?? result.scan_price)}</td>
                  {!guest && <td>{result.change_pct == null ? "-" : `${Number(result.change_pct).toFixed(2)}%`}</td>}
                  <td>{formatNumber(result.rsi)}</td>
                  <td>{volumeRatio == null ? "-" : `${Number(volumeRatio).toFixed(2)}x`}</td>
                  <td>{formatMoney(result.target)}</td>
                  <td>{formatMoney(stop)}</td>
                  {!guest && <td>{result.risk_reward == null ? "-" : `1:${Number(result.risk_reward).toFixed(2)}`}</td>}
                  {!guest && (
                    <td>
                      <div>{result.data_source || "-"}</div>
                      <div style={{ marginTop: 3, fontSize: 10, color: priceStale ? "var(--amber)" : "var(--muted)", lineHeight: 1.3 }}>
                        Quote time: {quoteTime}
                      </div>
                      {priceStale && (
                        <div className="badge" style={{ marginTop: 5, color: "var(--amber)", borderColor: "rgba(251,176,36,0.35)", background: "rgba(251,176,36,0.08)" }}>
                          Price may be stale
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          {result.signals?.length > 0 && (
            <div className="signals-list" style={{ marginTop: 10 }}>{result.signals.map((s, i) => <span key={i} className="signal-pill">{s}</span>)}</div>
          )}
          {confidenceValue(result) != null && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
              Estimated confidence, not historical win rate.
            </div>
          )}
          {!guest && <UnifiedActionCard analysis={result} mode="entry" />}
          {canShowSuggestedZone && (
            <SuggestedEntryZone
              zone={suggestedZone}
              description="Research-only entry zone from this ticker check."
              action={!guest ? <EntryWatchButton analysis={result} /> : null}
              entrySignal={result.entry_signal}
            />
          )}
          {!guest && <PositionSizingPreview sizing={result.position_sizing_preview} heat={result.portfolio_heat_preview} />}
          {!guest && <StructurePlanV2Preview plan={result.entry_plan_v2 || result.entry_plan_v2_json} />}
          {(!guest || guestZoneAccepted) && <DecisionLayerSections analysis={result} compact={guest} />}
          {guest && suggestedZone && !guestZoneAccepted && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "rgba(0,170,255,0.06)" }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>AI Suggested Entry Zone available</div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>View research-only entry analysis.</div>
              <button className="btn btn-blue" onClick={openGuestZoneDisclaimer}>View AI Analysis</button>
            </div>
          )}
          {!guest && result.confirmation_4h && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text2)" }}>
              <span className="tag">Daily Context: 1D</span>
              <span className="tag">Main Setup: 4H</span>
              <span className="tag">Entry Trigger: 1H</span>
              <span>4H trade setup: <b>{result.confirmation_4h.setup || "-"}</b></span>
              <span>4H score: <b>{result.confirmation_4h.score ?? "-"}</b></span>
              <span>4H RSI: <b>{result.confirmation_4h.rsi == null ? "-" : Number(result.confirmation_4h.rsi).toFixed(0)}</b></span>
            </div>
          )}
          {result.analysis && (
            <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: "var(--text2)", whiteSpace: "pre-wrap" }}>{result.analysis}</div>
          )}
        </div>
      )}
      {showGuestZoneDisclaimer && (
        <div className="modal-overlay guest-zone-modal-overlay" onClick={() => setShowGuestZoneDisclaimer(false)}>
          <div className="modal guest-zone-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">AI Research Disclaimer</div>
            <div style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.6, display: "grid", gap: 10 }}>
              <p style={{ margin: 0 }}>
                This Suggested Entry Zone is generated by AI for research and educational purposes only. It is not financial advice, a recommendation to buy or sell, or a guarantee of performance.
              </p>
              <p style={{ margin: 0 }}>
                Stock trading involves risk, and you are responsible for doing your own due diligence before making any investment decision. SwingAI and its operators are not responsible for any trading losses or decisions made based on this analysis.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-blue" onClick={acceptGuestZoneDisclaimer}>I Understand</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GuestScreenerPage() {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openAi, setOpenAi] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api("/api/screener/public-results").then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error);
      if (data) setBoard(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const rows = (board?.results || []).slice().sort((a, b) => {
    const scoreDiff = Number(b?.score || 0) - Number(a?.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a?.ticker || "").localeCompare(String(b?.ticker || ""));
  });
  const meta = board?.metadata || {};
  const scannedAt = meta.scanned_at ? new Date(meta.scanned_at).toLocaleString() : "Latest scheduled scan";
  const priceUpdatedAt = meta.last_price_updated_at ? new Date(meta.last_price_updated_at).toLocaleString() : "Not refreshed yet";
  const analysisUpdatedAt = meta.analysis_updated_at ? new Date(meta.analysis_updated_at).toLocaleString() : scannedAt;
  const universeLabel = meta.universe_source === "active_stocks_200"
    ? "Active Stocks 200"
    : meta.universe_source === "leadership_universe"
      ? "Leadership Universe"
      : meta.universe_source === "leadership_plus_active"
        ? "Leadership + Active Stocks"
    : meta.universe_source
      ? String(meta.universe_source).replace(/_/g, " ")
      : "Active Stocks 200";
  const selectionNote = meta.universe_source === "leadership_universe" || meta.universe_source === "leadership_plus_active"
    ? "Today's board is selected from relative-strength leadership tracking and technical setup quality."
    : "Today's board is selected from active, liquid stocks and technical setup quality.";
  const scannedTickers = meta.universe_source === "active_stocks_200" || meta.universe_source === "cached_market_today_top_200" || !meta.tickers_scanned || Number(meta.tickers_scanned) < 200
    ? 200
    : meta.tickers_scanned;
  const fallbackAi = "This ticker matched SwingAI's setup-quality rules during the latest scheduled scan. Review the chart and risk level before making any trading decision.";

  return (
    <div className="fade-up">
      <ScreenerHero />
      <SingleTickerCheck guest />
      <div className="card" style={{ background: "#080C10", borderColor: "rgba(148,163,184,0.28)", boxShadow: "0 18px 50px rgba(0,0,0,0.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Good Quality Stocks Today</div>
            <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.6, maxWidth: 760, margin: "8px 0 0" }}>
              This list is updated after the 10:30 AM and 1:00 PM ET market scans. {selectionNote} List and ranking are based on the latest scan. Visible prices refresh when available during market hours.
            </p>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>{SAFETY_DISCLAIMER}</div>
          </div>
          <div style={{ minWidth: 220, fontSize: 12, color: "var(--text2)", lineHeight: 1.8 }}>
            <div><b>Scanned:</b> {scannedAt}</div>
            <div><b>Price updated:</b> {priceUpdatedAt}</div>
            <div><b>Analysis updated:</b> {analysisUpdatedAt}</div>
            <div><b>Market session:</b> {meta.scan_session || "Latest scheduled scan"}</div>
            <div><b>Selection:</b> {universeLabel}</div>
            <div><b>Stocks reviewed:</b> {scannedTickers}</div>
            <div><b>Sort:</b> Highest setup quality first</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>Simple public view. Admin-only V1/V2, provider, system health, and alert-engine internals are hidden.</div>
        {error && <div className="err-box">{error}</div>}
        {loading ? (
          <div className="empty">Loading public screener board...</div>
        ) : rows.length === 0 ? (
          <div className="empty">No guest screener results are available yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th><th>Setup</th><th>Latest Analysis Score</th><th>Price</th><th>Target</th><th>Stop</th><th>AI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ticker}>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{r.ticker}</td>
                    <td>{r.setup || "-"}</td>
                    <td style={{ color: SCORE_COLOR(r.score || 0), fontWeight: 700 }}>
                      {r.score ?? "-"}
                      {r.score_stale && <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 400 }}>price refreshed after analysis</div>}
                    </td>
                    <td>
                      {r.current_price ? `$${Number(r.current_price).toFixed(2)}` : "-"}
                      {r.last_price_updated_at && <div style={{ color: "var(--muted)", fontSize: 10 }}>Price {new Date(r.last_price_updated_at).toLocaleTimeString()}</div>}
                    </td>
                    <td>{r.target ? `$${Number(r.target).toFixed(2)}` : "-"}</td>
                    <td>{r.stop ? `$${Number(r.stop).toFixed(2)}` : "-"}</td>
                    <td><button className="btn btn-blue" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => setOpenAi(openAi === r.ticker ? null : r.ticker)}>AI</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {openAi && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(77,166,255,0.08)", border: "1px solid rgba(77,166,255,0.24)", fontSize: 13, lineHeight: 1.6 }}>
                {(rows.find(r => r.ticker === openAi)?.ai_summary) || fallbackAi}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenerPage({ onScanComplete, readOnly = false }) {
  const [results, setResults]     = useState([]);
  const [removedResults, setRemovedResults] = useState([]);
  const [qualityRefresh, setQualityRefresh] = useState(null);
  const [screenerMeta, setScreenerMeta] = useState(null);
  const [universePreview, setUniversePreview] = useState(null);
  const [previewErr, setPreviewErr] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState("");
  const [errMsg, setErrMsg]       = useState("");
  const [minScore, setMinScore]   = useState(60);
  const [customTickers, setCustomTickers] = useState("");
  const [sortBy, setSortBy]       = useState("score");
  const [filterSetup, setFilterSetup] = useState("All");
  const [selected, setSelected]   = useState(null);
  const [analysis, setAnalysis]   = useState(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [alertSent, setAlertSent] = useState({});

  const loadScreenerResults = useCallback(async () => {
    const { data } = await api("/api/screener/results");
    if (data?.results) setResults(data.results);
    if (data) setRemovedResults(data.removed_results || []);
    if (data) setQualityRefresh(data.quality_refresh || null);
    if (data) setScreenerMeta(data);
  }, []);

  const loadUniversePreview = useCallback(async () => {
    if (readOnly) return;
    setPreviewLoading(true);
    setPreviewErr("");
    const { data, error } = await api("/api/screener/universe-preview?limit=200");
    if (error) setPreviewErr(error);
    if (data) setUniversePreview(data);
    setPreviewLoading(false);
  }, [readOnly]);

  useEffect(() => {
    if (!loading) loadScreenerResults();
    if (!readOnly) loadUniversePreview();
    const refresh = () => {
      if (!loading) loadScreenerResults();
    };
    const refreshInterval = setInterval(refresh, 60000);
    return () => clearInterval(refreshInterval);
  }, [loadScreenerResults, loadUniversePreview, loading, readOnly]);

  const runScan = async () => {
    if (readOnly) return;
    setLoading(true); setErrMsg(""); setProgress("Starting scan…");
    const tickers = customTickers.trim()
      ? customTickers.split(/[\s,]+/).map(t => t.trim().toUpperCase()).filter(Boolean)
      : null;

    const { data, error } = await api("/api/screener/scan", {
      method: "POST",
      body: JSON.stringify({ tickers, min_score: minScore }),
    });
    if (error) {
      setErrMsg(`Scan failed: ${error}`);
      setProgress("");
      setLoading(false);
      return;
    }

    // Poll /api/screener/status until done
    const poll = setInterval(async () => {
      const { data: s } = await api("/api/screener/status");
      if (!s) return;
      setProgress(s.progress || "Scanning…");
      if (s.results?.length) setResults(s.results);
      if (s.status === "done") {
        clearInterval(poll);
        setResults(s.results || []);
        setProgress(`✓ Scan complete — ${s.count} stock${s.count !== 1 ? "s" : ""} scored ≥${minScore}${s.count === 0 ? ". Try lowering Min Score." : ""}`);
        setLoading(false);
        if (typeof onScanComplete === "function") onScanComplete();
      }
    }, 3000);
  };

  const analyzeStock = async ticker => {
    if (readOnly) return;
    setSelected(ticker); setAnalyzeLoading(true); setAnalysis(null);
    const { data, error } = await api("/api/ai/analyze", { method: "POST", body: JSON.stringify({ ticker }) });
    setAnalysis(error ? { error } : data);
    setAnalyzeLoading(false);
  };

  const sendAlert = async ticker => {
    if (readOnly) return;
    setAlertSent(p => ({ ...p, [ticker]: "sending" }));
    await api(`/api/alerts/send-buy?ticker=${ticker}`, { method: "POST" });
    setAlertSent(p => ({ ...p, [ticker]: "sent" }));
    setTimeout(() => setAlertSent(p => ({ ...p, [ticker]: null })), 3000);
  };

  const formatEtTime = value => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    } catch {
      return "";
    }
  };

  const removedReasonLabel = row => {
    const reason = row.disqualification_reason || "";
    if (row.status === "stopped_out") return "Price broke below stop loss";
    if (reason.toLowerCase().includes("score")) return "Score dropped below 60";
    return reason || "Removed after quality check";
  };

  const setups   = ["All", ...new Set(results.map(r => r.setup).filter(Boolean))];
  const filtered = results
    .filter(r => filterSetup === "All" || r.setup === filterSetup)
    .sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "winrate" ? (confidenceValue(b) || 0) - (confidenceValue(a) || 0) : b.price - a.price);

  return (
    <div className="fade-up">
      <ScreenerHero />
      <PageBrief title="Screener">
        Scans the selected universe and applies setup, entry, and risk logic. Suggested entries, stops, targets, and sizing previews are planning estimates only.
      </PageBrief>
      <SingleTickerCheck />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, fontSize: 12, color: "var(--text2)" }}>
        <span className="tag">Daily Context: 1D</span>
        <span className="tag">Main Setup: 4H</span>
        <span className="tag">Entry Trigger: 1H</span>
      </div>

      {!readOnly && (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(77,166,255,0.24)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="section-title">Scanner Universe</div>
              <div className="section-sub">
                Leadership Universe is experimental. It changes which stocks are scanned, not the entry timing rules.
              </div>
            </div>
            <button className="btn btn-ghost" onClick={loadUniversePreview} disabled={previewLoading} style={{ padding: "5px 10px", fontSize: 11 }}>
              {previewLoading ? "Refreshing..." : "Refresh Preview"}
            </button>
          </div>
          {previewErr && <div className="err-box" style={{ marginTop: 10, marginBottom: 0 }}>{previewErr}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 11 }}>
            <span className="tag">Mode: {String(universePreview?.universe_mode || screenerMeta?.universe_mode || "active_stocks_200").replace(/_/g, " ")}</span>
            <span className="tag">Candidates: {universePreview?.count ?? screenerMeta?.tickers_scanned ?? "-"}</span>
            <span className="tag">Leadership: {universePreview?.leadership_universe_count ?? screenerMeta?.leadership_universe_count ?? 0}</span>
            <span className="tag">Active fill: {universePreview?.active_fill_count ?? screenerMeta?.active_fill_count ?? 0}</span>
            {(universePreview?.latest_leadership_board_snapshot_time || screenerMeta?.leadership_board_snapshot_time) && (
              <span className="tag">Board: {formatEtTime(universePreview?.latest_leadership_board_snapshot_time || screenerMeta?.leadership_board_snapshot_time)} ET</span>
            )}
            {(universePreview?.fallback_warning || screenerMeta?.universe_warning) && (
              <span className="tag" style={{ color: "var(--amber)", borderColor: "rgba(251,176,36,0.35)" }}>
                {universePreview?.fallback_warning || screenerMeta?.universe_warning}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Tickers (leave blank for full scan of 80+ stocks)</label>
            <input className="input" placeholder="e.g. AAPL MSFT NVDA TSLA" value={customTickers}
              onChange={e => setCustomTickers(e.target.value)} onKeyDown={e => e.key === "Enter" && runScan()} style={{ fontSize: 12 }} disabled={readOnly} />
          </div>
          <div style={{ minWidth: 110 }}>
            <label>Min Score</label>
            <input className="input" type="number" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ width: "100%" }} disabled={readOnly} />
          </div>
          <button className="btn btn-green" onClick={runScan} disabled={loading || readOnly} style={{ padding: "8px 20px", alignSelf: "flex-end" }}>
            {readOnly ? "Sign in to Scan" : loading ? "⏳ Scanning…" : "▶ Run Scan"}
          </button>
        </div>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div className="spin" style={{ width: 16, height: 16, borderWidth: 2, marginBottom: 0 }} />
            <span style={{ fontSize: 12, color: "var(--amber)" }} className="pulse">{progress}</span>
          </div>
        )}
        {!loading && progress && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{progress}</div>}
        {errMsg && <div className="err-box" style={{ marginTop: 10, marginBottom: 0 }}>{errMsg}</div>}
        {qualityRefresh?.last_checked_at && (
          <div className="ok-box" style={{ marginTop: 10, marginBottom: 0, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              Last quality check: {formatEtTime(qualityRefresh.last_checked_at)} ET. {qualityRefresh.removed_count || 0} ticker{qualityRefresh.removed_count === 1 ? "" : "s"} removed because they no longer met the score rule or broke stop loss.
            </span>
            {removedResults.length > 0 && (
              <button className="btn btn-ghost" style={{ padding: "4px 9px", fontSize: 10 }} onClick={() => setShowRemoved(v => !v)}>
                {showRemoved ? "Hide removed tickers" : "View removed tickers"}
              </button>
            )}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>
          💡 <b>Tip:</b> Type <b>AAPL MSFT NVDA</b> for a quick 3-stock test first.
        </div>
      </div>

      {filtered.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Active Screener List · {filtered.length} results</span>
          {screenerMeta?.universe_source && <span className="tag" style={{ fontSize: 10 }}>Universe {String(screenerMeta.universe_source).replace(/_/g, " ")}</span>}
          {screenerMeta?.leadership_board_snapshot_time && <span className="tag" style={{ fontSize: 10 }}>Leadership board {formatEtTime(screenerMeta.leadership_board_snapshot_time)} ET</span>}
          {screenerMeta?.last_price_updated_at && <span className="tag" style={{ fontSize: 10 }}>Price updated {formatEtTime(screenerMeta.last_price_updated_at)} ET</span>}
          {(screenerMeta?.analysis_updated_at || screenerMeta?.scanned_at) && <span className="tag" style={{ fontSize: 10 }}>Analysis updated {formatEtTime(screenerMeta.analysis_updated_at || screenerMeta.scanned_at)} ET</span>}
          {setups.map(s => (
            <button key={s} onClick={() => setFilterSetup(s)} className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 10, ...(filterSetup === s ? { borderColor: "var(--green)", color: "var(--green)" } : {}) }}>{s}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {[["score", "Score"], ["winrate", "Confidence"], ["price", "Price"]].map(([k, l]) => (
              <button key={k} onClick={() => setSortBy(k)} className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 10, ...(sortBy === k ? { borderColor: "var(--blue)", color: "var(--blue)" } : {}) }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {showRemoved && removedResults.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14, borderColor: "rgba(251,176,36,0.28)" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border2)" }}>
            <div className="section-title">Removed after quality check</div>
            <div className="section-sub">These tickers are kept for transparency and are not active setups.</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Ticker</th><th>Removed time</th><th>Reason</th><th>Previous score</th><th>Latest score</th><th>Current price</th><th>Stop loss</th></tr>
              </thead>
              <tbody>
                {removedResults.map((r, i) => {
                  const displayPrice = r.current_price ?? r.price ?? r.scan_price;
                  return (
                    <tr key={`${r.ticker}-${i}`} style={{ opacity: 0.78 }}>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</td>
                      <td>{formatEtTime(r.disqualified_at || r.rescored_at)} ET</td>
                      <td><span className="tag" style={{ color: "var(--amber)", borderColor: "rgba(251,176,36,0.28)" }}>{removedReasonLabel(r)}</span></td>
                      <td>{r.previous_score ?? r.score ?? "-"}</td>
                      <td>{r.latest_score ?? "-"}</td>
                      <td>{displayPrice == null || displayPrice === "" ? "-" : `$${typeof displayPrice === "number" ? displayPrice.toFixed(2) : displayPrice}`}</td>
                      <td>{r.stop_loss ?? r.stop ? `$${Number(r.stop_loss ?? r.stop).toFixed(2)}` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Ticker</th><th>Price</th><th>Chg%</th><th>Latest Analysis Score</th><th>Confidence</th><th>Setup</th><th>RSI</th><th>Vol</th><th>Target</th><th>Stop</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const displayPrice = r.current_price ?? r.price ?? r.scan_price;
                  return (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</td>
                    <td>
                      {displayPrice == null || displayPrice === "" ? "-" : `$${typeof displayPrice === "number" ? displayPrice.toFixed(2) : displayPrice}`}
                      <div style={{ marginTop: 3, fontSize: 10, color: r.price_stale ? "var(--amber)" : "var(--muted)", lineHeight: 1.3 }}>
                        {r.price_stale ? "stale price" : (r.last_price_updated_at ? `Price ${formatEtTime(r.last_price_updated_at)} ET` : "scan price")}
                      </div>
                    </td>
                    <td><span style={{ color: (r.change_pct || 0) >= 0 ? "var(--green)" : "var(--red)" }}>{(r.change_pct || 0) >= 0 ? "+" : ""}{(r.change_pct || 0).toFixed(2)}%</span></td>
                    <td>
                      <ScoreGauge score={r.score} />
                      <div style={{ marginTop: 3, fontSize: 10, color: "var(--muted)", lineHeight: 1.3 }}>
                        Analysis {formatEtTime(r.analysis_updated_at || r.rescored_at || r.scanned_at)} ET
                      </div>
                    </td>
                    <td>
                      <span style={{ color: SCORE_COLOR(r.score), fontWeight: 700 }}>{formatConfidence(r)}</span>
                      <div style={{ marginTop: 3, fontSize: 10, color: "var(--muted)", lineHeight: 1.3 }}>Estimated</div>
                    </td>
                    <td>
                      <span className="tag">{r.setup}</span>
                      {r.confirmation_timeframe && (
                        <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
                          4H setup: {r.confirmation_4h?.setup || "-"}
                        </div>
                      )}
                      <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <AnalysisMetaBadges analysis={r} />
                        {r.analysis_timeframe_summary?.trade_readiness && <span className="tag" style={{ fontSize: 10 }}>{compactStatus(r.analysis_timeframe_summary.trade_readiness)}</span>}
                        {r.risk_structure?.stop_quality && <span className="tag" style={{ fontSize: 10 }}>Stop {compactStatus(r.risk_structure.stop_quality)}</span>}
                        {r.target_realism?.rating && <span className="tag" style={{ fontSize: 10 }}>Target {compactStatus(r.target_realism.rating)}</span>}
                        {r.entry_signal?.status && <span className="tag" style={{ fontSize: 10 }}>{compactStatus(r.entry_signal.status)} / {compactStatus(r.entry_signal.action)}</span>}
                        {r.position_sizing_preview && (
                          <span className="tag" style={{ fontSize: 10, color: "var(--blue)", borderColor: "rgba(77,166,255,0.32)" }}>
                            Size {r.position_sizing_preview.shares ?? "-"} sh · {r.position_sizing_preview.sizing_status || "Preview"}
                          </span>
                        )}
                        {(r.entry_plan_v2 || r.entry_plan_v2_json || r.v2_entry_plan_type) && (
                          <span className="tag" style={{ fontSize: 10, color: "var(--green2)", borderColor: "rgba(163,247,191,0.32)" }}>
                            {r.v2_plan_quality || r.entry_plan_v2?.v2_plan_quality || "Watch"} · {normalizeActionLabel(r.v2_action_status || r.entry_plan_v2?.v2_action_status || "watch_only")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td><span style={{ color: (r.rsi || 50) < 35 ? "var(--green)" : (r.rsi || 50) > 70 ? "var(--red)" : "var(--text2)" }}>{r.rsi?.toFixed(0) || "–"}</span></td>
                    <td><span style={{ color: (r.vol_ratio || 0) > 1.5 ? "var(--amber)" : "var(--text2)" }}>{r.vol_ratio?.toFixed(1) || "–"}x</span></td>
                    <td style={{ color: "var(--green)" }}>${r.target?.toFixed(2)}</td>
                    <td style={{ color: "var(--red)" }}>${r.stop?.toFixed(2)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button className="btn btn-blue" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => analyzeStock(r.ticker)} disabled={readOnly}>AI</button>
                        <EntryWatchButton analysis={r} compact disabled={readOnly} />
                        <button className="btn btn-amber" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => sendAlert(r.ticker)} disabled={readOnly || alertSent[r.ticker] === "sending"}>
                          {alertSent[r.ticker] === "sent" ? "✓" : alertSent[r.ticker] === "sending" ? "…" : "📲"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : !loading && (
        <div className="empty">
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <h3>No results yet</h3>
          <p>Type some tickers and click Run Scan</p>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🤖 AI Analysis — {selected}</div>
            {analyzeLoading
              ? <div style={{ textAlign: "center", padding: 30 }}><div className="spin" /><p style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>Analyzing with Claude AI…</p></div>
              : analysis?.error
                ? <div className="err-box">{analysis.error}</div>
                : analysis?.analysis
                  ? <>
                      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{ background: "var(--bg3)", padding: "6px 12px", borderRadius: 6, fontSize: 12 }}>Score: <b style={{ color: SCORE_COLOR(analysis.score?.score || 0) }}>{analysis.score?.score}/100</b></div>
                        <div style={{ background: "var(--bg3)", padding: "6px 12px", borderRadius: 6, fontSize: 12 }}>Confidence: <b style={{ color: "var(--green)" }}>{formatConfidence(analysis)}</b></div>
                        <div style={{ background: "var(--bg3)", padding: "6px 12px", borderRadius: 6, fontSize: 12 }}>Setup: <b>{analysis.score?.setup}</b></div>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text2)", maxHeight: 300, overflowY: "auto", background: "var(--bg3)", padding: 14, borderRadius: 8, whiteSpace: "pre-wrap" }}>
                        {analysis.analysis}
                      </div>
                      {analysis.score?.signals?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Signals</div>
                          <div className="signals-list">{analysis.score.signals.map((s, i) => <span key={i} className="signal-pill">{s}</span>)}</div>
                        </div>
                      )}
                      <UnifiedActionCard analysis={analysis} mode="entry" />
                      {analysis.suggested_entry_zone && (
                        <SuggestedEntryZone
                          zone={analysis.suggested_entry_zone}
                          description="Research-only entry zone from this AI analysis."
                          action={<EntryWatchButton analysis={{ ...analysis, ticker: selected }} />}
                          entrySignal={analysis.entry_signal}
                        />
                      )}
                      <StructurePlanV2Preview plan={analysis.entry_plan_v2 || analysis.entry_plan_v2_json} />
                      <DecisionLayerSections analysis={analysis} />
                    </>
                  : null
            }
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
              {analysis?.analysis && <button className="btn btn-amber" onClick={() => { sendAlert(selected); setSelected(null); }}>📲 Telegram Alert</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
const portfolioKey = p => String(p?.id || p?.ticker || "");
const portfolioSymbol = p => String(p?.ticker || p?.symbol || "").toUpperCase();
const fmtMoney = value => value == null || value === "" || Number.isNaN(Number(value)) ? "-" : `$${Number(value).toFixed(2)}`;
const fmtNumber = value => value == null || value === "" || Number.isNaN(Number(value)) ? "-" : Number(value).toFixed(2);
const fmtRR = value => value == null || value === "" || Number.isNaN(Number(value)) ? "-" : `1:${Number(value).toFixed(2)}`;
const fmtPctDash = value => value == null || value === "" || Number.isNaN(Number(value)) ? "-" : `${Number(value).toFixed(2)}%`;
const fmtRMultiple = value => value == null || value === "" || Number.isNaN(Number(value)) ? "-" : `${Number(value).toFixed(2)}R`;
const exitV2Style = action => {
  if (["Hard Sell", "Invalidated"].includes(action)) return { color: "var(--red)", borderColor: "rgba(255,77,77,0.45)", background: "rgba(255,77,77,0.10)" };
  if (["Warning", "Reduce Exposure"].includes(action)) return { color: "var(--amber)", borderColor: "rgba(251,176,36,0.45)", background: "rgba(251,176,36,0.10)" };
  if (["Partial Profit", "Trail Stop"].includes(action)) return { color: "var(--blue)", borderColor: "rgba(77,166,255,0.45)", background: "rgba(77,166,255,0.10)" };
  if (action === "Let Winner Run") return { color: "var(--green)", borderColor: "rgba(0,255,178,0.45)", background: "rgba(0,255,178,0.10)" };
  return { color: "var(--muted)", borderColor: "rgba(148,163,184,0.35)", background: "rgba(148,163,184,0.08)" };
};
const exitUrgencyStyle = urgency => {
  if (urgency === "Critical" || urgency === "High") return { color: "var(--red)", borderColor: "rgba(255,77,77,0.45)", background: "rgba(255,77,77,0.08)" };
  if (urgency === "Medium") return { color: "var(--amber)", borderColor: "rgba(251,176,36,0.45)", background: "rgba(251,176,36,0.08)" };
  return { color: "var(--green2)", borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" };
};
const positionActionStyle = summary => {
  const risk = String(summary?.risk_level || "").toLowerCase();
  const action = String(summary?.action || "");
  if (risk === "high" || action === "EXIT_STOP_TRIGGERED" || action === "HIGH_EXIT_RISK") return { color: "var(--red)", borderColor: "rgba(255,77,77,0.45)", background: "rgba(255,77,77,0.10)" };
  if (risk === "medium" || ["HOLD_CAREFULLY", "REDUCE_TAKE_PARTIAL", "AVOID_ADDING", "DO_NOT_ADD"].includes(action)) return { color: "var(--amber)", borderColor: "rgba(251,176,36,0.45)", background: "rgba(251,176,36,0.10)" };
  return { color: "var(--green)", borderColor: "rgba(0,255,178,0.45)", background: "rgba(0,255,178,0.10)" };
};
const fmtMoneyDash = value => value == null || value === "" || Number.isNaN(Number(value)) ? "—" : `$${Number(value).toFixed(2)}`;
const fmtRRDash = value => value == null || value === "" || Number.isNaN(Number(value)) ? "—" : `1:${Number(value).toFixed(2)}`;

const fmtDateTime = value => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};
const listify = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [value].filter(Boolean);
    } catch {
      return [value].filter(Boolean);
    }
  }
  return [value].filter(Boolean);
};
const ENTRY_STATUS_LABELS = {
  waiting_for_pullback: "Waiting for Pullback",
  waiting_for_1h_confirmation: "Wait — 1H Pending",
  entry_confirmed: "Entry Confirmed",
  entry_ready: "Entry Ready",
  missed_entry: "Missed — Wait for Pullback",
  pullback_forming: "Pullback Forming",
  setup_forming: "Setup Forming",
  reconfirmation_needed: "Reconfirmation Needed",
  invalidated: "Invalidated",
  expired: "Expired",
  cancelled: "Cancelled",
};
const ENTRY_ACTION_LABELS = {
  wait: "Wait",
  watch: "Watch",
  wait_for_pullback: "Wait for Pullback",
  wait_for_1h_confirmation: "Wait — 1H Pending",
  wait_for_trigger: "Waiting for Trigger",
  consider_entry: "Buy Watch",
  entry_ready: "Entry Ready",
  missed_first_entry: "Missed First Entry",
  pullback_forming: "Pullback Forming",
  reconfirmation_needed: "Reconfirmation Needed",
  avoid: "Avoid",
  cancelled: "Cancelled",
};
const entryStatusStyle = status => {
  if (["entry_confirmed", "entry_ready"].includes(status)) return { color: "var(--green)", borderColor: "var(--green)", background: "rgba(0,255,178,.08)" };
  if (["invalidated", "expired", "cancelled"].includes(status)) return { color: "var(--red)", borderColor: "var(--red)", background: "rgba(255,77,77,.08)" };
  if (["waiting_for_pullback", "missed_entry", "pullback_forming"].includes(status)) return { color: "var(--amber)", borderColor: "var(--amber)", background: "rgba(251,176,36,.08)" };
  if (["reconfirmation_needed"].includes(status)) return { color: "var(--blue)", borderColor: "var(--blue)", background: "rgba(77,166,255,.08)" };
  return { color: "var(--blue)", borderColor: "var(--blue)", background: "rgba(77,166,255,.08)" };
};
const numberOrNull = value => value == null || value === "" || Number.isNaN(Number(value)) ? null : Number(value);
const normalizeAnalysisForEntryWatch = source => {
  if (!source) return {};
  const scoreObj = source.score && typeof source.score === "object" ? source.score : null;
  return {
    ...source,
    ticker: String(source.ticker || source.symbol || "").toUpperCase(),
    score: scoreObj?.score ?? source.score,
    setup: scoreObj?.setup ?? source.setup,
    signals: source.signals || scoreObj?.signals || [],
    current_price: source.current_price ?? source.price ?? source.scan_price ?? source.quote?.price,
    target: source.target ?? source.target_price,
    stop: source.stop ?? source.stop_loss,
  };
};
const buildEntryWatchPayload = analysisInput => {
  const analysis = normalizeAnalysisForEntryWatch(analysisInput);
  const zone = analysis.suggested_entry_zone || {};
  const ticker = String(analysis.ticker || "").trim().toUpperCase();
  return {
    ticker,
    analysis,
    setup: analysis.setup || "",
    score: analysis.score == null ? null : Math.round(Number(analysis.score)),
    confidence: zone.confidence || analysis.confidence || "",
    watch_price: numberOrNull(analysis.current_price),
    aggressive_entry: numberOrNull(zone.aggressive_entry),
    conservative_entry: numberOrNull(zone.conservative_entry),
    preferred_entry: numberOrNull(zone.preferred_entry),
    ideal_stop: numberOrNull(zone.ideal_stop ?? analysis.stop),
    target: numberOrNull(zone.target ?? analysis.target),
    risk_reward: numberOrNull(zone.risk_reward_conservative ?? analysis.risk_reward),
    entry_timing: normalizedWatchEntryTiming({ entry_timing: zone.entry_timing || analysis.entry_timing || "wait_for_1h_confirmation" }),
  };
};

function EntryWatchButton({ analysis, onSaved, compact = false, disabled = false }) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const payload = buildEntryWatchPayload(analysis);
  const canSave = Boolean(payload.ticker);

  const save = async () => {
    if (!canSave || state === "saving") return;
    setState("saving");
    setMessage("");
    const { data, error } = await api("/api/entry-watchlist", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (error) {
      setState("error");
      setMessage(error.includes("Not authenticated") || error.includes("401") ? "Sign in required." : error);
      return;
    }
    setState("saved");
    setMessage(data?.updated_existing ? "Watch updated." : "Added to Entry Watchlist.");
    if (typeof onSaved === "function") onSaved(data?.watch);
    setTimeout(() => {
      setState("idle");
      setMessage("");
    }, 3500);
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button className="btn btn-green" style={compact ? { padding: "4px 8px", fontSize: 10, minHeight: 26 } : undefined} onClick={save} disabled={disabled || !canSave || state === "saving"}>
        {state === "saving" ? "Saving..." : state === "saved" ? "Watching" : "Watch Entry Signal"}
      </button>
      {message && (
        <span style={{ fontSize: 11, color: state === "error" ? "var(--red)" : "var(--green)" }}>{message}</span>
      )}
    </div>
  );
}

function DetailGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ padding: 9, borderRadius: 6, background: "rgba(255,255,255,0.025)", border: "1px solid var(--border2)" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .7, fontWeight: 800 }}>{label}</div>
          <div style={{ marginTop: 4, fontFamily: "var(--mono)", color: "var(--text)" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function DecisionConditionList({ title, items }) {
  const values = listItems(items);
  if (!values.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .7, fontWeight: 800, marginBottom: 5 }}>{title}</div>
      <div style={{ display: "grid", gap: 5 }}>
        {values.map((item, i) => (
          <div key={i} style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function DecisionLayerSections({ analysis, compact = false }) {
  if (!analysis) return null;
  const summary = analysis.analysis_timeframe_summary;
  const entrySignal = analysis.entry_signal;
  const risk = analysis.risk_structure;
  const target = analysis.target_realism;
  const hasDecisionMeta = analysis.action_status || analysis.market_regime || analysis.volume_confidence || analysis.leadership_rank_label || analysis.sector_strength_label;
  if (!summary && !entrySignal && !risk && !target && !hasDecisionMeta) return null;
  const sectionStyle = {
    padding: compact ? 10 : 12,
    borderRadius: 8,
    background: "rgba(255,255,255,0.018)",
    border: "1px solid var(--border2)",
  };
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {hasDecisionMeta && (
        <details open style={sectionStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 800, marginBottom: 0, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Market Context</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <MarketRegimeBadge analysis={analysis} />
              <SectorStrengthBadge analysis={analysis} />
            </div>
          </summary>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <LeadershipBadge analysis={analysis} />
              <RelativeStrengthBadge analysis={analysis} />
              <VolumeConfidenceBadge analysis={analysis} />
            </div>
            <DetailGrid items={[
              ["Leadership", analysis.leadership_rank_label || "-"],
              ["Leadership Reason", analysis.leadership_reason || analysis.leadership_warning || "-"],
              ["Sector", analysis.sector_name ? `${analysis.sector_name}${analysis.sector_etf ? ` (${analysis.sector_etf})` : ""}` : "-"],
              ["RS vs SPY", `1M ${fmtPctSigned(analysis.rs_1m_vs_spy)} / 3M ${fmtPctSigned(analysis.rs_3m_vs_spy)}`],
              ["RS vs Sector", `1M ${fmtPctSigned(analysis.rs_1m_vs_sector)} / 3M ${fmtPctSigned(analysis.rs_3m_vs_sector)}`],
              ["Liquidity", analysis.liquidity_status || "-"],
              ["Market Reason", analysis.market_regime_reason || "-"],
              ["Volume Note", analysis.volume_warning || analysis.volume_confidence_reason || "-"],
            ]} />
          </div>
        </details>
      )}
      {summary && (
        <details style={sectionStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Trade Readiness</summary>
          <div style={{ marginTop: 10 }}>
            <DetailGrid items={[
              ["Daily Context", summary.daily_context || "-"],
              ["4H Setup", summary.four_hour_setup || "-"],
              ["1H Entry", summary.one_hour_entry || "-"],
              ["Quality Grade", summary.quality_grade || analysis.quality_grade || "-"],
              ["Setup Validity", compactStatus(analysis.setup_validity)],
              ["Risk Status", compactStatus(analysis.risk_status)],
              ["Confirmation", compactStatus(analysis.confirmation_status)],
              ["Timing", summary.timing || timingLabel(summary.trade_readiness)],
              ["Action", summary.action || actionLabel(entrySignal?.action)],
              ["Expected Hold", summary.expected_holding_period || "-"],
            ]} />
          </div>
        </details>
      )}
      {entrySignal && (
        <details style={sectionStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Entry Signal Details</summary>
          <div style={{ marginTop: 10 }}>
            <DetailGrid items={[
              ["Status", timingLabel(entrySignal.status)],
              ["Action", actionLabel(entrySignal.action)],
              ["Timeframe", entrySignal.timeframe_used || "-"],
              ["Valid For", entrySignal.signal_valid_for || "-"],
              ["Expected Hold", entrySignal.expected_holding_period || "-"],
            ]} />
            <DecisionConditionList title="Trigger Conditions" items={entrySignal.trigger_conditions} />
            <DecisionConditionList title="Missing Conditions" items={entrySignal.missing_conditions} />
            <DecisionConditionList title="Invalidation Conditions" items={entrySignal.invalidation_conditions} />
            {entrySignal.entry_signal_reason && (
              <div style={{ marginTop: 8, color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>{entrySignal.entry_signal_reason}</div>
            )}
          </div>
        </details>
      )}
      {risk && (
        <details style={sectionStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Risk Structure</summary>
          <div style={{ marginTop: 10 }}>
            <DetailGrid items={[
              ["Warning Level", risk.warning_level ?? "-"],
              ["Hard Stop", fmtMoney(risk.hard_stop)],
              ["Stop Quality", compactStatus(risk.stop_quality)],
              ["Stop Distance", risk.stop_distance_pct == null ? "-" : `${Number(risk.stop_distance_pct).toFixed(2)}%`],
              ["Stop ATR", risk.stop_atr_multiple == null ? "-" : Number(risk.stop_atr_multiple).toFixed(2)],
              ["Invalidation", risk.invalidation_condition || "-"],
            ]} />
          </div>
        </details>
      )}
      {target && (
        <details style={sectionStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Target Realism</summary>
          <div style={{ marginTop: 10 }}>
            <DetailGrid items={[
              ["Rating", compactStatus(target.rating)],
              ["Reason", target.reason || "-"],
            ]} />
          </div>
        </details>
      )}
    </div>
  );
}

function SuggestedEntryZone({ zone, description = "Research-only entry zone from the current live analysis.", action = null, entrySignal = null }) {
  if (!zone) return null;
  const avoid = zone.entry_grade === "Avoid";
  const zoneStatus = zone.price_zone_status || entrySignal?.price_zone_status;
  const confirmationPassed = Boolean(zone.confirmation_passed || entrySignal?.confirmation_passed);
  const blockReason = zone.entry_block_reason || entrySignal?.entry_block_reason;
  const entryNotConfirmed = entrySignal && entrySignal.status !== "confirmed";
  const highlight = value => <span style={{ color: "var(--green)", fontWeight: 800 }}>{value}</span>;
  const zoneStatusColor = zoneStatus === "in_entry_zone" ? "var(--green)" : zoneStatus === "above_entry_zone" ? "var(--amber)" : "var(--muted)";
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(77,166,255,0.06)", border: "1px solid rgba(77,166,255,0.20)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>Entry Price Levels</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>{description}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {zone.confidence && (
            <span className="badge" style={{ color: "var(--blue)", borderColor: "rgba(77,166,255,0.45)", background: "rgba(77,166,255,0.08)" }}>
              Confidence {zone.confidence}
            </span>
          )}
          {zoneStatus && (
            <span className="badge" style={{ color: zoneStatusColor, borderColor: zoneStatusColor, background: "rgba(255,255,255,0.035)" }}>
              {priceZoneLabel(zoneStatus)}
            </span>
          )}
          {action}
        </div>
      </div>
      {avoid ? (
        <div>
          <div style={{ padding: "9px 11px", borderRadius: 6, background: "rgba(251,176,36,0.07)", border: "1px solid rgba(251,176,36,0.22)", color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
            No clean entry zone available. {zone.bot_suggestion || zone.entry_reason || "Setup not ready for a defined entry."}
          </div>
          {(zone.risk_notes || []).length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 18, color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
              {zone.risk_notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <>
          <DetailGrid items={[
            ["Preferred Entry", highlight(fmtMoneyDash(zone.preferred_entry))],
            ["Conservative Entry", fmtMoneyDash(zone.conservative_entry)],
            ["Aggressive Entry", fmtMoneyDash(zone.aggressive_entry)],
            ["Ideal Stop", <span style={{ color: "var(--red)" }}>{fmtMoneyDash(zone.ideal_stop)}</span>],
            ["Target (T1)", fmtMoneyDash(zone.target)],
            ["R:R (Conservative)", fmtRRDash(zone.risk_reward_conservative)],
            ["R:R (Aggressive)", fmtRRDash(zone.risk_reward_aggressive)],
            ["Distance to Entry", zone.distance_to_entry_pct != null ? `${Number(zone.distance_to_entry_pct).toFixed(2)}%` : "-"],
            ["1H Confirmation", confirmationLabel(confirmationPassed)],
          ]} />
          {entryNotConfirmed && blockReason && (
            <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 6, background: "rgba(251,176,36,0.08)", border: "1px solid rgba(251,176,36,0.22)", color: "var(--amber)", fontSize: 12, lineHeight: 1.5 }}>
              {blockReason}
            </div>
          )}
          {zone.bot_suggestion && (
            <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 6, background: "rgba(77,166,255,0.07)", border: "1px solid rgba(77,166,255,0.18)", color: "var(--text2)", fontSize: 12, lineHeight: 1.55 }}>
              {zone.bot_suggestion}
            </div>
          )}
          {(zone.risk_notes || []).length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 18, color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
              {zone.risk_notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function PositionSizingPreview({ sizing, heat, title = "Position Sizing Preview", compact = false }) {
  if (!sizing && !heat) return null;
  const s = typeof sizing === "string" ? (() => { try { return JSON.parse(sizing); } catch { return null; } })() : sizing;
  const h = typeof heat === "string" ? (() => { try { return JSON.parse(heat); } catch { return null; } })() : heat;
  if (!s && !h) return null;
  const warnings = [...(s?.sizing_warnings || []), ...(h?.portfolio_risk_warnings || [])].filter(Boolean);
  const status = s?.sizing_status || h?.heat_status || "-";
  const statusColor = status === "Acceptable" ? "var(--green)" : status === "Not Available" ? "var(--muted)" : ["Invalid", "Market Hostile", "Portfolio Heat Too High", "Sector Exposure Too High"].includes(status) ? "var(--red)" : "var(--amber)";
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(77,166,255,0.04)", border: "1px solid rgba(77,166,255,0.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Position sizing is a risk-planning estimate. It does not place trades.</div>
        </div>
        <span className="badge" style={{ color: statusColor, borderColor: statusColor }}>{status}</span>
      </div>
      <DetailGrid items={[
        ["Risk % Used", s?.risk_percent_used == null ? "-" : `${Number(s.risk_percent_used).toFixed(2)}%`],
        ["Risk Amount", fmtMoneyDash(s?.risk_amount)],
        ["Suggested Shares", s?.shares ?? "-"],
        ["Position Value", fmtMoneyDash(s?.position_value)],
        ["Max Loss if Stopped", fmtMoneyDash(s?.max_loss_if_stopped)],
        ["Stop Distance %", s?.stop_distance_pct == null ? "-" : `${Number(s.stop_distance_pct).toFixed(2)}%`],
        ["Portfolio Heat After", h?.projected_portfolio_heat_percent == null ? "-" : `${Number(h.projected_portfolio_heat_percent).toFixed(2)}%`],
        ["Sector Exposure After", h?.projected_sector_exposure_percent == null ? "-" : `${Number(h.projected_sector_exposure_percent).toFixed(2)}%`],
      ]} />
      {!compact && s?.sizing_reason && <div style={{ marginTop: 8, color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>{s.sizing_reason}</div>}
      {!compact && warnings.length > 0 && (
        <ul style={{ marginTop: 8, paddingLeft: 18, color: "var(--amber)", fontSize: 12, lineHeight: 1.6 }}>
          {[...new Set(warnings)].map((warning, i) => <li key={i}>{warning}</li>)}
        </ul>
      )}
    </div>
  );
}

function StructurePlanV2Preview({ plan, compact = false }) {
  if (!plan) return null;
  const p = typeof plan === "string" ? (() => { try { return JSON.parse(plan); } catch { return null; } })() : plan;
  if (!p) return null;
  const warnings = Array.isArray(p.v2_plan_warnings) ? p.v2_plan_warnings : [];
  const action = p.v2_action_label || p.v2_action_status || "Watch Only";
  const quality = p.v2_plan_quality || "Watch";
  const qualityColor = quality === "A" ? "var(--green)" : quality === "B" ? "var(--green2)" : quality === "C" ? "var(--amber)" : quality === "Avoid" ? "var(--red)" : "var(--blue)";
  const actionColor = action === "Entry Ready" || action === "Near Entry" ? "var(--green)" : action === "Invalidated" || action === "Avoid" ? "var(--red)" : "var(--amber)";
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(163,247,191,0.045)", border: "1px solid rgba(163,247,191,0.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>Strategy Plan</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Research-only. SwingAI never places orders. Review the plan manually before entering.</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="badge" style={{ color: actionColor, borderColor: actionColor }}>{action}</span>
          <span className="badge" style={{ color: qualityColor, borderColor: qualityColor }}>Quality {quality}</span>
        </div>
      </div>
      <DetailGrid items={[
        ["Setup Type", p.v2_entry_plan_type || "-"],
        ["Action", action],
        ["Entry Zone", p.v2_entry_zone_low || p.v2_entry_zone_high ? `${fmtMoneyDash(p.v2_entry_zone_low)} - ${fmtMoneyDash(p.v2_entry_zone_high)}` : "-"],
        ["Trigger", fmtMoneyDash(p.v2_entry_trigger)],
        ["Preferred Entry", fmtMoneyDash(p.v2_preferred_entry)],
        ["Stop", fmtMoneyDash(p.v2_stop_loss)],
        ["Target 1", fmtMoneyDash(p.v2_target_1)],
        ["Target 2", fmtMoneyDash(p.v2_target_2)],
        ["R 1", fmtRRDash(p.v2_risk_reward_1)],
        ["R 2", fmtRRDash(p.v2_risk_reward_2)],
        ["Risk", p.v2_risk_status || "-"],
        ["Confirmation", p.v2_confirmation_status || p.v2_confirmation_needed || "-"],
      ]} />
      {!compact && p.v2_entry_reason && (
        <div style={{ marginTop: 10, color: "var(--text2)", fontSize: 12, lineHeight: 1.55 }}>{p.v2_entry_reason}</div>
      )}
      {!compact && p.v2_target_reason && (
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12, lineHeight: 1.55 }}>{p.v2_target_reason}</div>
      )}
      {!compact && warnings.length > 0 && (
        <ul style={{ marginTop: 8, paddingLeft: 18, color: "var(--amber)", fontSize: 12, lineHeight: 1.6 }}>
          {warnings.map((warning, i) => <li key={i}>{warning}</li>)}
        </ul>
      )}
      <PositionSizingPreview sizing={p.v2_position_sizing_preview} title="Position Sizing" compact={compact} />
    </div>
  );
}

function FinalActionCard({ summary, preview }) {
  if (!summary) return null;
  return (
    <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.024)", border: "1px solid var(--border2)", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 4 }}>{summary.action_label || "Hold Carefully"}</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Research and alert assistant only. No broker execution.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge" style={positionActionStyle(summary)}>{summary.risk_level || "low"} risk</span>
          {preview?.data_freshness && <span className="badge">{preview.data_freshness}</span>}
        </div>
      </div>
      <DetailGrid items={[
        ["Current Price", fmtMoneyDash(summary.current_price)],
        ["Saved Stop", fmtMoneyDash(summary.saved_stop)],
        ["Distance to Saved Stop", summary.distance_to_saved_stop_pct == null ? "-" : `${fmtPctDash(summary.distance_to_saved_stop_pct)} (${fmtMoneyDash(summary.distance_to_saved_stop_amount)})`],
        ["Profit/Loss", fmtPctDash(summary.unrealized_gain_pct)],
        ["Current R", summary.current_r || fmtRMultiple(summary.current_r_multiple)],
      ]} />
      <div style={{ marginTop: 10, color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>{summary.explanation || "No summary available."}</div>
      <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.025)", border: "1px solid var(--border2)", color: "var(--text)", fontSize: 12, lineHeight: 1.45 }}>
        <strong>Next step:</strong> {summary.next_step || "Review manually against the saved plan."}
      </div>
    </div>
  );
}

function UnifiedActionCard({ analysis, mode = "entry" }) {
  const ua = analysis?.unified_action;
  if (!ua) return null;
  const fa = String(ua.final_action || "").toLowerCase();
  const isGreen = ["entry_ready"].includes(fa);
  const isRed = ["invalidated", "avoid", "market_hostile", "high_exit_risk", "exit_stop_triggered"].includes(fa);
  const isAmber = ["missed_first_entry", "too_extended", "data_stale", "reduce_exposure", "pullback_forming", "take_partial"].includes(fa);
  const accentColor = isGreen ? "var(--green)" : isRed ? "var(--red)" : isAmber ? "var(--amber)" : "var(--blue)";
  const accentBg = isGreen ? "rgba(34,197,94,0.06)" : isRed ? "rgba(255,77,77,0.06)" : isAmber ? "rgba(251,176,36,0.06)" : "rgba(77,166,255,0.06)";
  const accentBorder = isGreen ? "rgba(34,197,94,0.22)" : isRed ? "rgba(255,77,77,0.22)" : isAmber ? "rgba(251,176,36,0.22)" : "rgba(77,166,255,0.22)";
  const kl = ua.key_levels || {};
  const why = ua.why_no_alert;
  const riskStyle = {
    critical: { color: "var(--red)", borderColor: "rgba(255,77,77,0.42)", background: "rgba(255,77,77,0.08)" },
    high: { color: "var(--red)", borderColor: "rgba(255,77,77,0.42)", background: "rgba(255,77,77,0.08)" },
    medium: { color: "var(--amber)", borderColor: "rgba(251,176,36,0.42)", background: "rgba(251,176,36,0.08)" },
    low: { color: "var(--green)", borderColor: "rgba(34,197,94,0.42)", background: "rgba(34,197,94,0.08)" },
  }[String(ua.risk_level || "low")] || { color: "var(--muted)", borderColor: "var(--border2)", background: "rgba(255,255,255,0.035)" };
  return (
    <div style={{ marginBottom: 14, padding: 14, borderRadius: 10, background: accentBg, border: `1px solid ${accentBorder}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: accentColor, marginBottom: 3 }}>{ua.final_action_label || "Analyzing…"}</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Research and alert assistant only — SwingAI never places orders.</div>
        </div>
        <span className="badge" style={riskStyle}>{String(ua.risk_level || "low")} risk</span>
      </div>
      <div style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>{ua.main_reason}</div>
      <div style={{ padding: "9px 11px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border2)", fontSize: 12, lineHeight: 1.45, color: "var(--text)" }}>
        <strong>Next step:</strong> {ua.next_step}
      </div>
      {(kl.preferred_entry || kl.ideal_stop || kl.target_1 || kl.current_price) && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {kl.current_price && <span className="tag" style={{ fontSize: 11 }}>Price {fmtMoneyDash(kl.current_price)}</span>}
          {kl.preferred_entry && <span className="tag" style={{ fontSize: 11, color: "var(--green)", borderColor: "rgba(34,197,94,0.35)" }}>Entry ~{fmtMoneyDash(kl.preferred_entry)}</span>}
          {kl.ideal_stop && <span className="tag" style={{ fontSize: 11, color: "var(--red)", borderColor: "rgba(255,77,77,0.35)" }}>Stop {fmtMoneyDash(kl.ideal_stop)}</span>}
          {kl.target_1 && <span className="tag" style={{ fontSize: 11, color: "var(--green2)", borderColor: "rgba(163,247,191,0.35)" }}>T1 {fmtMoneyDash(kl.target_1)}</span>}
          {kl.target_2 && <span className="tag" style={{ fontSize: 11, color: "var(--muted)" }}>T2 {fmtMoneyDash(kl.target_2)}</span>}
          {kl.saved_stop && mode === "portfolio" && <span className="tag" style={{ fontSize: 11, color: "var(--red)", borderColor: "rgba(255,77,77,0.35)" }}>Saved Stop {fmtMoneyDash(kl.saved_stop)}</span>}
        </div>
      )}
      {why && why.alert_status === "NO_ALERT" && mode === "entry" && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Why no buy alert?</summary>
          <div style={{ marginTop: 8, padding: "9px 11px", borderRadius: 6, background: "rgba(255,255,255,0.025)", border: "1px solid var(--border2)", fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ color: "var(--text2)", marginBottom: why.needed_for_alert?.length ? 8 : 0 }}>{why.alert_reason}</div>
            {why.needed_for_alert?.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", lineHeight: 1.6 }}>
                {why.needed_for_alert.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function ExitManagerV2Preview({ preview, compact = false }) {
  if (!preview) return null;
  const warnings = preview.exit_warnings || [];
  const stale = preview.quote_is_stale || preview.price_stale || preview.data_freshness === "stale";
  const summary = preview.position_action_summary;
  return (
    <div style={{ marginTop: compact ? 0 : 12, padding: 12, borderRadius: 8, background: "rgba(77,166,255,0.045)", border: "1px solid rgba(77,166,255,0.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>Exit Analysis</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Research-only. Does not execute trades or change saved stops.</div>
        </div>
        {!summary && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge" style={exitV2Style(preview.exit_action)}>{preview.exit_action || "Data Limited"}</span>
            <span className="badge" style={exitUrgencyStyle(preview.exit_urgency)}>{preview.exit_urgency || "Low"}</span>
          </div>
        )}
      </div>
      {stale && (
        <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(251,176,36,0.35)", background: "rgba(251,176,36,0.08)", color: "var(--amber)", fontSize: 12, lineHeight: 1.45 }}>
          Data stale - confirm price before treating this as an exit warning.
        </div>
      )}
      <FinalActionCard summary={summary} preview={preview} />
      <details open style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 12 }}>Why?</summary>
        <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>{preview.exit_reason || summary?.explanation || "No preview reason available."}</div>
        {warnings.length > 0 && (
          <ul style={{ marginTop: 8, paddingLeft: 18, color: preview.exit_urgency === "Critical" ? "var(--red)" : "var(--amber)", fontSize: 12, lineHeight: 1.6 }}>
            {warnings.slice(0, 5).map((warning, i) => <li key={i}>{warning}</li>)}
          </ul>
        )}
      </details>
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 12 }}>Technical Details</summary>
        <div style={{ marginTop: 8 }}>
          <DetailGrid items={[
            ["Current Price", fmtMoneyDash(preview.current_price)],
            ["Saved Stop", fmtMoneyDash(summary?.saved_stop ?? preview.comparison_to_current_plan?.saved_stop_loss)],
            ["Current R", fmtRMultiple(preview.current_r_multiple)],
            ["Unrealized Gain", fmtPctDash(preview.unrealized_gain_pct)],
            ["Distance to Saved Stop", fmtPctDash(summary?.distance_to_saved_stop_pct ?? preview.distance_to_stop_pct)],
            ["Distance to Target", summary?.show_live_target_as_secondary ? fmtPctDash(preview.distance_to_target_pct) : "Secondary"],
            ["Partial Profit", preview.partial_profit_recommended ? "Yes" : "No"],
            ["Suggested Partial", preview.suggested_partial_percent == null ? "-" : `${preview.suggested_partial_percent}%`],
            ["Trail Stop", preview.trailing_stop_recommended ? "Yes" : "No"],
            ["Recommended Stop", fmtMoneyDash(preview.recommended_stop)],
            ["Stop Basis", preview.stop_basis || "-"],
            ["Trend", preview.trend_status || "-"],
            ["Momentum", preview.metadata?.context?.macd_hist == null ? "-" : `MACD hist ${Number(preview.metadata.context.macd_hist).toFixed(3)}`],
            ["Market", preview.market_exit_status || "-"],
            ["Sector", preview.sector_exit_status || "-"],
            ["Leadership", preview.leadership_exit_status || "-"],
          ]} />
        </div>
      </details>
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 12 }}>Raw Diagnostics</summary>
        <div style={{ marginTop: 8 }}>
          <DetailGrid items={[
            ["Raw Exit Action", preview.raw_exit_action || preview.exit_action || "-"],
            ["Raw Urgency", preview.raw_exit_urgency || preview.exit_urgency || "-"],
            ["Quote Source", preview.quote_source || preview.price_source || "-"],
            ["Quote Updated", preview.quote_updated_at ? formatQuoteTimeEt(preview.quote_updated_at) : "-"],
            ["Freshness", preview.data_freshness || "-"],
            ["Market Session", preview.market_session || "-"],
            ["Stop Check Basis", preview.stop_check_basis || "-"],
            ["Last Closed Candle", preview.last_closed_candle_time || "-"],
            ["Warning Validity", preview.warning_validity_status || "-"],
            ["Data Confidence", preview.data_confidence || "-"],
          ]} />
        </div>
      </details>
    </div>
  );
}
function PortfolioLiveAnalysisPanel({ data, error }) {
  if (error) return <div className="err-box" style={{ margin: 0 }}>{error}</div>;
  if (!data) return null;
  const plan = data.position_plan || {};
  const live = data.live_analysis || {};
  const summary = live.position_action_summary || live.portfolio_exit_v2?.position_action_summary;
  const showLiveTarget = summary?.show_live_target_as_secondary !== false;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ExitManagerV2Preview preview={live.portfolio_exit_v2} />
      <details open style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.018)", border: "1px solid var(--border2)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Decision Summary</summary>
        <div style={{ marginTop: 10 }}>
          <DetailGrid items={[
            ["Saved Entry", fmtMoney(plan.entry_price)],
            ["Saved Stop", fmtMoney(plan.stop_loss)],
            ["Current Price", fmtMoney(summary?.current_price ?? live.current_price)],
            ["Profit/Loss", fmtPctDash(summary?.unrealized_gain_pct)],
            ["Current R", summary?.current_r || fmtRMultiple(summary?.current_r_multiple)],
          ]} />
        </div>
      </details>
      <details style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.018)", border: "1px solid var(--border2)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Position Plan</summary>
        <div style={{ color: "var(--muted)", fontSize: 11, margin: "8px 0 10px" }}>Original saved trade plan. This is not changed by Live Analysis.</div>
        <DetailGrid items={[
          ["Entry", fmtMoney(plan.entry_price)],
          ["Target", fmtMoney(plan.target_price)],
          ["Stop", fmtMoney(plan.stop_loss)],
          ["Score at Entry", plan.score_at_entry ?? "-"],
          ["Setup at Entry", plan.setup_at_entry || "-"],
          ["R:R at Entry", fmtRR(plan.risk_reward_at_entry)],
        ]} />
      </details>
      <details style={{ padding: 12, borderRadius: 8, background: "rgba(0,255,178,0.035)", border: "1px solid rgba(0,255,178,0.16)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Technical Details</summary>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8, marginBottom: 3 }}>
          <div style={{ fontWeight: 800 }}>Live Analysis</div>
          {!live.suppress_entry_confirmation_badge && <AnalysisMetaBadges analysis={live} />}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>Current market analysis. Entry labels are secondary for existing positions.</div>
        {live.status === "failed" && <div className="err-box">Live analysis failed. {(live.live_reasons || []).join(" ")}</div>}
        <DetailGrid items={[
          ["Current Price", fmtMoney(live.current_price)],
          ["Live Score", live.live_score ?? "-"],
          ["Live Setup", live.live_setup || "-"],
          ["Live Signal", live.live_signal || "-"],
          ["Live Target", showLiveTarget ? fmtMoney(live.live_target) : "Secondary - avoid signal"],
          ["Live Stop", "Secondary - saved stop is primary"],
          ["Live R:R", showLiveTarget ? fmtRR(live.live_risk_reward) : "Secondary"],
          ["Analysis Time", formatLocalDateTime(live.analysis_time)],
        ]} />
        {(live.live_reasons || []).length > 0 && (
          <div className="signals-list" style={{ marginTop: 10 }}>
            {live.live_reasons.slice(0, 6).map((reason, i) => <span key={i} className="signal-pill">{reason}</span>)}
          </div>
        )}
      </details>
      <details style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.018)", border: "1px solid var(--border2)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Raw Diagnostics</summary>
        <SuggestedEntryZone zone={live.suggested_entry_zone} entrySignal={live.entry_signal} />
        <PositionSizingPreview sizing={live.position_sizing_preview} heat={live.portfolio_heat_preview} />
        <StructurePlanV2Preview plan={live.entry_plan_v2 || live.entry_plan_v2_json} />
        <DecisionLayerSections analysis={live} />
      </details>
    </div>
  );
}
function PortfolioPage({ positions, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editPos, setEditPos] = useState(null);
  const [closePos, setClosePos] = useState(null);
  const [closePrice, setClosePrice] = useState("");
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saveOk, setSaveOk]   = useState("");
  const [analyzeTicker, setAnalyzeTicker] = useState("");
  const [singleScan, setSingleScan] = useState(null);
  const [singleScanErr, setSingleScanErr] = useState("");
  const [singleScanLoading, setSingleScanLoading] = useState(false);
  const [liveAnalysis, setLiveAnalysis] = useState({});
  const [liveAnalysisLoading, setLiveAnalysisLoading] = useState("");
  const [liveAnalysisError, setLiveAnalysisError] = useState({});
  const [portfolioHeat, setPortfolioHeat] = useState(null);
  const [portfolioHeatErr, setPortfolioHeatErr] = useState("");
  const [form, setForm] = useState({
    ticker: "", entry_price: "", quantity: "",
    entry_date: new Date().toISOString().split("T")[0],
    target_price: "", stop_loss: "", notes: ""
  });

  const flash = (ok, msg) => {
    if (ok) { setSaveOk(msg); setSaveErr(""); setTimeout(() => setSaveOk(""), 3000); }
    else    { setSaveErr(msg); setSaveOk(""); }
  };

  const open = positions.filter(p => p.status !== "CLOSED");
  const totalPnLDollar = open.reduce((a, p) => a + (p.pnl_dollar || 0), 0);
  const totalMktVal    = open.reduce((a, p) => a + (p.market_value || 0), 0);
  const totalCost      = open.reduce((a, p) => a + (parseFloat(p.entry_price || 0) * parseInt(p.quantity || 0)), 0);
  const totalPnLPct    = totalCost > 0 ? (totalPnLDollar / totalCost) * 100 : 0;

  const loadPortfolioHeat = useCallback(async () => {
    const { data, error } = await api("/api/portfolio/heat");
    if (error) setPortfolioHeatErr(error); else { setPortfolioHeat(data); setPortfolioHeatErr(""); }
  }, []);

  useEffect(() => { loadPortfolioHeat(); }, [loadPortfolioHeat, positions.length]);

  const addPosition = async () => {
    setSaveErr("");
    if (!form.ticker || !form.entry_price || !form.quantity || !form.entry_date)
      return flash(false, "Please fill in Ticker, Entry Price, Quantity, and Date.");
    setSaving(true);
    const { error } = await api("/api/portfolio/add", {
      method: "POST",
      body: JSON.stringify({
        ...form, ticker: form.ticker.toUpperCase(),
        entry_price: parseFloat(form.entry_price), quantity: parseInt(form.quantity),
        target_price: form.target_price ? parseFloat(form.target_price) : null,
        stop_loss:    form.stop_loss    ? parseFloat(form.stop_loss)    : null,
      }),
    });
    setSaving(false);
    if (error) return flash(false, `Failed: ${error}`);
    flash(true, `✓ ${form.ticker.toUpperCase()} position logged!`);
    setShowAdd(false);
    setForm({ ticker: "", entry_price: "", quantity: "", entry_date: new Date().toISOString().split("T")[0], target_price: "", stop_loss: "", notes: "" });
    onRefresh();
  };

  const saveEdit = async () => {
    if (!editPos?.id) return;
    const toOptionalNumber = value => {
      if (value === "" || value === null || value === undefined) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : NaN;
    };
    const toRequiredNumber = (value, label) => {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`${label} must be a valid number.`);
      return n;
    };

    let payload;
    try {
      payload = {
        entry_price: toRequiredNumber(editPos.entry_price, "Entry"),
        quantity: Math.trunc(toRequiredNumber(editPos.quantity, "Quantity")),
        target_price: toOptionalNumber(editPos.target_price),
        stop_loss: toOptionalNumber(editPos.stop_loss),
        score_at_entry: toOptionalNumber(editPos.score_at_entry),
        setup_at_entry: editPos.setup_at_entry || "",
        notes: editPos.notes || "",
      };
      if (payload.quantity <= 0) throw new Error("Quantity must be greater than zero.");
      if ([payload.target_price, payload.stop_loss, payload.score_at_entry].some(Number.isNaN)) {
        throw new Error("Target, Stop, and Score must be valid numbers when entered.");
      }
    } catch (e) {
      return flash(false, e.message);
    }

    setSaveErr("");
    setSaving(true);
    const { error } = await api(`/api/portfolio/${editPos.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (error) return flash(false, `Update failed: ${error}`);
    flash(true, `${editPos.ticker} position updated.`);
    setEditPos(null);
    await onRefresh({ forcePortfolio: true });
  };

  const closePosition = async () => {
    setSaving(true);
    const { error } = await api(`/api/portfolio/${closePos.id}/close`, {
      method: "POST",
      body: JSON.stringify({ exit_price: parseFloat(closePrice), exit_date: new Date().toISOString().split("T")[0] }),
    });
    setSaving(false);
    if (error) return flash(false, `Close failed: ${error}`);
    setClosePos(null); setClosePrice(""); onRefresh();
  };

  const analyzeSingleTicker = async () => {
    const ticker = analyzeTicker.trim().toUpperCase();
    if (!ticker) return;
    setSingleScanLoading(true);
    setSingleScanErr("");
    const { data, error } = await api("/api/screener/single", {
      method: "POST",
      body: JSON.stringify({ ticker }),
    });
    setSingleScanLoading(false);
    if (error) {
      setSingleScan(null);
      setSingleScanErr(error);
      return;
    }
    setSingleScan(data);
  };

  const runLiveAnalysis = async (position) => {
    const symbol = portfolioSymbol(position);
    const key = portfolioKey(position) || symbol;
    if (!symbol || liveAnalysisLoading === key) return;
    setLiveAnalysisLoading(key);
    setLiveAnalysisError(prev => ({ ...prev, [key]: "" }));
    const { data, error } = await api("/api/portfolio/live-analysis", {
      method: "POST",
      body: JSON.stringify({
        symbol,
        position_id: position.id || null,
      }),
    });
    setLiveAnalysisLoading("");
    if (error || data?.live_analysis?.status === "failed") {
      const message = error || (data?.live_analysis?.live_reasons || []).join(" ") || "Live analysis failed.";
      setLiveAnalysis(prev => data ? { ...prev, [key]: data } : prev);
      setLiveAnalysisError(prev => ({ ...prev, [key]: message }));
      return;
    }
    setLiveAnalysis(prev => ({ ...prev, [key]: data }));
  };

  const singleScanQuoteTimestamp = singleScan?.selected_price_timestamp ?? singleScan?.quote?.selected_price_timestamp;
  const singleScanQuoteTime = formatQuoteTimeEt(singleScanQuoteTimestamp);
  const singleScanPriceStale = Boolean(singleScan?.price_stale ?? singleScan?.quote?.price_stale);

  return (
    <div className="fade-up">
      <PageBrief title="Portfolio">
        Tracks open positions and shows risk, portfolio heat, and exit previews. SwingAI does not execute trades, close positions, or change saved stops automatically.
      </PageBrief>
      <div className="grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Positions",     val: open.length,       sub: "open",                   color: "var(--blue)" },
          { label: "Market Value",  val: "$" + totalMktVal.toFixed(0), sub: `cost $${totalCost.toFixed(0)}`, color: "var(--text)" },
          { label: "Unrealized P&L",val: (totalPnLDollar >= 0 ? "+" : "") + "$" + Math.abs(totalPnLDollar).toFixed(0),
            sub: (totalPnLPct >= 0 ? "+" : "") + totalPnLPct.toFixed(1) + "%",  color: PNL_COLOR(totalPnLDollar) },
          { label: "Sell Signals",  val: open.filter(p => (p.sell_urgency || 0) >= 2).length, sub: "active",
            color: open.filter(p => (p.sell_urgency || 0) >= 2).length > 0 ? "var(--red)" : "var(--green)" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-sub" style={i === 2 ? { color: PNL_COLOR(totalPnLPct) } : {}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {saveErr && <div className="err-box">{saveErr}</div>}
      {saveOk  && <div className="ok-box">{saveOk}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Portfolio Heat</div>
            <div className="card-sub">Risk-planning estimate from open positions and saved stops.</div>
          </div>
          <button className="btn btn-ghost" onClick={loadPortfolioHeat} style={{ padding: "6px 12px", fontSize: 11 }}>Refresh Heat</button>
        </div>
        {portfolioHeatErr && <div className="err-box" style={{ marginTop: 10 }}>{portfolioHeatErr}</div>}
        <div className="grid-4" style={{ marginTop: 12 }}>
          {[
            ["Current Heat", portfolioHeat?.current_portfolio_heat_percent == null ? "-" : `${Number(portfolioHeat.current_portfolio_heat_percent).toFixed(2)}%`, `max ${portfolioHeat?.max_portfolio_heat_percent ?? "-"}%`, "var(--blue)"],
            ["Open Positions", portfolioHeat?.open_position_count ?? open.length, `max ${portfolioHeat?.max_open_positions ?? "-"}`, "var(--text)"],
            ["Open Risk", portfolioHeat?.current_open_risk == null ? "-" : `$${Number(portfolioHeat.current_open_risk).toFixed(0)}`, "if all stops hit", "var(--amber)"],
            ["Sectors", (portfolioHeat?.sector_exposure || []).length, "tracked exposure", "var(--green2)"],
          ].map(([label, val, sub, color]) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{val}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          ))}
        </div>
        {(portfolioHeat?.warnings || []).length > 0 && (
          <ul style={{ marginTop: 10, paddingLeft: 18, color: "var(--amber)", fontSize: 12, lineHeight: 1.6 }}>
            {portfolioHeat.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
          </ul>
        )}
        {(portfolioHeat?.sector_exposure || []).length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table style={{ minWidth: 520 }}>
              <thead><tr><th>Sector</th><th>Position Value</th><th>Exposure</th></tr></thead>
              <tbody>
                {portfolioHeat.sector_exposure.map(row => (
                  <tr key={row.sector_name}>
                    <td>{row.sector_name}</td><td>{fmtMoneyDash(row.position_value)}</td><td>{row.exposure_percent == null ? "-" : `${Number(row.exposure_percent).toFixed(2)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Exit Analysis</div>
            <div className="card-sub">Research-only. Does not execute trades or change saved stops.</div>
          </div>
        </div>
        {open.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>No open positions to evaluate.</div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {open.map((p, i) => {
              const preview = p.portfolio_exit_v2 || p.portfolio_exit_v2_json;
              const key = `${portfolioKey(p) || portfolioSymbol(p)}-exit-${i}`;
              return (
                <div key={key} style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.018)", border: "1px solid var(--border2)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontFamily: "var(--mono)" }}>{portfolioSymbol(p)}</div>
                    {preview ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="badge" style={exitV2Style(preview.exit_action)}>{preview.exit_action || "Data Limited"}</span>
                        <span className="badge" style={exitUrgencyStyle(preview.exit_urgency)}>{preview.exit_urgency || "Low"}</span>
                      </div>
                    ) : (
                      <span className="badge" style={exitV2Style("Data Limited")}>Data Limited</span>
                    )}
                  </div>
                  {preview ? (
                    <ExitManagerV2Preview preview={preview} compact />
                  ) : (
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>Refresh portfolio positions to load the V2 exit preview.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-title">Analyze Ticker</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Single ticker scan</label>
            <input
              className="input"
              placeholder="QBTS"
              value={analyzeTicker}
              onChange={e => setAnalyzeTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && analyzeSingleTicker()}
            />
          </div>
          <button className="btn btn-blue" onClick={analyzeSingleTicker} disabled={singleScanLoading || !analyzeTicker.trim()}>
            {singleScanLoading ? "Scanning..." : "Analyze"}
          </button>
        </div>
        {singleScanErr && <div className="err-box" style={{ marginTop: 10, marginBottom: 0 }}>{singleScanErr}</div>}
        {singleScan && (
          <div style={{ marginTop: 12, borderTop: "1px solid var(--border2)", paddingTop: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 16 }}>{singleScan.ticker}</div>
              {singleScan.score != null && <ScoreGauge score={singleScan.score} />}
              {confidenceValue(singleScan) != null && <span className="badge">Confidence {formatConfidence(singleScan)}</span>}
              {singleScan.setup && <span className="tag">{singleScan.setup}</span>}
              <AnalysisMetaBadges analysis={singleScan} />
              {singleScan.rescore_status && singleScan.rescore_status !== "ok" && <span className="badge">{singleScan.rescore_status}</span>}
            </div>
            {singleScan.current_price != null && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text2)" }}>
                Current: ${Number(singleScan.current_price).toFixed(2)}
                {singleScan.target != null && ` | Target: $${Number(singleScan.target).toFixed(2)}`}
                {singleScan.stop != null && ` | Stop: $${Number(singleScan.stop).toFixed(2)}`}
              </div>
            )}
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
              <span>Source: {singleScan.data_source || "-"}</span>
              <span>Quote time: {singleScanQuoteTime}</span>
              {singleScanPriceStale && (
                <span className="badge" style={{ color: "var(--amber)", borderColor: "rgba(251,176,36,0.35)", background: "rgba(251,176,36,0.08)" }}>
                  Price may be stale
                </span>
              )}
            </div>
            {singleScan.signals?.length > 0 && (
              <div className="signals-list" style={{ marginTop: 10 }}>
                {singleScan.signals.slice(0, 5).map((s, i) => <span key={i} className="signal-pill">{s}</span>)}
              </div>
            )}
            {confidenceValue(singleScan) != null && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Estimated confidence, not historical win rate.</div>
            )}
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 6, background: "rgba(255,255,255,0.035)", border: "1px solid var(--border2)" }}>
              <DetailGrid items={[
                ["Price Zone", priceZoneLabel(singleScan.price_zone_status || singleScan.entry_signal?.price_zone_status)],
                ["Confirmation", confirmationLabel(singleScan.confirmation_passed || singleScan.entry_signal?.confirmation_passed)],
                ["Signal Status", compactStatus(singleScan.entry_signal_status || singleScan.entry_signal?.status)],
                ["Signal Action", actionLabel(singleScan.entry_signal_action || singleScan.entry_signal?.action)],
                ["Buy Alert", (singleScan.entry_timing === "entry_ready" && (singleScan.confirmation_passed || singleScan.entry_signal?.confirmation_passed)) ? "Yes" : "No"],
                ["Block Reason", singleScan.entry_block_reason || singleScan.entry_signal?.entry_block_reason || "-"],
              ]} />
              {(singleScan.price_in_entry_zone || singleScan.entry_signal?.price_in_entry_zone) && !(singleScan.confirmation_passed || singleScan.entry_signal?.confirmation_passed) && (
                <div style={{ marginTop: 8, color: "var(--amber)", fontSize: 12, lineHeight: 1.5 }}>
                  Price is in the suggested entry zone, but Buy signal is not confirmed yet. Waiting for 1H confirmation.
                </div>
              )}
            </div>
            <UnifiedActionCard analysis={singleScan} mode="entry" />
            <SuggestedEntryZone zone={singleScan.suggested_entry_zone} entrySignal={singleScan.entry_signal} />
            <PositionSizingPreview sizing={singleScan.position_sizing_preview} heat={singleScan.portfolio_heat_preview} />
            <StructurePlanV2Preview plan={singleScan.entry_plan_v2 || singleScan.entry_plan_v2_json} />
            <DecisionLayerSections analysis={singleScan} />
          </div>
        )}
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Open Positions</div>
          <div className="section-sub">AI monitors these for sell signals automatically</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => onRefresh({ forcePortfolio: true })} style={{ padding: "6px 12px", fontSize: 11 }}>↺ Refresh</button>
          <button className="btn btn-green" onClick={() => setShowAdd(true)}>+ Log Position</button>
        </div>
      </div>

      {open.length === 0
        ? <div className="empty"><div style={{ fontSize: 32, marginBottom: 12 }}>📊</div><h3>No open positions</h3><p>Click "+ Log Position" after buying a stock</p></div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Ticker</th><th>Entry</th><th>Current</th><th>P&L</th><th>Qty</th><th>Value</th><th>Days</th><th>Progress</th><th>R:R</th><th>Signal</th><th>Reasons</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {open.map((p, i) => {
                    const key = portfolioKey(p) || `${portfolioSymbol(p)}-${i}`;
                    const live = liveAnalysis[key];
                    const liveErr = liveAnalysisError[key];
                    const liveLoading = liveAnalysisLoading === key;
                    const badge = URGENCY_BADGE[p.sell_urgency || 0];
                    return [
                      <tr key={key}>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>{p.ticker}</td>
                        <td>${parseFloat(p.entry_price).toFixed(2)}</td>
                        <td>
                          <div>${typeof p.current_price === "number" ? p.current_price.toFixed(2) : "–"}</div>
                          <PriceReliabilityBadge position={p} />
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, lineHeight: 1.35 }}>
                            {(p.quote_source || p.price_source || "source -")} · {p.quote_updated_at ? formatQuoteTimeEt(p.quote_updated_at) : "time -"}
                          </div>
                          <div style={{ fontSize: 10, color: p.quote_is_stale || p.data_freshness === "stale" ? "var(--amber)" : "var(--muted)", marginTop: 2, lineHeight: 1.35 }}>
                            {p.data_freshness || "freshness -"} · {p.market_session || "session -"}
                          </div>
                          <div style={{ fontSize: 10, color: PNL_COLOR(p.change_pct || 0) }}>{(p.change_pct || 0) >= 0 ? "+" : ""}{(p.change_pct || 0).toFixed(2)}%</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: PNL_COLOR(p.pnl_pct || 0) }}>{(p.pnl_pct || 0) >= 0 ? "+" : ""}{(p.pnl_pct || 0).toFixed(1)}%</div>
                          <div style={{ fontSize: 10, color: PNL_COLOR(p.pnl_dollar || 0) }}>{(p.pnl_dollar || 0) >= 0 ? "+" : ""}${Math.abs(p.pnl_dollar || 0).toFixed(0)}</div>
                        </td>
                        <td>{p.quantity}</td>
                        <td>${(p.market_value || 0).toFixed(0)}</td>
                        <td style={{ color: p.days_held > 15 ? "var(--amber)" : "var(--text2)" }}>{p.days_held}d</td>
                        <td style={{ minWidth: 100 }}>
                          <PositionBar entry={p.entry_price} current={p.current_price} target={p.target_price} stop={p.stop_loss} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--muted)", marginTop: 3 }}>
                            <span>${parseFloat(p.stop_loss || 0).toFixed(0)}</span>
                            <span>${parseFloat(p.target_price || 0).toFixed(0)}</span>
                          </div>
                        </td>
                        <td style={{ color: p.risk_reward_label || p.risk_reward ? "var(--blue)" : "var(--muted)" }}>
                          {p.risk_reward_label || (p.risk_reward != null ? `1:${Number(p.risk_reward).toFixed(1)}` : "-")}
                        </td>
                        <td><span className="badge" style={{ background: badge.bg, color: badge.text, borderColor: badge.border }}>{badge.label}</span></td>
                        <td style={{ maxWidth: 180, fontSize: 10, color: "var(--text2)", lineHeight: 1.5 }}>
                          <div>{(p.sell_reasons || []).slice(0, 2).join(" · ")}</div>
                          <div style={{ color: p.warning_validity_status?.startsWith("Data Stale") ? "var(--amber)" : "var(--muted)", marginTop: 4 }}>
                            {p.warning_validity_status || "-"}
                          </div>
                          <div style={{ color: "var(--muted)", marginTop: 2 }}>
                            Stop: {p.stop_check_basis || "-"} · Candle: {p.last_closed_candle_time || "-"}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-blue" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => runLiveAnalysis(p)} disabled={liveLoading}>
                              {liveLoading ? "Analyzing..." : "Run Live Analysis"}
                            </button>
                            <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => { setSaveErr(""); setSaveOk(""); setEditPos({ ...p }); }}>Edit</button>
                            <button className="btn btn-red" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => { setClosePos(p); setClosePrice(p.current_price?.toFixed(2) || ""); }}>Close</button>
                          </div>
                        </td>
                      </tr>,
                      (live || liveErr) && (
                        <tr key={`${key}-live`}>
                          <td colSpan={12} style={{ whiteSpace: "normal", background: "rgba(255,255,255,0.012)", padding: 14 }}>
                            <PortfolioLiveAnalysisPanel data={live} error={liveErr} />
                          </td>
                        </tr>
                      )
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📌 Log New Position</div>
            {saveErr && <div className="err-box">{saveErr}</div>}
            <div className="grid-2" style={{ gap: 10 }}>
              <div><label>Ticker *</label><input className="input" placeholder="AAPL" value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })} /></div>
              <div><label>Entry Price *</label><input className="input" type="number" step="0.01" placeholder="185.00" value={form.entry_price} onChange={e => setForm({ ...form, entry_price: e.target.value })} /></div>
              <div><label>Quantity *</label><input className="input" type="number" placeholder="10" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
              <div><label>Entry Date *</label><input className="input" type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></div>
              <div><label>Target Price (optional)</label><input className="input" type="number" step="0.01" placeholder="auto" value={form.target_price} onChange={e => setForm({ ...form, target_price: e.target.value })} /></div>
              <div><label>Stop Loss (optional)</label><input className="input" type="number" step="0.01" placeholder="auto" value={form.stop_loss} onChange={e => setForm({ ...form, stop_loss: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 10 }}><label>Notes</label><input className="input" placeholder="Why you entered…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-green" onClick={addPosition} disabled={saving}>{saving ? "Saving…" : "Log Position"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPos && (
        <div className="modal-overlay" onClick={() => setEditPos(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">✏️ Edit — {editPos.ticker}</div>
            <div className="grid-2" style={{ gap: 10 }}>
              <div><label>Entry Price</label><input className="input" type="number" step="0.01" value={editPos.entry_price ?? ""} onChange={e => setEditPos({ ...editPos, entry_price: e.target.value })} /></div>
              <div><label>Quantity</label><input className="input" type="number" step="1" value={editPos.quantity ?? ""} onChange={e => setEditPos({ ...editPos, quantity: e.target.value })} /></div>
              <div><label>Target Price</label><input className="input" type="number" step="0.01" value={editPos.target_price ?? ""} onChange={e => setEditPos({ ...editPos, target_price: e.target.value })} /></div>
              <div><label>Stop Loss</label><input className="input" type="number" step="0.01" value={editPos.stop_loss ?? ""} onChange={e => setEditPos({ ...editPos, stop_loss: e.target.value })} /></div>
              <div><label>Score at Entry</label><input className="input" type="number" step="1" value={editPos.score_at_entry ?? ""} onChange={e => setEditPos({ ...editPos, score_at_entry: e.target.value })} /></div>
              <div><label>Setup at Entry</label><input className="input" value={editPos.setup_at_entry || ""} onChange={e => setEditPos({ ...editPos, setup_at_entry: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 10 }}><label>Notes</label><input className="input" value={editPos.notes || ""} onChange={e => setEditPos({ ...editPos, notes: e.target.value })} /></div>
            {saveErr && <div className="err-box" style={{ marginTop: 10, marginBottom: 0 }}>{saveErr}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditPos(null)}>Cancel</button>
              <button className="btn btn-green" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {closePos && (
        <div className="modal-overlay" onClick={() => setClosePos(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🏁 Close — {closePos.ticker}</div>
            <div style={{ marginBottom: 14, padding: 12, background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>
              <div>Entry: <b>${parseFloat(closePos.entry_price).toFixed(2)}</b> × {closePos.quantity} shares</div>
              <div style={{ marginTop: 4 }}>Current P&L: <b style={{ color: PNL_COLOR(closePos.pnl_pct || 0) }}>{(closePos.pnl_pct || 0) >= 0 ? "+" : ""}{(closePos.pnl_pct || 0).toFixed(1)}%</b></div>
            </div>
            <label>Exit Price</label>
            <input className="input" type="number" step="0.01" value={closePrice} onChange={e => setClosePrice(e.target.value)} autoFocus />
            {closePrice && (
              <div style={{ marginTop: 10, padding: 10, background: "var(--bg3)", borderRadius: 6, fontSize: 12 }}>
                Final P&L: <b style={{ color: PNL_COLOR(parseFloat(closePrice) - parseFloat(closePos.entry_price)) }}>
                  {((parseFloat(closePrice) - parseFloat(closePos.entry_price)) / parseFloat(closePos.entry_price) * 100).toFixed(2)}%
                  (${((parseFloat(closePrice) - parseFloat(closePos.entry_price)) * closePos.quantity).toFixed(2)})
                </b>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setClosePos(null)}>Cancel</button>
              <button className="btn btn-red" onClick={closePosition} disabled={saving || !closePrice}>{saving ? "Closing…" : "Close Trade"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function HistoryPage() {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/portfolio/history").then(({ data, error }) => {
      if (error) setError(error);
      else setData(data);
    });
  }, []);

  if (error) return (
    <div className="fade-up">
      <div style={{ background: "rgba(255,77,77,.08)", border: "1px solid rgba(255,77,77,.25)", borderRadius: 8, padding: 16, fontSize: 13, color: "var(--red)" }}>
        <b>Could not load history:</b> {error}
        <div style={{ marginTop: 8, fontSize: 12, opacity: .7 }}>
          Run the database migration: Supabase → SQL Editor → paste migration.sql → Run
        </div>
      </div>
    </div>
  );

  if (!data) return <div className="loader"><div className="spin" /><p>Loading history…</p></div>;

  const { trades = [], stats = {} } = data;

  return (
    <div className="fade-up">
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Total Trades", val: stats.total_trades || 0,   sub: "closed",             color: "var(--text)" },
          { label: "Win Rate",     val: (stats.win_rate || 0) + "%", sub: `${stats.wins || 0}W / ${stats.losses || 0}L`, color: (stats.win_rate || 0) >= 60 ? "var(--green)" : "var(--amber)" },
          { label: "Avg Win",      val: "+" + (stats.avg_win_pct || 0) + "%", sub: "per win", color: "var(--green)" },
          { label: "Avg Loss",     val: (stats.avg_loss_pct || 0) + "%",      sub: "per loss",color: "var(--red)" },
        ].map((s, i) => (
          <div key={i} className="stat-card"><div className="stat-label">{s.label}</div><div className="stat-value" style={{ color: s.color }}>{s.val}</div><div className="stat-sub">{s.sub}</div></div>
        ))}
      </div>

      {trades.length > 2 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Cumulative P&L %</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={trades.slice().reverse().map((t, i, arr) => ({ i: i + 1, cumPnl: arr.slice(0, i + 1).reduce((a, x) => a + parseFloat(x.pnl_pct || 0), 0) }))}>
              <XAxis dataKey="i" hide />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,.1)" />
              <Area dataKey="cumPnl" name="Cum P&L%" stroke="var(--green)" fill="rgba(0,255,178,.1)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Ticker</th><th>Entry Date</th><th>Exit Date</th><th>Entry $</th><th>Exit $</th><th>Qty</th><th>P&L %</th><th>P&L $</th><th>Setup</th></tr>
            </thead>
            <tbody>
              {trades.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>No closed trades yet — close a position from the Portfolio tab</td></tr>
                : trades.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{t.ticker}</td>
                    <td style={{ color: "var(--text2)" }}>{t.entry_date || "–"}</td>
                    <td style={{ color: "var(--text2)" }}>{t.exit_date || "–"}</td>
                    <td>${parseFloat(t.entry_price || 0).toFixed(2)}</td>
                    <td>${parseFloat(t.exit_price || 0).toFixed(2)}</td>
                    <td>{t.quantity}</td>
                    <td style={{ fontWeight: 700, color: PNL_COLOR(parseFloat(t.pnl_pct || 0)) }}>{parseFloat(t.pnl_pct || 0) >= 0 ? "+" : ""}{parseFloat(t.pnl_pct || 0).toFixed(2)}%</td>
                    <td style={{ color: PNL_COLOR(parseFloat(t.pnl_dollar || 0)) }}>{parseFloat(t.pnl_dollar || 0) >= 0 ? "+" : ""}${Math.abs(parseFloat(t.pnl_dollar || 0)).toFixed(0)}</td>
                    <td><span className="tag">{t.setup || "–"}</span></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function AlertsPage() {
  const [alerts,      setAlerts]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [checking,    setChecking]    = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkErr,    setCheckErr]    = useState("");
  const [testMsg,     setTestMsg]     = useState("");
  const [sending,     setSending]     = useState(false);
  const [sendResult,  setSendResult]  = useState("");
  const [historyMsg,  setHistoryMsg]  = useState("");
  const [deletingId,  setDeletingId]  = useState("");
  const [clearing,    setClearing]    = useState(false);
  const [engineComparison, setEngineComparison] = useState(null);
  const [engineEvents, setEngineEvents] = useState([]);

  const loadAlertHistory = useCallback(() => {
    setLoading(true);
    api("/api/alerts/history").then(({ data, error }) => {
      if (!error && data?.alerts) setAlerts(data.alerts);
      setLoading(false);
    });
    api("/api/alert-engine/comparison").then(({ data }) => {
      if (data) setEngineComparison(data);
    });
    api("/api/alert-engine/events?limit=10").then(({ data }) => {
      if (data?.events) setEngineEvents(data.events);
    });
  }, []);

  useEffect(() => {
    loadAlertHistory();
  }, [loadAlertHistory]);

  const runCheck = async () => {
    setChecking(true); setCheckResult(null); setCheckErr("");
    const { data, error } = await api("/api/portfolio/check-alerts", { method: "POST" });
    setChecking(false);
    if (error) return setCheckErr(`Check failed: ${error}`);
    setCheckResult(data);
    loadAlertHistory();
  };

  const sendTest = async () => {
    if (!testMsg.trim()) return;
    setSending(true); setSendResult("");
    const { error } = await api("/api/alerts/custom", { method: "POST", body: JSON.stringify({ message: testMsg }) });
    setSending(false);
    setSendResult(error ? `❌ Failed: ${error}` : "✅ Sent to Telegram!");
    if (!error) setTestMsg("");
    setTimeout(() => setSendResult(""), 4000);
  };

  const deleteAlertHistory = async (alert) => {
    const id = alert?.id;
    if (!id) {
      setHistoryMsg("Cannot delete this record because it has no alert id.");
      return;
    }
    if (!window.confirm("Delete this alert history record?")) return;
    setDeletingId(String(id));
    setHistoryMsg("");
    const { error } = await api(`/api/alerts/history/${encodeURIComponent(id)}`, { method: "DELETE" });
    setDeletingId("");
    if (error) {
      setHistoryMsg(`Delete failed: ${error}`);
      return;
    }
    setAlerts(prev => prev.filter(a => String(a.id) !== String(id)));
    setHistoryMsg("Alert history record deleted.");
    setTimeout(() => setHistoryMsg(""), 3000);
  };

  const clearAlertHistory = async () => {
    if (alerts.length === 0 || clearing) return;
    if (!window.confirm("Delete all alert history records? This cannot be undone.")) return;
    setClearing(true);
    setHistoryMsg("");
    const { error } = await api("/api/alerts/history", { method: "DELETE" });
    setClearing(false);
    if (error) {
      setHistoryMsg(`Clear failed: ${error}`);
      return;
    }
    setAlerts([]);
    setHistoryMsg("Alert history cleared.");
    setTimeout(() => setHistoryMsg(""), 3000);
  };

  return (
    <div className="fade-up">
      <PageBrief title="Alerts">
        Alerts are reminders for manual review. SwingAI never executes orders — all trades are reviewed and placed manually by you.
      </PageBrief>
      <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <div className="card">
          <div className="card-title">📊 Portfolio Monitor</div>
          <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>
            Checks all open positions for sell signals and sends Telegram alerts.
          </p>
          {checkErr && <div className="err-box">{checkErr}</div>}
          {checkResult && (
            <div className="ok-box">
              ✓ Checked {checkResult.checked} positions — {checkResult.alerts_sent?.length || 0} alert{checkResult.alerts_sent?.length !== 1 ? "s" : ""} sent
              {checkResult.alerts_sent?.length > 0 && ` (${checkResult.alerts_sent.map(a => a.ticker).join(", ")})`}
            </div>
          )}
          <button className="btn btn-amber" onClick={runCheck} disabled={checking}>
            {checking ? "⏳ Checking positions…" : "▶ Run Sell Signal Check"}
          </button>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>
            💡 Automate with Windows Task Scheduler — call POST /api/portfolio/check-alerts every 4 hours
          </div>
        </div>
        <div className="card">
          <div className="card-title">📲 Send Custom Alert</div>
          <textarea className="input" rows={3} placeholder="Type any message to send to Telegram…"
            value={testMsg} onChange={e => setTestMsg(e.target.value)} style={{ resize: "none", marginBottom: 10 }} />
          {sendResult && <div style={{ fontSize: 12, color: sendResult.startsWith("✅") ? "var(--green)" : "var(--red)", marginBottom: 10 }}>{sendResult}</div>}
          <button className="btn btn-blue" onClick={sendTest} disabled={sending || !testMsg.trim()}>{sending ? "Sending…" : "Send to Telegram"}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Alert Engine</div>
            <div className="card-sub">Shadow mode does not notify or place trades.</div>
          </div>
        </div>
        <div className="grid-4" style={{ marginTop: 12 }}>
          {[
            ["Total Checks", engineComparison?.total_checks ?? 0, "shadow events", "var(--text)"],
            ["V1 Alerts", engineComparison?.v1_triggered_count ?? 0, "triggered", "var(--blue)"],
            ["V2 Shadow Alerts", engineComparison?.v2_triggered_count ?? 0, "candidates", "var(--amber)"],
            ["Both Agreed", engineComparison?.both_triggered_count ?? 0, "overlap", "var(--green)"],
            ["V1 Only", engineComparison?.v1_only_count ?? 0, "legacy only", "var(--blue)"],
            ["V2 Only", engineComparison?.v2_only_count ?? 0, "shadow only", "var(--amber)"],
            ["Neither", engineComparison?.neither_count ?? 0, "no alert", "var(--muted)"],
            ["Final Sent", engineComparison?.final_alerts_sent_count ?? 0, "actual alerts", "var(--green2)"],
          ].map(([label, val, sub, color]) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{val}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          ))}
        </div>
        {(engineComparison?.v2_blocked_reasons || []).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>Top V2 Blocked Reasons</div>
            <div className="signals-list">
              {engineComparison.v2_blocked_reasons.slice(0, 8).map(row => <span key={row.reason} className="signal-pill">{row.reason}: {row.count}</span>)}
            </div>
          </div>
        )}
        {engineEvents.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table style={{ minWidth: 860 }}>
              <thead><tr><th>Time</th><th>Ticker</th><th>Type</th><th>Mode</th><th>V1</th><th>V2</th><th>Comparison</th><th>Sent</th></tr></thead>
              <tbody>
                {engineEvents.map(row => (
                  <tr key={row.id || `${row.ticker}-${row.created_at}`}>
                    <td>{formatLocalDateTime(row.created_at)}</td><td>{row.ticker || "-"}</td><td>{row.event_type || "-"}</td><td>{row.alert_mode || "-"}</td><td>{row.v1_action || "-"}</td><td>{row.v2_action || row.v2_signal || "-"}</td><td>{row.comparison_status || "-"}</td><td>{row.final_alert_sent ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-header" style={{ marginBottom: 10 }}>
        <div className="section-title">Alert History</div>
        <button className="btn btn-red" onClick={clearAlertHistory} disabled={clearing || alerts.length === 0} style={{ padding: "5px 10px", fontSize: 10 }}>
          {clearing ? "Clearing..." : "Clear All History"}
        </button>
      </div>
      {historyMsg && <div className={historyMsg.includes("failed") || historyMsg.includes("Cannot") ? "err-box" : "ok-box"}>{historyMsg}</div>}

      {loading
        ? <div className="loader"><div className="spin" /><p>Loading…</p></div>
        : alerts.length === 0
          ? <div className="empty"><h3>No alerts yet</h3><p>Run a sell signal check or send a custom alert above</p></div>
          : alerts.map((a, i) => (
            <div key={a.id || i} className={`alert-card alert-${a.type?.startsWith("BUY") ? "buy" : a.type?.includes("SELL") ? "sell" : "info"}`}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13 }}>{a.ticker || "—"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span className="badge" style={a.type?.startsWith("BUY") ? { color: "var(--green)", borderColor: "var(--green)", background: "rgba(0,255,178,.1)" } :
                    a.type?.includes("SELL") ? { color: "var(--red)", borderColor: "var(--red)", background: "rgba(255,77,77,.1)" } :
                    { color: "var(--blue)", borderColor: "var(--blue)" }}>{a.type}</span>
                  <button className="btn btn-red" onClick={() => deleteAlertHistory(a)} disabled={deletingId === String(a.id) || !a.id} style={{ minHeight: 24, padding: "3px 8px", fontSize: 10 }}>
                    {deletingId === String(a.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                <span>{a.price ? `@ $${parseFloat(a.price).toFixed(2)}` : ""}</span>
                <span>{new Date(a.sent_at).toLocaleString()}</span>
              </div>
            </div>
          ))
      }
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function ConditionList({ items }) {
  const list = listify(items);
  if (!list.length) return <span style={{ color: "var(--muted)" }}>-</span>;
  return (
    <div className="signals-list" style={{ minWidth: 220 }}>
      {list.map((item, i) => <span key={i} className="signal-pill">{String(item)}</span>)}
    </div>
  );
}

function EntryWatchlistPage() {
  const [watches, setWatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [clockTick, setClockTick] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [checking, setChecking] = useState(false);
  const refreshInFlightRef = useRef(false);

  const loadWatches = useCallback(async (opts = {}) => {
    if (refreshInFlightRef.current) return;
    const auto = Boolean(opts.auto);
    refreshInFlightRef.current = true;
    setRefreshing(true);
    setError("");
    const { data, error } = await api("/api/entry-watchlist");
    refreshInFlightRef.current = false;
    setRefreshing(false);
    if (error) {
      setError(error);
      if (!auto) setWatches([]);
    } else {
      const nextWatches = Array.isArray(data?.watches) ? data.watches : [];
      setWatches(nextWatches);
      setLastUpdatedAt(new Date());
      if (auto) console.log(`ENTRY_WATCHLIST_AUTO_REFRESH_SUCCESS count=${nextWatches.length}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    console.log("ENTRY_WATCHLIST_AUTO_REFRESH_START");
    loadWatches({ auto: true });
    const refreshTimer = window.setInterval(() => loadWatches({ auto: true }), 60000);
    const clockTimer = window.setInterval(() => setClockTick(t => t + 1), 15000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      console.log("ENTRY_WATCHLIST_AUTO_REFRESH_STOP");
    };
  }, [loadWatches]);

  const cancelWatch = async watch => {
    if (!watch?.id || busyId) return;
    setBusyId(watch.id);
    setError("");
    setMessage("");
    const { error } = await api(`/api/entry-watchlist/${watch.id}`, { method: "DELETE" });
    setBusyId("");
    if (error) {
      setError(error);
      return;
    }
    setMessage(`${watch.ticker} watch cancelled.`);
    await loadWatches({ manual: true });
  };

  const checkWatches = async () => {
    if (checking) return;
    setChecking(true);
    setError("");
    setMessage("");
    const { data, error } = await api("/api/entry-watchlist/check", { method: "POST" });
    setChecking(false);
    if (error) {
      setError(error);
      return;
    }
    if (Array.isArray(data?.watches)) setWatches(data.watches);
    setMessage(`Checked ${data?.checked ?? 0} entry watch${data?.checked === 1 ? "" : "es"}.`);
    await loadWatches({ manual: true });
  };

  const lastUpdatedLabel = lastUpdatedAt
    ? `${Math.max(0, Math.round((Date.now() - lastUpdatedAt.getTime()) / 1000))} seconds ago`
    : "not yet";
  void clockTick;

  return (
    <div className="fade-up">
      <PageBrief title="Entry Watchlist">
        Monitors saved setups for price zone and confirmation. It can create alerts based on configured alert modes, but it does not place buy orders.
      </PageBrief>
      <div className="section-header">
        <div>
          <div className="section-title">Entry Signal Watchlist</div>
          <div className="section-sub">This watchlist is monitored automatically. Manual Check is optional.</div>
          <div style={{ marginTop: 6, fontSize: 11, color: refreshing ? "var(--blue)" : "var(--muted)" }}>
            {refreshing ? "Auto-refreshing..." : `Last updated: ${lastUpdatedLabel}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => loadWatches({ manual: true })} disabled={loading || refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-blue" onClick={checkWatches} disabled={checking}>{checking ? "Checking..." : "Manual Check"}</button>
        </div>
      </div>

      {error && <div className="err-box">{error}</div>}
      {message && <div className="ok-box">{message}</div>}

      {loading ? (
        <div className="loader"><div className="spin" /><p>Loading Entry Watchlist...</p></div>
      ) : watches.length === 0 ? (
        <div className="empty">
          <h3>No entry watches</h3>
          <p>Use "Watch Entry Signal" from a ticker result before buying.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table style={{ minWidth: 1240 }}>
              <thead>
                <tr>
                  <th>Ticker</th><th>Status</th><th>Action / Timing</th><th>Context</th><th>Setup</th><th>Live Price</th><th>Entry Zone</th><th>Target</th><th>In Zone</th><th>Why No Alert</th><th>Last Checked</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {watches.map(w => {
                  const status = w.status || "waiting_for_1h_confirmation";
                  const confirmed = status === "entry_confirmed" || w.entry_signal_status === "confirmed";
                  const timing = normalizedWatchEntryTiming(w);
                  const whyNoAlert = w.missing_conditions?.length
                    ? `Needs: ${[...(w.missing_conditions || [])].slice(0, 2).join("; ")}`
                    : w.entry_block_reason || w.entry_signal_reason || "-";
                  return (
                    <tr key={w.id || `${w.ticker}-${w.created_at}`}>
                      <td style={{ fontWeight: 800, fontSize: 13 }}>{String(w.ticker || "").toUpperCase()}</td>
                      <td><span className="badge" style={entryStatusStyle(status)}>{ENTRY_STATUS_LABELS[status] || compactStatus(status)}</span></td>
                      <td>
                        <span className="badge" style={decisionStatusStyle(timing)}>{timingLabel(timing)}</span>
                        {(w.entry_plan_v2_json || w.v2_entry_plan_type) && (
                          <div style={{ marginTop: 4 }}>
                            <span className="tag" style={{ fontSize: 10, color: "var(--green2)", borderColor: "rgba(163,247,191,0.32)" }}>
                              {w.v2_plan_quality || "Watch"} · {normalizeActionLabel(w.v2_action_status || w.v2_entry_plan_type || "watch_only")}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <MarketRegimeBadge analysis={w} />
                          <LeadershipBadge analysis={w} />
                        </div>
                        <div style={{ marginTop: 4 }}><SectorStrengthBadge analysis={w} /></div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{w.setup || "-"}</div>
                        <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted)" }}>Score {w.score ?? w.confidence ?? "-"}</div>
                        {w.suggested_shares != null && (
                          <div style={{ marginTop: 4 }}>
                            <span className="tag" style={{ fontSize: 10, color: "var(--blue)", borderColor: "rgba(77,166,255,0.32)" }}>
                              {w.suggested_shares} sh
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{fmtMoney(w.current_price)}</div>
                        <div style={{ marginTop: 2, fontSize: 10, color: w.price_stale ? "var(--amber)" : "var(--muted)", lineHeight: 1.3 }}>
                          {w.price_stale ? "⚠ Stale" : (w.price_source || "saved")}
                        </div>
                      </td>
                      <td>
                        <div style={{ color: "var(--green)", fontWeight: 600 }}>{fmtMoney(w.preferred_entry ?? w.conservative_entry)}</div>
                        <div style={{ marginTop: 2, fontSize: 11, color: "var(--red)" }}>Stop {fmtMoney(w.ideal_stop)}</div>
                      </td>
                      <td style={{ color: "var(--green2)" }}>{fmtMoney(w.target)}</td>
                      <td>
                        <span className="badge" style={{ color: w.price_in_entry_zone ? "var(--green)" : "var(--amber)", borderColor: w.price_in_entry_zone ? "rgba(34,197,94,0.35)" : "rgba(251,176,36,0.35)", background: w.price_in_entry_zone ? "rgba(34,197,94,0.08)" : "rgba(251,176,36,0.08)" }}>
                          {w.price_in_entry_zone ? "Yes" : "No"}
                        </span>
                        {w.distance_to_entry_pct != null && (
                          <div style={{ marginTop: 3, fontSize: 10, color: "var(--muted)" }}>{Number(w.distance_to_entry_pct).toFixed(1)}% away</div>
                        )}
                      </td>
                      <td style={{ whiteSpace: "normal", minWidth: 200, lineHeight: 1.45, fontSize: 11, color: "var(--text2)" }}>{whyNoAlert}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDateTime(w.last_checked_at || w.updated_at)}</td>
                      <td>
                        <button className="btn btn-red" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => cancelWatch(w)} disabled={busyId === w.id || ["cancelled", "expired", "invalidated"].includes(status)}>
                          {busyId === w.id ? "Cancelling..." : "Cancel"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadershipBoardPage() {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sector, setSector] = useState("");
  const [label, setLabel] = useState("");
  const [showAllScanned, setShowAllScanned] = useState(false);
  const [minLeadershipScore, setMinLeadershipScore] = useState("60");
  const [quickFilter, setQuickFilter] = useState("");
  const [limit, setLimit] = useState("200");

  const loadBoard = useCallback(async (opts = {}) => {
    setError("");
    if (opts.refresh) setRefreshing(true); else setLoading(true);
    const params = new URLSearchParams({
      limit: limit || "200",
      include_laggards: "true",
    });
    if (opts.forceRefresh) params.set("force_refresh", "true");
    const { data, error: err } = opts.post
      ? await api(`/api/leadership-board/refresh?limit=${encodeURIComponent(limit || "200")}`, { method: "POST" })
      : await api(`/api/leadership-board?${params.toString()}`);
    if (err) setError(err);
    else setBoard(data);
    setLoading(false);
    setRefreshing(false);
  }, [limit]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const allRows = board?.ranked || [];
  const minScoreNumber = minLeadershipScore === "" ? null : Number(minLeadershipScore);
  const visibleLeadershipLabels = ["Top Leader", "Strong Leader", "Emerging Leader", "Constructive Watch", "Laggard", "Excluded"];
  const strongSectorLabels = new Set(["Leading", "Strong"]);
  const rows = allRows.filter(r => {
    const rowLabel = r.leadership_rank_label || "";
    const score = Number(r.leadership_ranking_score);
    const sectorScore = Number(r.sector_strength_score);
    if (!showAllScanned && ["Excluded", "Laggard"].includes(rowLabel)) return false;
    if (sector && String(r.sector_name || "") !== sector) return false;
    if (label && rowLabel !== label) return false;
    if (Number.isFinite(minScoreNumber) && (!Number.isFinite(score) || score < minScoreNumber)) return false;
    if (quickFilter === "leaders" && !["Top Leader", "Strong Leader", "Emerging Leader"].includes(rowLabel)) return false;
    if (quickFilter === "watch" && !["Emerging Leader", "Constructive Watch"].includes(rowLabel)) return false;
    if (quickFilter === "strong_sectors" && !strongSectorLabels.has(r.sector_strength_label) && !(Number.isFinite(sectorScore) && sectorScore >= 62)) return false;
    return true;
  });
  const sectors = Array.from(new Set(allRows.map(r => r.sector_name).filter(Boolean))).sort();
  const applyQuickFilter = preset => {
    setQuickFilter(preset);
    if (preset === "leaders") {
      setShowAllScanned(false);
      setMinLeadershipScore("72");
      setLabel("");
    } else if (preset === "watch") {
      setShowAllScanned(false);
      setMinLeadershipScore("45");
      setLabel("");
    } else if (preset === "excluded") {
      setShowAllScanned(true);
      setMinLeadershipScore("");
      setLabel("Excluded");
    } else if (preset === "strong_sectors") {
      setShowAllScanned(false);
      setMinLeadershipScore("60");
      setLabel("");
    }
  };
  const handleLeadershipLabelChange = value => {
    setLabel(value);
    setQuickFilter("");
    if (["Laggard", "Excluded"].includes(value)) {
      setShowAllScanned(true);
      setMinLeadershipScore("");
    }
  };
  const handleShowAllScannedChange = checked => {
    setShowAllScanned(checked);
    setQuickFilter("");
    if (checked) {
      setMinLeadershipScore("");
      setLabel("");
    } else {
      setMinLeadershipScore("60");
    }
  };
  return (
    <div>
      <PageBrief title="Leadership Board">
        Ranks stocks by relative strength, sector strength, liquidity, and leadership persistence. This is not a buy list; use setup and entry confirmation before acting.
      </PageBrief>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div className="card-title">Leadership Board</div>
            <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
              Leadership Board ranks relative strength and sector leadership. It does not mean immediate buy. Use Entry Ready / Wait for Confirmation for timing.
              Excluded means the ticker was scanned but failed leadership qualification.
            </div>
          </div>
          <button className="btn btn-blue" onClick={() => loadBoard({ post: true, refresh: true })} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh Board"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "end" }}>
          <div>
            <label>Limit</label>
            <select className="input" value={limit} onChange={e => setLimit(e.target.value)} style={{ minWidth: 95 }}>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
              <option value="200">All</option>
            </select>
          </div>
          <div>
            <label>Min Leadership Score</label>
            <input className="input" type="number" min="0" max="100" step="1" value={minLeadershipScore} onChange={e => { setMinLeadershipScore(e.target.value); setQuickFilter(""); }} style={{ minWidth: 160 }} />
          </div>
          <div>
            <label>Sector</label>
            <select className="input" value={sector} onChange={e => { setSector(e.target.value); setQuickFilter(""); }} style={{ minWidth: 180 }}>
              <option value="">All sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label>Leadership Label</label>
            <select className="input" value={label} onChange={e => handleLeadershipLabelChange(e.target.value)} style={{ minWidth: 190 }}>
              <option value="">All labels</option>
              {visibleLeadershipLabels.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "var(--text2)", fontSize: 12, marginBottom: 10 }}>
            <input type="checkbox" checked={showAllScanned} onChange={e => handleShowAllScannedChange(e.target.checked)} />
            Show All Scanned
          </label>
          <button className="btn btn-ghost" onClick={() => loadBoard()} disabled={loading || refreshing}>Apply</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="btn btn-ghost" onClick={() => applyQuickFilter("leaders")}>Leaders Only</button>
          <button className="btn btn-ghost" onClick={() => applyQuickFilter("watch")}>Watch Candidates</button>
          <button className="btn btn-ghost" onClick={() => applyQuickFilter("excluded")}>Show Excluded</button>
          <button className="btn btn-ghost" onClick={() => applyQuickFilter("strong_sectors")}>Strong Sectors Only</button>
        </div>
        {board && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
            <span>Updated: {fmtDateTime(board.created_at)}</span>
            <span>Universe: {board.universe_source || "-"}</span>
            <span>Showing: {rows.length}</span>
            <span>Scanned: {board.count ?? allRows.length}</span>
            {board.provider_warning && <span style={{ color: "var(--amber)" }}>{board.provider_warning}</span>}
          </div>
        )}
      </div>

      {error && <div className="err-box">{error}</div>}
      {loading ? (
        <div className="loader"><div className="spin" /><p>Loading Leadership Board...</p></div>
      ) : rows.length === 0 ? (
        <div className="empty"><h3>No leadership rankings yet</h3><p>Refresh the board to create the first snapshot.</p></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table style={{ minWidth: 1480 }}>
              <thead>
                <tr>
                  <th>Rank</th><th>Ticker</th><th>Leadership</th><th>Score</th><th>Trend</th><th>Sector</th><th>Sector Strength</th><th>RS 1M SPY</th><th>RS 3M SPY</th><th>RS 3M Sector</th><th>Technical Score</th><th>Action</th><th>Volume</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={`${r.scan_session || board.scan_session}-${r.ticker}-${r.leadership_rank}`}>
                    <td style={{ fontWeight: 800 }}>{r.leadership_rank ?? "-"}</td>
                    <td style={{ fontWeight: 800, fontSize: 13 }}>{r.ticker}</td>
                    <td><span className="badge" style={leadershipStyle(r.leadership_rank_label)}>{r.leadership_rank_label || "-"}</span></td>
                    <td>{r.leadership_ranking_score == null ? "-" : Number(r.leadership_ranking_score).toFixed(0)}</td>
                    <td>{r.leadership_trend || "-"}</td>
                    <td>{sectorMappingMissing(r) ? "Sector mapping missing" : (r.sector_name || "-")}</td>
                    <td><SectorStrengthBadge analysis={r} /></td>
                    <td>{rsCellValue(r, "rs_1m_vs_spy")}</td>
                    <td>{rsCellValue(r, "rs_3m_vs_spy")}</td>
                    <td>{rsCellValue(r, "rs_3m_vs_sector")}</td>
                    <td>{r.technical_score ?? "-"}</td>
                    <td><ActionStatusBadge analysis={r} /></td>
                    <td>{r.volume_confidence || "-"}</td>
                    <td>{fmtDateTime(r.created_at || board.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function pctCell(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return "-";
  const n = Number(value);
  return <span style={{ color: n >= 0 ? "var(--green)" : "var(--red)" }}>{n >= 0 ? "+" : ""}{n.toFixed(2)}%</span>;
}

function UniverseAnalyticsPage() {
  const [days, setDays] = useState("5");
  const [filters, setFilters] = useState({ universe_source: "", market_regime: "", sector: "", setup_type: "", action_status: "", leadership_label: "", v2_entry_plan_type: "", v2_plan_quality: "" });
  const [comparison, setComparison] = useState(null);
  const [v1v2, setV1v2] = useState(null);
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingV2, setUpdatingV2] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const queryString = useCallback(() => {
    const params = new URLSearchParams({ days });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [days, filters]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = queryString();
    const [comparisonRes, v1v2Res, outcomesRes] = await Promise.all([
      api(`/api/analytics/universe-comparison?${qs}`),
      api(`/api/analytics/v1-v2-comparison?${qs}`),
      api(`/api/analytics/signal-outcomes?limit=100&include_v2=true&days=${encodeURIComponent(days)}${filters.universe_source ? `&universe_source=${encodeURIComponent(filters.universe_source)}` : ""}`),
    ]);
    if (comparisonRes.error) setError(comparisonRes.error); else setComparison(comparisonRes.data);
    if (v1v2Res.error) setError(v1v2Res.error); else setV1v2(v1v2Res.data);
    if (outcomesRes.error) setError(outcomesRes.error); else setOutcomes(outcomesRes.data?.rows || []);
    setLoading(false);
  }, [queryString, days, filters.universe_source]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const updateOutcomes = async () => {
    setUpdating(true);
    setMessage("");
    setError("");
    const { data, error } = await api("/api/analytics/update-outcomes", { method: "POST" });
    if (error) setError(error);
    else {
      setMessage(`Outcome update checked ${data?.checked ?? 0} signals; updated ${data?.updated ?? 0}.`);
      await loadAnalytics();
    }
    setUpdating(false);
  };

  const updateV2Outcomes = async () => {
    setUpdatingV2(true);
    setMessage("");
    setError("");
    const { data, error } = await api("/api/analytics/update-v2-outcomes", { method: "POST" });
    if (error) setError(error);
    else {
      setMessage(`V2 outcome update checked ${data?.checked ?? 0} signals; updated ${data?.updated ?? 0}, skipped ${data?.skipped_no_plan ?? 0}.`);
      await loadAnalytics();
    }
    setUpdatingV2(false);
  };

  const groups = comparison?.groups || [];
  const selectedGroup = groups.find(g => g.universe_source === filters.universe_source) || groups.find(g => g.evaluated_count > 0) || groups[0] || {};
  const best = selectedGroup.best_tickers || [];
  const worst = selectedGroup.worst_tickers || [];
  const topSetups = selectedGroup.top_setup_types || [];
  const weakSetups = selectedGroup.weak_setup_types || [];
  const v1v2Summary = v1v2?.summary || {};
  const v1v2Breakdowns = v1v2?.breakdowns || {};
  const v1v2Examples = v1v2?.examples || {};
  const v1v2Recent = v1v2?.recent || [];
  const breakdownTable = (title, rows = []) => (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table style={{ minWidth: 620 }}>
          <thead><tr><th>Group</th><th>Compared</th><th>V2 Better</th><th>Avg Delta</th><th>Drawdown Delta</th><th>V1 Stop</th><th>V2 Stop</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 18 }}>No comparable rows yet.</td></tr> : rows.map(row => (
              <tr key={`${title}-${row.label}`}>
                <td>{row.label}</td><td>{row.compared_count ?? 0}</td><td>{pctCell(row.v2_better_rate)}</td><td>{pctCell(row.avg_return_delta)}</td><td>{pctCell(row.avg_drawdown_delta)}</td><td>{pctCell(row.v1_stop_hit_rate)}</td><td>{pctCell(row.v2_stop_hit_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  const exampleList = (title, rows = []) => (
    <div>
      <b style={{ display: "block", marginBottom: 8 }}>{title}</b>
      {rows.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 12 }}>No examples yet.</div> : rows.map(item => (
        <div key={`${title}-${item.ticker}-${item.signal_date}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border2)" }}>
          <span><b>{item.ticker}</b> <span style={{ color: "var(--muted)", fontSize: 11 }}>{item.v2_entry_plan_type || item.v2_action || item.comparison_status}</span></span>
          <span>{item.return_delta == null ? pctCell(item.v1_return) : pctCell(item.return_delta)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid">
      <PageBrief title="Analytics">
        Measures historical signal follow-through and compares V1/V2 logic. Sample sizes may be limited and results do not predict future performance.
      </PageBrief>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Universe Analytics</div>
            <div className="card-sub">Historical signal follow-through by scanner universe.</div>
          </div>
          <button className="btn btn-green" onClick={updateOutcomes} disabled={updating}>{updating ? "Updating..." : "Update Outcomes"}</button>
        </div>
        <div className="note" style={{ marginTop: 12 }}>Analytics are historical signal follow-through, not financial advice and not a guarantee of future performance.</div>
        {message && <div className="success" style={{ marginTop: 12 }}>{message}</div>}
        {error && <div className="err-box" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="card">
        <div className="filters">
          <div><label>Window</label><select className="input" value={days} onChange={e => setDays(e.target.value)}><option value="5">5D</option><option value="10">10D</option><option value="20">20D</option></select></div>
          <div><label>Universe</label><select className="input" value={filters.universe_source} onChange={e => setFilters(f => ({ ...f, universe_source: e.target.value }))}><option value="">All</option><option value="active_stocks_200">Active Stocks 200</option><option value="leadership_universe">Leadership Universe</option><option value="leadership_plus_active">Leadership + Active</option></select></div>
          <div><label>Market Regime</label><input className="input" value={filters.market_regime} onChange={e => setFilters(f => ({ ...f, market_regime: e.target.value }))} placeholder="Bull, Choppy..." /></div>
          <div><label>Sector</label><input className="input" value={filters.sector} onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))} placeholder="Technology..." /></div>
          <div><label>Setup Type</label><input className="input" value={filters.setup_type} onChange={e => setFilters(f => ({ ...f, setup_type: e.target.value }))} placeholder="Trend Continuation" /></div>
          <div><label>Action Status</label><input className="input" value={filters.action_status} onChange={e => setFilters(f => ({ ...f, action_status: e.target.value }))} placeholder="entry_ready" /></div>
          <div><label>Leadership Label</label><input className="input" value={filters.leadership_label} onChange={e => setFilters(f => ({ ...f, leadership_label: e.target.value }))} placeholder="Leader" /></div>
          <div><label>V2 Plan Type</label><input className="input" value={filters.v2_entry_plan_type} onChange={e => setFilters(f => ({ ...f, v2_entry_plan_type: e.target.value }))} placeholder="Breakout..." /></div>
          <div><label>V2 Quality</label><select className="input" value={filters.v2_plan_quality} onChange={e => setFilters(f => ({ ...f, v2_plan_quality: e.target.value }))}><option value="">All</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="Watch">Watch</option><option value="Avoid">Avoid</option></select></div>
        </div>
      </div>

      {loading ? <div className="loader"><div className="spin" /><p>Loading analytics...</p></div> : (
        <>
          <div className="card">
            <div className="card-title">Universe Comparison</div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table style={{ minWidth: 1180 }}>
                <thead><tr><th>Universe Source</th><th>Signals</th><th>Avg Return</th><th>Median</th><th>Win Rate</th><th>Target Hit</th><th>Stop Hit</th><th>Avg Max Gain</th><th>Avg Max Drawdown</th><th>Sample</th></tr></thead>
                <tbody>
                  {groups.map(group => (
                    <tr key={group.universe_source}>
                      <td>{group.universe_source}</td><td>{group.evaluated_count ?? group.count}</td><td>{pctCell(group[`avg_return_${days}d`])}</td><td>{pctCell(group.median_return)}</td><td>{pctCell(group.win_rate)}</td><td>{pctCell(group.target_hit_rate)}</td><td>{pctCell(group.stop_hit_rate)}</td><td>{pctCell(group.avg_max_gain)}</td><td>{pctCell(group.avg_max_drawdown)}</td>
                      <td><span className="tag">{group.sample_size_label}</span><div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{group.sample_size_warning}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">V1 vs V2 Plan Comparison</div>
                <div className="card-sub">Hypothetical V2 follow-through versus current V1 signal outcomes.</div>
              </div>
              <button className="btn" onClick={updateV2Outcomes} disabled={updatingV2}>{updatingV2 ? "Updating V2..." : "Update V2 Outcomes"}</button>
            </div>
            <div className="note" style={{ marginTop: 12 }}>V2 comparison is hypothetical. It does not prove future performance and does not activate V2 alerts.</div>
            {v1v2Summary.sample_size_warning && <div className="note" style={{ marginTop: 10 }}>{v1v2Summary.sample_size_warning}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12 }}>
              {[
                ["Compared Signals", v1v2Summary.compared_count ?? 0],
                ["V2 Better Rate", v1v2Summary.v2_better_rate == null ? "-" : `${Number(v1v2Summary.v2_better_rate).toFixed(1)}%`],
                ["Average Return Delta", v1v2Summary.avg_v2_vs_v1_return_delta == null ? "-" : pctCell(v1v2Summary.avg_v2_vs_v1_return_delta)],
                ["Average Drawdown Delta", v1v2Summary.avg_v2_vs_v1_drawdown_delta == null ? "-" : pctCell(v1v2Summary.avg_v2_vs_v1_drawdown_delta)],
                ["V1 Stop Hit Rate", v1v2Summary.v1_stop_hit_rate == null ? "-" : `${Number(v1v2Summary.v1_stop_hit_rate).toFixed(1)}%`],
                ["V2 Stop Hit Rate", v1v2Summary.v2_stop_hit_rate == null ? "-" : `${Number(v1v2Summary.v2_stop_hit_rate).toFixed(1)}%`],
                ["V1 Target Hit Rate", v1v2Summary.v1_target_hit_rate == null ? "-" : `${Number(v1v2Summary.v1_target_hit_rate).toFixed(1)}%`],
                ["V2 Target 1 Hit Rate", v1v2Summary.v2_target_1_hit_rate == null ? "-" : `${Number(v1v2Summary.v2_target_1_hit_rate).toFixed(1)}%`],
                ["V2 Target 2 Hit Rate", v1v2Summary.v2_target_2_hit_rate == null ? "-" : `${Number(v1v2Summary.v2_target_2_hit_rate).toFixed(1)}%`],
              ].map(([label, value]) => (
                <div key={label} className="stat-card" style={{ minHeight: 86, padding: 12 }}>
                  <div className="stat-label">{label}</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-2" style={{ gap: 12 }}>
            {breakdownTable("By V2 Plan Type", v1v2Breakdowns.by_v2_entry_plan_type)}
            {breakdownTable("By V2 Plan Quality", v1v2Breakdowns.by_v2_plan_quality)}
            {breakdownTable("By Universe Source", v1v2Breakdowns.by_universe_source)}
            {breakdownTable("By Market Regime", v1v2Breakdowns.by_market_regime)}
            {breakdownTable("By Sector Strength", v1v2Breakdowns.by_sector_strength_label)}
          </div>

          <div className="card">
            <div className="card-title">V1 vs V2 Examples</div>
            <div className="grid-2" style={{ gap: 16, marginTop: 12 }}>
              {exampleList("V2 Improved Most", v1v2Examples.best_v2_improvement_tickers)}
              {exampleList("V2 Underperformed Most", v1v2Examples.worst_v2_underperformance_tickers)}
              {exampleList("V2 Avoided Bad Setup", v1v2Examples.v2_avoided_bad_setup_examples)}
              {exampleList("V2 Missed Good Setup", v1v2Examples.v2_missed_good_setup_examples)}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Recent V1 vs V2 Signals</div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table style={{ minWidth: 1420 }}>
                <thead><tr><th>Date</th><th>Ticker</th><th>V1 Action</th><th>V2 Action</th><th>V2 Plan Type</th><th>V2 Quality</th><th>V1 {days}D</th><th>V2 {days}D</th><th>Delta</th><th>V1 Stop/Target</th><th>V2 Stop/Target</th><th>Comparison</th></tr></thead>
                <tbody>
                  {v1v2Recent.length === 0 ? <tr><td colSpan={12} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No V1/V2 comparison rows yet.</td></tr> : v1v2Recent.map(row => (
                    <tr key={`v1v2-${row.ticker}-${row.signal_date}`}>
                      <td>{row.signal_date || "-"}</td><td>{row.ticker}</td><td>{timingLabel(row.v1_action)}</td><td>{row.v2_action || "-"}</td><td>{row.v2_entry_plan_type || "-"}</td><td>{row.v2_plan_quality || "-"}</td><td>{pctCell(row.v1_return)}</td><td>{pctCell(row.v2_return)}</td><td>{pctCell(row.return_delta)}</td><td>{row.v1_outcome_status || "-"}</td><td>{row.v2_outcome_status || "-"}</td><td><span className="tag">{row.comparison_status || "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-title">Best / Worst Follow-Through</div>
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <div>{best.map(item => <div key={`b-${item.ticker}-${item.signal_date}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border2)" }}><b>{item.ticker}</b><span>{pctCell(item.return_pct)}</span></div>)}</div>
                <div>{worst.map(item => <div key={`w-${item.ticker}-${item.signal_date}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border2)" }}><b>{item.ticker}</b><span>{pctCell(item.return_pct)}</span></div>)}</div>
              </div>
            </div>
            <div className="card">
              <div className="card-title">Setup Types</div>
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <div>{topSetups.map(item => <div key={`t-${item.label}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border2)" }}><span>{item.label}</span><b>{pctCell(item.avg_return)}</b></div>)}</div>
                <div>{weakSetups.map(item => <div key={`wk-${item.label}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border2)" }}><span>{item.label}</span><b>{pctCell(item.avg_return)}</b></div>)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Recent Signal Outcomes</div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table style={{ minWidth: 1540 }}>
                <thead><tr><th>Date</th><th>Ticker</th><th>Universe</th><th>Leadership Label</th><th>Technical Score</th><th>Setup Type</th><th>Action Status</th><th>5D Return</th><th>10D Return</th><th>20D Return</th><th>Stop/Target Outcome</th><th>Market Regime</th><th>Sector Strength</th></tr></thead>
                <tbody>
                  {outcomes.length === 0 ? <tr><td colSpan={13} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>No signal outcomes saved yet.</td></tr> : outcomes.map(row => (
                    <tr key={row.id || `${row.ticker}-${row.signal_date}`}>
                      <td>{row.signal_date || "-"}</td><td>{row.ticker}</td><td>{row.universe_source || "-"}</td><td>{row.leadership_rank_label || "-"}</td><td>{row.technical_score ?? "-"}</td><td>{row.setup_type || "-"}</td><td>{timingLabel(row.action_status)}</td><td>{pctCell(row.return_5d_pct)}</td><td>{pctCell(row.return_10d_pct)}</td><td>{pctCell(row.return_20d_pct)}</td><td>{row.outcome_status || "-"}</td><td>{row.market_regime || "-"}</td><td>{row.sector_strength_label || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SettingsPage() {
  const [health,     setHealth]     = useState(null);
  const [healthErr,  setHealthErr]  = useState("");
  const [finnhubKey, setFinnhubKey] = useState("");
  const [minScore,   setMinScore]   = useState("70");
  const [universeSource, setUniverseSource] = useState("active_stocks_200");
  const [riskSettings, setRiskSettings] = useState({
    account_value: 10000,
    default_risk_percent: 0.5,
    max_portfolio_heat_percent: 2,
    max_sector_exposure_percent: 30,
    max_open_positions: 8,
    allow_fractional_shares: false,
    use_market_regime_risk_adjustment: true,
  });
  const [alertEngineSettings, setAlertEngineSettings] = useState({
    entry_alert_mode: "v1_only",
    exit_alert_mode: "v1_only",
    enable_v2_telegram_alerts: false,
    enable_v2_in_app_alerts: false,
    require_market_regime_confirmation: true,
    require_sector_confirmation: true,
    require_leadership_confirmation: true,
    minimum_v2_plan_quality: "C",
    minimum_v2_r: 1.5,
    max_portfolio_heat_after_trade: "",
  });
  const [systemCheck, setSystemCheck] = useState(null);
  const [smokeTest, setSmokeTest] = useState(null);
  const [schedulerHealth, setSchedulerHealth] = useState(null);
  const [adminActionResult, setAdminActionResult] = useState(null);
  const [systemBusy, setSystemBusy] = useState("");
  const [systemError, setSystemError] = useState("");
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    api("/api/health").then(({ data, error }) => {
      if (error) setHealthErr(error); else setHealth(data);
    });
    api("/api/settings").then(({ data }) => {
      const s = data?.settings || [];
      setMinScore(s.find(x => x.key === "min_score_alert")?.value || "70");
      setUniverseSource(s.find(x => x.key === "screener_universe_source")?.value || "active_stocks_200");
    });
    api("/api/risk-settings").then(({ data }) => {
      if (data?.settings) setRiskSettings(s => ({ ...s, ...data.settings }));
    });
    api("/api/alert-engine/settings").then(({ data }) => {
      if (data?.settings) setAlertEngineSettings(s => ({ ...s, ...data.settings }));
    });
    api("/api/admin/scheduler-health").then(({ data }) => {
      if (data) setSchedulerHealth(data);
    });
  }, []);

  const saveSettings = async () => {
    await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({ key: "min_score_alert", value: minScore }),
    });
    if (finnhubKey) {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ key: "finnhub_key", value: finnhubKey }),
      });
    }
    await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({ key: "screener_universe_source", value: universeSource }),
    });
    await api("/api/risk-settings", {
      method: "POST",
      body: JSON.stringify({
        ...riskSettings,
        account_value: Number(riskSettings.account_value),
        default_risk_percent: Number(riskSettings.default_risk_percent),
        max_portfolio_heat_percent: Number(riskSettings.max_portfolio_heat_percent),
        max_sector_exposure_percent: Number(riskSettings.max_sector_exposure_percent),
        max_open_positions: Number(riskSettings.max_open_positions),
      }),
    });
    await api("/api/alert-engine/settings", {
      method: "POST",
      body: JSON.stringify({
        ...alertEngineSettings,
        minimum_v2_r: Number(alertEngineSettings.minimum_v2_r),
        max_portfolio_heat_after_trade: alertEngineSettings.max_portfolio_heat_after_trade === "" ? null : Number(alertEngineSettings.max_portfolio_heat_after_trade),
      }),
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const updateRisk = (key, value) => setRiskSettings(s => ({ ...s, [key]: value }));
  const updateAlertEngine = (key, value) => setAlertEngineSettings(s => ({ ...s, [key]: value }));
  const statusColor = status => status === "OK" ? "var(--green)" : status === "Critical" || status === "Failed" ? "var(--red)" : "var(--amber)";
  const statusPill = status => <span style={{ color: statusColor(status), fontWeight: 800 }}>{status || "Unknown"}</span>;
  const loadSystemCheck = async () => {
    setSystemBusy("system-check"); setSystemError("");
    const { data, error } = await api("/api/admin/system-check");
    if (error) setSystemError(error); else setSystemCheck(data);
    setSystemBusy("");
  };
  const runSmokeTest = async () => {
    setSystemBusy("smoke-test"); setSystemError("");
    const { data, error } = await api("/api/admin/smoke-test", { method: "POST" });
    if (error) setSystemError(error); else setSmokeTest(data);
    setSystemBusy("");
  };
  const loadSchedulerHealth = async () => {
    setSystemBusy("scheduler-health"); setSystemError("");
    const { data, error } = await api("/api/admin/scheduler-health");
    if (error) setSystemError(error); else setSchedulerHealth(data);
    setSystemBusy("");
  };
  const runAdminAction = async (label, path, opts = {}) => {
    setSystemBusy(label); setSystemError("");
    const { data, error } = await api(path, opts);
    setAdminActionResult({ label, ok: !error, error, data });
    if (error) setSystemError(error);
    setSystemBusy("");
  };
  const monitoringChecklist = [
    "Run Supabase migration",
    "Confirm /api/admin/system-check is OK",
    "Refresh market regime",
    "Refresh sector strength",
    "Refresh leadership board",
    "Preview leadership universe",
    "Run small manual scan",
    "Confirm screener_results saved",
    "Confirm signal_outcomes snapshots saved",
    "Confirm Entry Watchlist refresh works",
    "Confirm Portfolio Heat works",
    "Confirm Analytics loads",
    "Confirm V1/V2 comparison loads",
    "Confirm Alert Engine shadow events are saving",
    "Confirm guest board still works",
    "Confirm frontend deployment version updated",
  ];
  const goLiveChecklist = [
    "Supabase migration applied",
    "System Check OK",
    "Smoke Test OK",
    "Provider keys present",
    "Market Regime refresh works",
    "Sector Strength refresh works",
    "Leadership Board refresh works",
    "Universe Preview works",
    "Full scan works",
    "Guest board works",
    "Single ticker works",
    "Entry Watchlist refresh works",
    "Portfolio page works",
    "Portfolio Heat works",
    "Analytics loads",
    "V1/V2 comparison loads",
    "Alert Engine settings reviewed",
    "V2 Primary disabled",
    "Broker execution not present",
    "Disclaimer visible",
    "Mobile layout checked",
    "Public URL checked",
  ];
  const alertModeHelp = {
    v1_only: "Safest current behavior. Current V1 alerts only.",
    v2_shadow: "Records V2 decisions for comparison but does not notify.",
    v1_and_v2_confirmed: "Alerts only when V1 and V2 both agree.",
    v2_advisory: "V1 sends alerts and V2 adds advisory context.",
    v2_primary: "Experimental and not recommended until real outcome data supports V2.",
  };

  const dot = ok => <div style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "var(--green)" : "var(--red)", boxShadow: ok ? "0 0 6px var(--green)" : "0 0 6px var(--red)", flexShrink: 0 }} />;

  return (
    <div className="fade-up">
      <PageBrief title="Settings">
        Configure research defaults, alert modes, risk-estimate assumptions, and deployment health. These settings do not enable brokerage execution.
      </PageBrief>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="card">
          <div className="card-title">🔌 API Status</div>
          {healthErr
            ? <div className="err-box">Cannot reach backend: {healthErr}<br /><span style={{ opacity: .7 }}>Deploy with: cd backend && railway up</span></div>
            : health
              ? [["Alpha Vantage", health.alpha_vantage], ["Finnhub", health.finnhub], ["Claude AI", health.anthropic], ["Telegram", health.telegram], ["Supabase", health.supabase]].map(([l, ok]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border2)" }}>
                  {dot(ok)}<span style={{ flex: 1, fontSize: 13 }}>{l}</span>
                  <span style={{ fontSize: 11, color: ok ? "var(--green)" : "var(--red)" }}>{ok ? "Connected" : "Not configured"}</span>
                </div>
              ))
              : <div style={{ color: "var(--muted)", fontSize: 13 }}>Checking…</div>
          }
        </div>

        <div className="card">
          <div className="card-title">⚙️ Configuration</div>
          <div style={{ marginBottom: 12 }}>
            <label>Finnhub API Key (free at finnhub.io)</label>
            <input className="input" type="password" placeholder="Paste key for real-time prices" value={finnhubKey} onChange={e => setFinnhubKey(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Min Score for Buy Alerts</label>
            <input className="input" type="number" min={50} max={100} value={minScore} onChange={e => setMinScore(e.target.value)} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Scanner Universe Source</label>
            <select className="input" value={universeSource} onChange={e => setUniverseSource(e.target.value)}>
              <option value="active_stocks_200">Active Stocks 200</option>
              <option value="leadership_universe">Leadership Universe</option>
              <option value="leadership_plus_active">Leadership + Active Stocks</option>
            </select>
            <div style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.5, marginTop: 6 }}>
              Leadership Universe is experimental. It changes which stocks are scanned, not the Entry Ready / Wait for Confirmation timing rules.
            </div>
          </div>
          <button className="btn btn-green" onClick={saveSettings}>{saved ? "✓ Saved!" : "Save Settings"}</button>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">Risk Settings</div>
          <div className="card-sub" style={{ marginBottom: 12 }}>Risk settings are used only to estimate position size and portfolio heat. SwingAI will not place trades or access brokerage funds.</div>
          <div className="filters">
            <div><label>Account Value</label><input className="input" type="number" value={riskSettings.account_value ?? ""} onChange={e => updateRisk("account_value", e.target.value)} /></div>
            <div><label>Default Risk % Per Trade</label><input className="input" type="number" step="0.05" value={riskSettings.default_risk_percent ?? ""} onChange={e => updateRisk("default_risk_percent", e.target.value)} /></div>
            <div><label>Max Portfolio Heat %</label><input className="input" type="number" step="0.1" value={riskSettings.max_portfolio_heat_percent ?? ""} onChange={e => updateRisk("max_portfolio_heat_percent", e.target.value)} /></div>
            <div><label>Max Sector Exposure %</label><input className="input" type="number" step="1" value={riskSettings.max_sector_exposure_percent ?? ""} onChange={e => updateRisk("max_sector_exposure_percent", e.target.value)} /></div>
            <div><label>Max Open Positions</label><input className="input" type="number" value={riskSettings.max_open_positions ?? ""} onChange={e => updateRisk("max_open_positions", e.target.value)} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
              <input type="checkbox" checked={!!riskSettings.allow_fractional_shares} onChange={e => updateRisk("allow_fractional_shares", e.target.checked)} />
              <label style={{ margin: 0 }}>Allow Fractional Shares</label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
              <input type="checkbox" checked={!!riskSettings.use_market_regime_risk_adjustment} onChange={e => updateRisk("use_market_regime_risk_adjustment", e.target.checked)} />
              <label style={{ margin: 0 }}>Use Market Regime Risk Adjustment</label>
            </div>
          </div>
          <div className="note" style={{ marginTop: 12 }}>Account value is for sizing estimates only. Portfolio heat depends on position quantity and stop loss accuracy.</div>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">Alert Engine Settings</div>
          <div className="card-sub" style={{ marginBottom: 12 }}>V2 alert modes are experimental. Shadow mode does not notify or trade.</div>
          <div className="filters">
            <div><label>Entry Alert Mode</label><select className="input" value={alertEngineSettings.entry_alert_mode} onChange={e => updateAlertEngine("entry_alert_mode", e.target.value)}><option value="v1_only">V1 Only</option><option value="v2_shadow">V2 Shadow</option><option value="v1_and_v2_confirmed">V1 + V2 Confirmed</option><option value="v2_advisory">V2 Advisory</option><option value="v2_primary">V2 Primary</option></select></div>
            <div><label>Exit Alert Mode</label><select className="input" value={alertEngineSettings.exit_alert_mode} onChange={e => updateAlertEngine("exit_alert_mode", e.target.value)}><option value="v1_only">V1 Only</option><option value="v2_shadow">V2 Shadow</option><option value="v1_and_v2_confirmed">V1 + V2 Confirmed</option><option value="v2_advisory">V2 Advisory</option><option value="v2_primary">V2 Primary</option></select></div>
            <div><label>Minimum V2 Plan Quality</label><select className="input" value={alertEngineSettings.minimum_v2_plan_quality} onChange={e => updateAlertEngine("minimum_v2_plan_quality", e.target.value)}><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="Watch">Watch</option></select></div>
            <div><label>Minimum V2 R</label><input className="input" type="number" step="0.1" value={alertEngineSettings.minimum_v2_r ?? ""} onChange={e => updateAlertEngine("minimum_v2_r", e.target.value)} /></div>
            <div><label>Max Portfolio Heat After Trade</label><input className="input" type="number" step="0.1" value={alertEngineSettings.max_portfolio_heat_after_trade ?? ""} onChange={e => updateAlertEngine("max_portfolio_heat_after_trade", e.target.value)} placeholder="Use risk setting" /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}><input type="checkbox" checked={!!alertEngineSettings.enable_v2_telegram_alerts} onChange={e => updateAlertEngine("enable_v2_telegram_alerts", e.target.checked)} /><label style={{ margin: 0 }}>Enable V2 Telegram Alerts</label></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}><input type="checkbox" checked={!!alertEngineSettings.enable_v2_in_app_alerts} onChange={e => updateAlertEngine("enable_v2_in_app_alerts", e.target.checked)} /><label style={{ margin: 0 }}>Enable V2 In-App Alerts</label></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}><input type="checkbox" checked={!!alertEngineSettings.require_market_regime_confirmation} onChange={e => updateAlertEngine("require_market_regime_confirmation", e.target.checked)} /><label style={{ margin: 0 }}>Require Market Regime Confirmation</label></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}><input type="checkbox" checked={!!alertEngineSettings.require_sector_confirmation} onChange={e => updateAlertEngine("require_sector_confirmation", e.target.checked)} /><label style={{ margin: 0 }}>Require Sector Confirmation</label></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}><input type="checkbox" checked={!!alertEngineSettings.require_leadership_confirmation} onChange={e => updateAlertEngine("require_leadership_confirmation", e.target.checked)} /><label style={{ margin: 0 }}>Require Leadership Confirmation</label></div>
          </div>
          <div className="grid-2" style={{ gap: 10, marginTop: 12 }}>
            <div className="note">
              Entry mode: <b>{alertEngineSettings.entry_alert_mode}</b>. {alertModeHelp[alertEngineSettings.entry_alert_mode] || "Unknown mode."}
            </div>
            <div className="note">
              Exit mode: <b>{alertEngineSettings.exit_alert_mode}</b>. {alertModeHelp[alertEngineSettings.exit_alert_mode] || "Unknown mode."}
            </div>
          </div>
          {(alertEngineSettings.entry_alert_mode === "v2_primary" || alertEngineSettings.exit_alert_mode === "v2_primary") && (
            <div className="err-box" style={{ marginTop: 12 }}>
              V2 Primary is experimental. Do not enable until enough real outcome data supports V2. This still does not execute trades.
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">System Health</div>
          <div className="card-sub" style={{ marginBottom: 12 }}>Production validation tools. These checks do not send alerts, execute trades, or change V2 alert mode.</div>
          <div className="filters" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={loadSystemCheck} disabled={!!systemBusy}>{systemBusy === "system-check" ? "Checking..." : "Run System Check"}</button>
            <button className="btn" onClick={runSmokeTest} disabled={!!systemBusy}>{systemBusy === "smoke-test" ? "Running..." : "Run Smoke Test"}</button>
            <button className="btn" onClick={loadSchedulerHealth} disabled={!!systemBusy}>Load Scheduler Health</button>
            <button className="btn" onClick={() => runAdminAction("Refresh Market Regime", "/api/market-regime?force_refresh=true")} disabled={!!systemBusy}>Refresh Market Regime</button>
            <button className="btn" onClick={() => runAdminAction("Refresh Sector Strength", "/api/sector-strength?force_refresh=true")} disabled={!!systemBusy}>Refresh Sector Strength</button>
            <button className="btn" onClick={() => runAdminAction("Refresh Leadership Board", "/api/leadership-board/refresh?limit=50", { method: "POST" })} disabled={!!systemBusy}>Refresh Leadership Board</button>
            <button className="btn" onClick={() => runAdminAction("Preview Universe", "/api/screener/universe-preview?source=leadership_plus_active&limit=50")} disabled={!!systemBusy}>Preview Universe</button>
            <button className="btn" onClick={() => runAdminAction("Update V1 Outcomes", "/api/analytics/update-outcomes?limit=100", { method: "POST" })} disabled={!!systemBusy}>Update V1 Outcomes</button>
            <button className="btn" onClick={() => runAdminAction("Update V2 Outcomes", "/api/analytics/update-v2-outcomes?limit=100", { method: "POST" })} disabled={!!systemBusy}>Update V2 Outcomes</button>
            <button className="btn" onClick={() => runAdminAction("Refresh Portfolio Heat", "/api/portfolio/heat")} disabled={!!systemBusy}>Refresh Portfolio Heat</button>
            <button className="btn" onClick={() => runAdminAction("Load Alert Engine Events", "/api/alert-engine/events?limit=20")} disabled={!!systemBusy}>Load Alert Engine Events</button>
          </div>
          {systemError && <div className="err-box" style={{ marginBottom: 12 }}>{systemError}</div>}
          <div className="grid-2" style={{ gap: 12 }}>
            <div style={{ border: "1px solid var(--border2)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Backend and Schema</div>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>Overall: {statusPill(systemCheck?.overall_status)}</div>
                <div>Supabase migration: {statusPill(systemCheck?.database_schema_status)}</div>
                <div>Missing tables: {(systemCheck?.missing_tables || []).length}</div>
                <div>Missing column groups: {Object.keys(systemCheck?.missing_columns || {}).length}</div>
                <div>App config: {statusPill(systemCheck?.app_config_status?.status)}</div>
                <div>Environment: {statusPill(systemCheck?.env_var_status?.status)}</div>
              </div>
            </div>
            <div style={{ border: "1px solid var(--border2)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Feature Modes</div>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>Universe: {systemCheck?.feature_mode_status?.screener_universe_source || universeSource}</div>
                <div>Entry alerts: {systemCheck?.feature_mode_status?.entry_alert_mode || alertEngineSettings.entry_alert_mode}</div>
                <div>Exit alerts: {systemCheck?.feature_mode_status?.exit_alert_mode || alertEngineSettings.exit_alert_mode}</div>
                <div>V2 Telegram: {systemCheck?.feature_mode_status?.v2_telegram_enabled ? "Enabled" : "Disabled"}</div>
                <div>V2 in-app: {systemCheck?.feature_mode_status?.v2_in_app_enabled ? "Enabled" : "Disabled"}</div>
                <div>Market regime: {systemCheck?.feature_mode_status?.current_market_regime || "Unknown"}</div>
              </div>
            </div>
            <div style={{ border: "1px solid var(--border2)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Providers</div>
              <div style={{ fontSize: 12, lineHeight: 1.8, maxHeight: 220, overflow: "auto" }}>
                {(systemCheck?.provider_key_status?.providers || []).map(p => (
                  <div key={p.provider_name} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border2)", padding: "4px 0" }}>
                    <span>{p.provider_name}</span>
                    <span style={{ color: p.enabled ? "var(--green)" : "var(--muted)" }}>{p.enabled ? "Enabled" : p.key_present ? "Key present / disabled" : "Missing"}</span>
                  </div>
                ))}
                {!systemCheck?.provider_key_status?.providers && <span style={{ color: "var(--muted)" }}>Run system check to load provider status.</span>}
              </div>
            </div>
            <div style={{ border: "1px solid var(--border2)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Scheduler Health</div>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>Enabled: {schedulerHealth?.scheduler_enabled ? "Yes" : "Unknown"}</div>
                <div>Running: {schedulerHealth?.scheduler_running ? "Yes" : "No / unknown"}</div>
                <div>Market session: {schedulerHealth?.market_session || "Unknown"}</div>
                <div>Last full scan: {schedulerHealth?.last_full_scan_run || "Unknown"}</div>
                <div>Last leadership refresh: {schedulerHealth?.last_leadership_board_refresh || "Unknown"}</div>
                <div>Last watchlist check: {schedulerHealth?.last_watchlist_check || "Unknown"}</div>
                <div>Last shadow event: {schedulerHealth?.last_alert_engine_shadow_event || "Unknown"}</div>
              </div>
            </div>
            <div style={{ border: "1px solid var(--border2)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Build / Safety</div>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>Frontend: {FRONTEND_BUILD_VERSION}</div>
                <div>Backend: {health?.backend_version || "Unknown"}</div>
                <div>Deploy commit: {health?.deploy_commit || "Unknown"}</div>
                <div>Broker execution: {health?.broker_execution_enabled === false ? "Not present" : "Unknown"}</div>
              </div>
            </div>
          </div>
          {(systemCheck?.migration_warnings?.length || Object.keys(systemCheck?.missing_columns || {}).length) ? (
            <div className="note" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Actionable warnings</div>
              {(systemCheck?.migration_warnings || []).slice(0, 4).map((w, i) => <div key={`w-${i}`}>{w}</div>)}
              {Object.entries(systemCheck?.missing_columns || {}).slice(0, 4).map(([table, cols]) => <div key={table}>{table}: {(cols || []).slice(0, 8).join(", ")}</div>)}
              {(systemCheck?.missing_tables || []).slice(0, 4).map(table => <div key={`mt-${table}`}>Missing {table} table. Run the latest Supabase migration.</div>)}
            </div>
          ) : null}
          {smokeTest && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Smoke Test: {statusPill(smokeTest.overall_status)}</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, maxHeight: 220, overflow: "auto" }}>
                {(smokeTest.results || []).map(r => (
                  <div key={r.test_name} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border2)", padding: "5px 0" }}>
                    <span>{r.test_name}</span>
                    <span style={{ color: statusColor(r.status) }}>{r.status} ({r.duration_ms}ms)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {adminActionResult && (
            <div className="note" style={{ marginTop: 12 }}>
              {adminActionResult.label}: {adminActionResult.ok ? "completed" : `failed - ${adminActionResult.error}`}
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">Real-Sample Monitoring Checklist</div>
          <div className="card-sub" style={{ marginBottom: 12 }}>Use after Railway and Vercel deploys. Items are manual validation steps unless a button above covers them.</div>
          <div className="grid-2" style={{ gap: 8 }}>
            {monitoringChecklist.map((item, i) => (
              <div key={item} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "7px 0", borderBottom: "1px solid var(--border2)" }}>
                <span style={{ color: "var(--muted)", width: 22 }}>{i + 1}.</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">Go-Live Checklist</div>
          <div className="card-sub" style={{ marginBottom: 12 }}>Final private/public launch readiness checks. Keep V2 Primary disabled unless intentionally testing after enough outcome data.</div>
          <div className="grid-2" style={{ gap: 8 }}>
            {goLiveChecklist.map((item, i) => (
              <div key={item} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "7px 0", borderBottom: "1px solid var(--border2)" }}>
                <span style={{ color: "var(--muted)", width: 24 }}>{i + 1}.</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <SafetyNote compact />
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title">🔧 Troubleshooting</div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 2 }}>
            {[
              ["Screener 404 / backend error",    "New main.py not deployed → cd backend → railway up"],
              ["Log Position has no reaction",     "DB migration not run → Supabase SQL Editor → run migration.sql"],
              ["History keeps spinning",           "Same — run migration.sql in Supabase"],
              ["Portfolio Monitor fails",          "Same + check Telegram token in Railway Variables"],
              ["Market Today shows no data",       "Normal until the next scheduled Market Today cache refresh"],
            ].map(([p, f], i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border2)" }}>
                <span style={{ color: "var(--red)", minWidth: 16 }}>❌</span>
                <div><b style={{ color: "var(--text)" }}>{p}</b><br /><span style={{ color: "var(--muted)" }}>→ {f}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Guest Read-Only App ──────────────────────────────────────────────────────
function GuestReadOnlyPage() {
  const [guestTab, setGuestTab] = useState("screener");
  const [showLogin, setShowLogin] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(hasAcceptedGuestTerms);
  const [showTerms, setShowTerms] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
  const [showSurvey, setShowSurvey] = useState(false);

  useEffect(() => {
    if (!disclaimerAccepted) return;
    let cancelled = false;
    fetch("/api/visit")
      .then(r => r.json())
      .then(d => { if (!cancelled && d?.show_survey) setShowSurvey(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [disclaimerAccepted]);

  const markSurveyDone = () => {
    fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "survey_done" }) }).catch(() => {});
  };
  const recordSurvey = async (payload) => {
    try {
      await supabase.from("survey_responses").insert({
        user_id: null,
        overall_rating: payload.overall_rating,
        continued: payload.continued,
        ease_of_use: payload.ease_of_use,
        tenure: payload.tenure,
        portfolio_change: payload.portfolio_change,
        ai_analysis_accuracy: payload.ai_analysis_accuracy,
        would_recommend: payload.would_recommend,
        improvement_feedback: payload.improvement_feedback,
      });
    } catch (e) { /* ignore insert errors */ }
    markSurveyDone();
  };
  const closeSurvey = () => { markSurveyDone(); setShowSurvey(false); };

  const tabs = [
    { id: "dashboard", label: "MARKET TODAY", locked: false },
    { id: "screener",  label: "SCREENER",  locked: false },
    { id: "portfolio", label: "PORTFOLIO", locked: true },
    { id: "history",   label: "HISTORY",   locked: true },
    { id: "ai",        label: "AI",        locked: true },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <div className="logo">SwingAI</div>
          <nav className="header-nav">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`nav-btn ${guestTab === t.id ? "active" : ""}`}
                onClick={() => setGuestTab(t.id)}
                title={t.locked ? "Sign in required" : undefined}
              >
                {t.label}{t.locked ? " 🔒" : ""}
              </button>
            ))}
          </nav>
          <div className="header-right">
            <span className="badge" style={{ color: "var(--blue)", borderColor: "rgba(77,166,255,0.4)", background: "rgba(77,166,255,0.1)" }}>Guest</span>
            <button className="btn btn-green" style={{ padding: "6px 14px" }} onClick={() => setShowLogin(true)}>Sign in</button>
          </div>
        </header>
        <main className="main">
          <div className="content">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{guestTab === "dashboard" ? "Market Today" : guestTab === "screener" ? "Stock Screener" : tabs.find(t => t.id === guestTab)?.label}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{guestTab === "dashboard" ? "Updated by scheduled Market Today cache refreshes" : "Read-only preview - sign in for saved research, alerts, and portfolio tracking"}</div>
            </div>
            {guestTab === "dashboard" ? (
              <div className={showLogin ? "grid-2" : undefined} style={{ gap: 12, alignItems: "start" }}>
                <MarketTodayPage />
                {showLogin && <LoginPage embedded />}
              </div>
            ) : guestTab === "screener" ? (
              <div className={showLogin ? "grid-2" : undefined} style={{ gap: 12, alignItems: "start" }}>
                <div>
                  <GuestScreenerPage />
                </div>
                {showLogin && <LoginPage embedded />}
              </div>
            ) : (
              <div className={showLogin ? "grid-2" : undefined} style={{ gap: 12, alignItems: "start" }}>
                <div className="empty" style={{ padding: "60px 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
                  <h3 style={{ fontSize: 18 }}>Sign in required</h3>
                  <p style={{ maxWidth: 420, margin: "8px auto 0" }}>This section is available to signed-in users.</p>
                </div>
                {showLogin && <LoginPage embedded />}
              </div>
            )}
            <AppFooter onOpenLegal={setLegalModal} />
          </div>
        </main>
      </div>
      {!disclaimerAccepted && (
        <GuestDisclaimerModal onAccept={() => setDisclaimerAccepted(true)} />
      )}
      {showTerms && (
        <GuestDisclaimerModal readOnlyTerms onClose={() => setShowTerms(false)} />
      )}
      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}
      {disclaimerAccepted && showSurvey && (
        <SurveyModal onSubmit={recordSurvey} onClose={closeSurvey} />
      )}
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab,         setTab]         = useLocalStorage("swingai-tab", "dashboard");
  const [positions,   setPositions]   = useState([]);
  const [portfolioError, setPortfolioError] = useState(null);
  const [screenerResults, setScreenerResults] = useState([]);
  const [alerts,      setAlerts]      = useState([]);
  const [legalModal,  setLegalModal]  = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });
    const { data: l } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user || null));
    return () => l.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async (opts = {}) => {
    const portfolioPath = opts.forcePortfolio ? "/api/portfolio/positions?force_refresh=true" : "/api/portfolio/positions";
    const [posRes, alertRes, scanRes] = await Promise.all([
      api(portfolioPath),
      api("/api/alerts/history"),
      api("/api/screener/results"),
    ]);
    if (posRes.data) {
      setPositions(posRes.data.positions || []);
      setPortfolioError(null);
    } else if (posRes.error) {
      setPortfolioError(posRes.error);
    }
    if (alertRes.data) setAlerts(alertRes.data.alerts || []);
    if (scanRes.data)  setScreenerResults(scanRes.data.results || []);
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="spin" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!user) return <GuestReadOnlyPage />;

  const urgent   = positions.filter(p => (p.sell_urgency || 0) >= 2).length;
  const topToday = screenerResults.filter(s => s.score >= 75).length;

  const tabs = [
    { id: "dashboard", label: "Market Today" },
    { id: "screener",  label: "Screener" + (topToday > 0 ? ` (${topToday})` : "") },
    { id: "leadership", label: "Leadership Board" },
    { id: "analytics", label: "Analytics" },
    { id: "entryWatch", label: "Entry Watchlist" },
    { id: "portfolio", label: "Portfolio" + (urgent > 0 ? ` ⚠️${urgent}` : "") },
    { id: "history",   label: "History" },
    { id: "alerts",    label: "Alerts" },
    { id: "feedback",  label: "Feedback" },
    { id: "settings",  label: "Settings" },
  ];

  const titles = { dashboard: "Market Today", screener: "Stock Screener", leadership: "Leadership Board", analytics: "Universe Analytics", entryWatch: "Entry Signal Watchlist", portfolio: "Portfolio Monitor", history: "Trade History", alerts: "Telegram Alerts", feedback: "User Feedback", settings: "Settings" };
  const subs   = {
    entryWatch: "Pre-buy entry timing confirmation. Portfolio starts after buying.",
    leadership: "Relative strength and sector leadership ranking. Not a buy list.",
    analytics:  "Compare historical signal follow-through across scanner universes",
    screener:  "Find high-probability setups · Score ≥70 = quality entry",
    portfolio: "Track open positions · AI checks for sell signals",
    dashboard: "Updated by scheduled Market Today cache refreshes",
    history:   "Closed trades and win rate statistics",
    alerts:    "Telegram alert history and manual controls",
    feedback:  "Survey ratings and responses from your users",
    settings:  "API status and configuration",
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <div className="logo">SwingAI</div>
          <nav className="header-nav">
            {tabs.map(t => (
              <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
          <div className="header-right">
            <div className="status-dot" />
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Semi-Auto</span>
            <div className="user-pill">{user.email?.split("@")[0]}</div>
            <button className="logout-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </header>
        <main className="main">
          <div className="content">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{titles[tab]}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{subs[tab]}</div>
            </div>
            {tab === "dashboard" && <MarketTodayPage admin />}
            {tab === "screener"  && <ScreenerPage onScanComplete={loadData} />}
            {tab === "leadership" && <LeadershipBoardPage />}
            {tab === "analytics" && <UniverseAnalyticsPage />}
            {tab === "entryWatch" && <EntryWatchlistPage />}
            {portfolioError && (
              <div className="card" style={{ borderColor: "rgba(239,68,68,.35)", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Portfolio unavailable</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>Unable to refresh portfolio positions. Screener data is still available.</div>
              </div>
            )}
            {tab === "portfolio" && <PortfolioPage positions={positions} onRefresh={loadData} />}
            {tab === "history"   && <HistoryPage />}
            {tab === "alerts"    && <AlertsPage />}
            {tab === "settings"  && <SettingsPage />}
            {tab === "feedback"  && <SurveyAdmin supabase={supabase} />}
            <AppFooter onOpenLegal={setLegalModal} />
          </div>
        </main>
      </div>
      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}
    </>
  );
}
