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
  title = "Trade Smart with SwingAI",
  subtitle = "AI analysis for medium-term U.S. stock trading",
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
    "Swing trading only - not for day trading or options",
    "Best for traders with basic market knowledge",
    "Daily picks come from the top 100 trending U.S. stocks",
    "Need another stock? Type any ticker below",
    "For reference only - always do your own research",
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
      "SwingAI is for educational and research purposes only. It does not provide financial advice, investment advice, or trading recommendations. Always do your own research and consult a licensed professional if needed.",
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
  if (!position?.fallback_to_entry) return null;
  return (
    <span
      className="badge"
      title={`Price source: ${position.price_source || "unknown"}`}
      style={{
        background: "rgba(251, 176, 36, .12)",
        color: "var(--amber)",
        borderColor: "rgba(251, 176, 36, .35)",
        fontSize: 9,
        marginTop: 3,
      }}
    >
      entry fallback
    </span>
  );
}

const GUEST_DISCLAIMER_CHECKS = [
  "I understand this website is for educational and informational purposes only.",
  "I understand this is not financial advice.",
  "I understand I am fully responsible for my own trading and investment decisions.",
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <b style={{ fontFamily: "var(--mono)", fontSize: 16 }}>{result.ticker || ticker.toUpperCase()}</b>
            {score !== undefined && <span className="badge" style={{ color: SCORE_COLOR(score), borderColor: SCORE_COLOR(score) }}>Score {score}</span>}
            {setup && <span className="badge">{setup}</span>}
            {price && <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>${Number(price).toFixed(2)}</span>}
          </div>
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
                  {!guest && <td>{result.data_source || "-"}</td>}
                </tr>
              </tbody>
            </table>
          </div>
          {result.signals?.length > 0 && (
            <div className="signals-list" style={{ marginTop: 10 }}>{result.signals.map((s, i) => <span key={i} className="signal-pill">{s}</span>)}</div>
          )}
          {canShowSuggestedZone && (
            <SuggestedEntryZone
              zone={suggestedZone}
              description="Research-only entry zone from this ticker check."
            />
          )}
          {guest && suggestedZone && !guestZoneAccepted && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "rgba(0,170,255,0.06)" }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>AI Suggested Entry Zone available</div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>View research-only entry analysis.</div>
              <button className="btn btn-blue" onClick={openGuestZoneDisclaimer}>View AI Analysis</button>
            </div>
          )}
          {!guest && result.confirmation_4h && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text2)" }}>
              <span className="tag">Primary indicators: 1D / Daily</span>
              <span className="tag">Entry confirmation: 4H</span>
              <span>4H setup: <b>{result.confirmation_4h.setup || "-"}</b></span>
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
  const scannedTickers = meta.universe_source === "cached_market_today_top_200" || !meta.tickers_scanned || Number(meta.tickers_scanned) < 200
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
            <div style={{ fontSize: 22, fontWeight: 800 }}>Good quality tickers today</div>
            <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.6, maxWidth: 760, margin: "8px 0 0" }}>
              This list is updated after the 10:30 AM and 1:00 PM ET market scans. SwingAI scans today's cached top 200 market tickers and ranks the strongest setups from highest to lowest by AI analysis. List and ranking are based on the latest scan. Visible prices refresh when available during market hours.
            </p>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Indicators based mainly on Daily candles</div>
          </div>
          <div style={{ minWidth: 220, fontSize: 12, color: "var(--text2)", lineHeight: 1.8 }}>
            <div><b>Scanned:</b> {scannedAt}</div>
            <div><b>Session:</b> {meta.scan_session || "Latest scheduled scan"}</div>
            <div><b>Scanned tickers:</b> {scannedTickers}</div>
            <div><b>Rank rule:</b> Highest to lowest by AI analysis score</div>
            <div><b>Setups:</b> {(meta.setup_types || []).join(", ") || "n/a"}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>Scan results are for research only and are not financial advice.</div>
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
                  <th>Ticker</th><th>Setup</th><th>Score</th><th>Scan Price</th><th>Target</th><th>Stop</th><th>AI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ticker}>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{r.ticker}</td>
                    <td>{r.setup || "-"}</td>
                    <td style={{ color: SCORE_COLOR(r.score || 0), fontWeight: 700 }}>{r.score ?? "-"}</td>
                    <td>{r.scan_price ? `$${Number(r.scan_price).toFixed(2)}` : "-"}</td>
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
  }, []);

  useEffect(() => {
    if (!loading) loadScreenerResults();
    const refresh = () => {
      if (!loading) loadScreenerResults();
    };
    const refreshInterval = setInterval(refresh, 60000);
    return () => clearInterval(refreshInterval);
  }, [loadScreenerResults, loading]);

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
    .sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "winrate" ? b.win_rate - a.win_rate : b.price - a.price);

  return (
    <div className="fade-up">
      <ScreenerHero />
      <SingleTickerCheck />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, fontSize: 12, color: "var(--text2)" }}>
        <span className="tag">Primary indicators: 1D / Daily</span>
        <span className="tag">Entry confirmation: 4H</span>
      </div>

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
          {setups.map(s => (
            <button key={s} onClick={() => setFilterSetup(s)} className="btn btn-ghost" style={{ padding: "3px 10px", fontSize: 10, ...(filterSetup === s ? { borderColor: "var(--green)", color: "var(--green)" } : {}) }}>{s}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {[["score", "Score"], ["winrate", "Win Rate"], ["price", "Price"]].map(([k, l]) => (
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
                <tr><th>Ticker</th><th>Price</th><th>Chg%</th><th>Score</th><th>Win Rate</th><th>Setup</th><th>RSI</th><th>Vol</th><th>Target</th><th>Stop</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const displayPrice = r.current_price ?? r.price ?? r.scan_price;
                  return (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</td>
                    <td>{displayPrice == null || displayPrice === "" ? "-" : `$${typeof displayPrice === "number" ? displayPrice.toFixed(2) : displayPrice}`}</td>
                    <td><span style={{ color: (r.change_pct || 0) >= 0 ? "var(--green)" : "var(--red)" }}>{(r.change_pct || 0) >= 0 ? "+" : ""}{(r.change_pct || 0).toFixed(2)}%</span></td>
                    <td><ScoreGauge score={r.score} /></td>
                    <td><span style={{ color: SCORE_COLOR(r.score), fontWeight: 700 }}>{r.win_rate}%</span></td>
                    <td>
                      <span className="tag">{r.setup}</span>
                      {r.confirmation_timeframe && (
                        <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
                          4H: {r.confirmation_4h?.setup || "confirmation"}
                        </div>
                      )}
                    </td>
                    <td><span style={{ color: (r.rsi || 50) < 35 ? "var(--green)" : (r.rsi || 50) > 70 ? "var(--red)" : "var(--text2)" }}>{r.rsi?.toFixed(0) || "–"}</span></td>
                    <td><span style={{ color: (r.vol_ratio || 0) > 1.5 ? "var(--amber)" : "var(--text2)" }}>{r.vol_ratio?.toFixed(1) || "–"}x</span></td>
                    <td style={{ color: "var(--green)" }}>${r.target?.toFixed(2)}</td>
                    <td style={{ color: "var(--red)" }}>${r.stop?.toFixed(2)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-blue" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => analyzeStock(r.ticker)} disabled={readOnly}>AI</button>
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
                        <div style={{ background: "var(--bg3)", padding: "6px 12px", borderRadius: 6, fontSize: 12 }}>Win Rate: <b style={{ color: "var(--green)" }}>{analysis.score?.win_rate}%</b></div>
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
const fmtMoneyDash = value => value == null || value === "" || Number.isNaN(Number(value)) ? "—" : `$${Number(value).toFixed(2)}`;
const fmtRRDash = value => value == null || value === "" || Number.isNaN(Number(value)) ? "—" : `1:${Number(value).toFixed(2)}`;

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

function SuggestedEntryZone({ zone, description = "Research-only entry zone from the current live analysis." }) {
  if (!zone) return null;
  const avoid = zone.entry_grade === "Avoid";
  const gradeColor = zone.entry_grade === "A" ? "var(--green)" : zone.entry_grade === "B" ? "var(--green2)" : zone.entry_grade === "C" ? "var(--amber)" : "var(--red)";
  const timingLabels = {
    enter_now_aggressive: "Aggressive entry possible now",
    wait_for_pullback: "Wait for pullback",
    wait_for_confirmation: "Wait for confirmation",
    avoid: "Avoid",
  };
  const timingLabel = timingLabels[zone.entry_timing] || "—";
  const timingCaution = zone.entry_timing === "wait_for_pullback" || zone.entry_timing === "wait_for_confirmation";
  const timingColor = zone.entry_timing === "enter_now_aggressive" ? "var(--green)" : timingCaution ? "var(--amber)" : "var(--red)";
  const detailValue = (value, highlight = false, muted = false) => (
    <span style={{
      color: highlight ? "var(--green)" : muted ? "var(--muted)" : "var(--text)",
      fontWeight: highlight ? 800 : 500,
    }}>
      {value}
    </span>
  );
  const textBlock = (label, text, tone = "blue") => text ? (
    <div style={{
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 6,
      background: tone === "amber" ? "rgba(251,176,36,0.08)" : "rgba(77,166,255,0.07)",
      border: tone === "amber" ? "1px solid rgba(251,176,36,0.22)" : "1px solid rgba(77,166,255,0.18)",
    }}>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .7, fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.55 }}>{text}</div>
    </div>
  ) : null;
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(77,166,255,0.06)", border: "1px solid rgba(77,166,255,0.20)" }}>
      <div style={{ fontWeight: 800, marginBottom: 3 }}>Suggested Entry Zone</div>
      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>{description}</div>
      {avoid ? (
        <div>
          <div className="badge" style={{ color: "var(--amber)", borderColor: "var(--amber)", marginBottom: 8 }}>No Suggested Entry Zone</div>
          <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>{zone.bot_suggestion || zone.entry_reason || "No suggested entry zone generated."}</div>
          {zone.confirmation_note && (
            <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>{zone.confirmation_note}</div>
          )}
          {(zone.risk_notes || []).length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 18, color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
              {zone.risk_notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span className="badge" style={{ color: gradeColor, borderColor: gradeColor, background: "rgba(255,255,255,0.035)", fontSize: 12, minHeight: 26, padding: "3px 11px" }}>
              Grade {zone.entry_grade || "—"}
            </span>
            <span className="badge" style={{ color: timingColor, borderColor: timingColor, background: "rgba(255,255,255,0.035)", fontSize: 12, minHeight: 26, padding: "3px 11px" }}>
              {timingLabel}
            </span>
            <span className="badge" style={{ color: "var(--blue)", borderColor: "rgba(77,166,255,0.45)", background: "rgba(77,166,255,0.08)", fontSize: 12, minHeight: 26, padding: "3px 11px" }}>
              Confidence {zone.confidence || "—"}
            </span>
          </div>
          <DetailGrid items={[
            ["Entry Grade", detailValue(zone.entry_grade || "—")],
            ["Entry Timing", detailValue(timingLabel)],
            ["Confidence", detailValue(zone.confidence || "—")],
            ["Aggressive Entry", detailValue(fmtMoneyDash(zone.aggressive_entry), false, timingCaution)],
            ["Conservative Entry", fmtMoneyDash(zone.conservative_entry)],
            ["Preferred Entry", detailValue(fmtMoneyDash(zone.preferred_entry), true)],
            ["Ideal Stop", fmtMoneyDash(zone.ideal_stop)],
            ["Target", fmtMoneyDash(zone.target)],
            ["Aggressive R:R", fmtRRDash(zone.risk_reward_aggressive)],
            ["Conservative R:R", fmtRRDash(zone.risk_reward_conservative)],
          ]} />
          {timingCaution && (
            <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 6, background: "rgba(251,176,36,0.08)", border: "1px solid rgba(251,176,36,0.22)", color: "var(--amber)", fontSize: 12, lineHeight: 1.5 }}>
              Aggressive entry has higher timing risk. Preferred entry is the conservative zone or a stronger confirmation trigger.
            </div>
          )}
          {textBlock("Bot Suggestion", zone.bot_suggestion, timingCaution ? "amber" : "blue")}
          {textBlock("Confirmation Note", zone.confirmation_note, timingCaution ? "amber" : "blue")}
          {textBlock("Entry Reason", zone.entry_reason)}
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

function PortfolioLiveAnalysisPanel({ data, error }) {
  if (error) return <div className="err-box" style={{ margin: 0 }}>{error}</div>;
  if (!data) return null;
  const plan = data.position_plan || {};
  const live = data.live_analysis || {};
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.018)", border: "1px solid var(--border2)" }}>
        <div style={{ fontWeight: 800, marginBottom: 3 }}>Position Plan</div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>Original saved trade plan. This is not changed by Live Analysis.</div>
        <DetailGrid items={[
          ["Entry", fmtMoney(plan.entry_price)],
          ["Target", fmtMoney(plan.target_price)],
          ["Stop", fmtMoney(plan.stop_loss)],
          ["Score at Entry", plan.score_at_entry ?? "-"],
          ["Setup at Entry", plan.setup_at_entry || "-"],
          ["R:R at Entry", fmtRR(plan.risk_reward_at_entry)],
        ]} />
      </div>
      <div style={{ padding: 12, borderRadius: 8, background: "rgba(0,255,178,0.035)", border: "1px solid rgba(0,255,178,0.16)" }}>
        <div style={{ fontWeight: 800, marginBottom: 3 }}>Live Analysis</div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>Current market analysis. This does not overwrite your saved Position Plan.</div>
        {live.status === "failed" && <div className="err-box">Live analysis failed. {(live.live_reasons || []).join(" ")}</div>}
        <DetailGrid items={[
          ["Current Price", fmtMoney(live.current_price)],
          ["Live Score", live.live_score ?? "-"],
          ["Live Setup", live.live_setup || "-"],
          ["Live Target", fmtMoney(live.live_target)],
          ["Live Stop", fmtMoney(live.live_stop)],
          ["Live R:R", fmtRR(live.live_risk_reward)],
          ["Live Signal", live.live_signal || "-"],
          ["Analysis Time", formatLocalDateTime(live.analysis_time)],
        ]} />
        {(live.live_reasons || []).length > 0 && (
          <div className="signals-list" style={{ marginTop: 10 }}>
            {live.live_reasons.slice(0, 8).map((reason, i) => <span key={i} className="signal-pill">{reason}</span>)}
          </div>
        )}
        <SuggestedEntryZone zone={live.suggested_entry_zone} />
      </div>
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

  return (
    <div className="fade-up">
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
              {singleScan.win_rate != null && <span className="badge">{singleScan.win_rate}% WR</span>}
              {singleScan.setup && <span className="tag">{singleScan.setup}</span>}
              {singleScan.rescore_status && singleScan.rescore_status !== "ok" && <span className="badge">{singleScan.rescore_status}</span>}
            </div>
            {singleScan.current_price != null && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text2)" }}>
                Current: ${Number(singleScan.current_price).toFixed(2)}
                {singleScan.target != null && ` | Target: $${Number(singleScan.target).toFixed(2)}`}
                {singleScan.stop != null && ` | Stop: $${Number(singleScan.stop).toFixed(2)}`}
              </div>
            )}
            {singleScan.signals?.length > 0 && (
              <div className="signals-list" style={{ marginTop: 10 }}>
                {singleScan.signals.slice(0, 5).map((s, i) => <span key={i} className="signal-pill">{s}</span>)}
              </div>
            )}
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
                        <td style={{ maxWidth: 160, fontSize: 10, color: "var(--text2)", lineHeight: 1.5 }}>
                          {(p.sell_reasons || []).slice(0, 2).join(" · ")}
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

  const loadAlertHistory = useCallback(() => {
    setLoading(true);
    api("/api/alerts/history").then(({ data, error }) => {
      if (!error && data?.alerts) setAlerts(data.alerts);
      setLoading(false);
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
function SettingsPage() {
  const [health,     setHealth]     = useState(null);
  const [healthErr,  setHealthErr]  = useState("");
  const [finnhubKey, setFinnhubKey] = useState("");
  const [minScore,   setMinScore]   = useState("70");
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    api("/api/health").then(({ data, error }) => {
      if (error) setHealthErr(error); else setHealth(data);
    });
    api("/api/settings").then(({ data }) => {
      const s = data?.settings || [];
      setMinScore(s.find(x => x.key === "min_score_alert")?.value || "70");
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
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const dot = ok => <div style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "var(--green)" : "var(--red)", boxShadow: ok ? "0 0 6px var(--green)" : "0 0 6px var(--red)", flexShrink: 0 }} />;

  return (
    <div className="fade-up">
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
          <button className="btn btn-green" onClick={saveSettings}>{saved ? "✓ Saved!" : "Save Settings"}</button>
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
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{guestTab === "dashboard" ? "Updated by scheduled Market Today cache refreshes" : "Read-only preview · Sign in to scan, trade, or send alerts"}</div>
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
    { id: "portfolio", label: "Portfolio" + (urgent > 0 ? ` ⚠️${urgent}` : "") },
    { id: "history",   label: "History" },
    { id: "alerts",    label: "Alerts" },
    { id: "feedback",  label: "Feedback" },
    { id: "settings",  label: "Settings" },
  ];

  const titles = { dashboard: "Market Today", screener: "Stock Screener", portfolio: "Portfolio Monitor", history: "Trade History", alerts: "Telegram Alerts", feedback: "User Feedback", settings: "Settings" };
  const subs   = {
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
