import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── Config ─────────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || "https://swingai-api-production.up.railway.app";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cpoumpdgmjbqhmjqrgec.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb3VtcGRnbWpicWhtanFyZ2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDcxNDcsImV4cCI6MjA5NTI4MzE0N30.q4-QleVM5flNGGltA7veVwrQq0e8NX-luz6eNdJ3lNs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

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
    if (!r.ok) return { data: null, error: json?.detail || `Server error ${r.status}` };
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

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--ui); overflow: hidden; }
  body { font-size: 14px; line-height: 1.45; }
  ::-webkit-scrollbar { width: 7px; height: 7px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; }
  .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

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

  .main { display: flex; flex: 1; overflow: hidden; }
  .content { flex: 1; overflow-y: auto; padding: 22px; }

  .card { background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005)), var(--bg2); border: 1px solid var(--border2); border-radius: 8px; padding: 18px; box-shadow: 0 12px 28px rgba(0,0,0,0.18); }
  .card-title { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }

  .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: stretch; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
  .mt-3 { margin-top: 12px; }
  .mt-4 { margin-top: 16px; }
  .w-full { width: 100%; }

  .stat-card { background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.006)), var(--bg2); border: 1px solid var(--border2); border-radius: 8px; padding: 16px; min-height: 108px; display: flex; flex-direction: column; justify-content: center; }
  .stat-label { font-size: 10px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); }
  .stat-value { font-family: var(--mono); font-size: 24px; font-weight: 700; margin-top: 6px; line-height: 1.1; }
  .stat-sub { font-size: 11px; color: var(--text2); margin-top: 6px; line-height: 1.35; }

  .table-wrap { overflow-x: auto; border-radius: inherit; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: var(--mono); min-width: 760px; }
  th { text-align: left; padding: 10px 12px; font-size: 9px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border2); white-space: nowrap; position: sticky; top: 0; background: #0F141C; z-index: 1; }
  td { padding: 11px 12px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.045); white-space: nowrap; vertical-align: middle; color: var(--text2); }
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

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
  .modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 24px; width: min(520px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; box-shadow: 0 20px 80px rgba(0,0,0,0.5); }
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

  @media (max-width: 900px) {
    .content { padding: 18px; }
    .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .header { gap: 12px; }
    .header-right { gap: 8px; }
  }
  @media (max-width: 720px) {
    .header { flex-wrap: wrap; align-items: center; padding: 10px 14px; }
    .header-nav { order: 3; width: 100%; margin-left: 0; padding-bottom: 1px; }
    .header-right { margin-left: auto; }
    .content { padding: 14px; }
    .section-header { align-items: flex-start; flex-direction: column; gap: 10px; }
    .section-header > div:last-child { width: 100%; }
    .modal-actions { flex-wrap: wrap; }
  }
  @media (max-width: 640px) {
    .grid-2, .grid-4 { grid-template-columns: 1fr; }
    .card, .stat-card { padding: 14px; }
    .header-nav .nav-btn { font-size: 10px; padding: 6px 9px; }
    .user-pill { max-width: 110px; }
    .logout-btn { padding-inline: 8px; }
    table { min-width: 720px; }
    th { padding: 9px 10px; }
    td { padding: 10px; }
    .guest-disclaimer-modal { padding: 18px; }
    .guest-disclaimer-overlay .modal-actions { justify-content: stretch; }
    .guest-disclaimer-overlay .modal-actions .btn { flex: 1; }
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
      <p><b>Contact:</b> [Insert Email]</p>
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
    const acceptedAt = new Date().toISOString();
    localStorage.setItem("guestDisclaimerAccepted", "true");
    localStorage.setItem("guestDisclaimerAcceptedAt", acceptedAt);
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardPage({ positions, screenerResults, alerts }) {
  const open = positions.filter(p => p.status !== "CLOSED");
  const totalPnL    = open.reduce((a, p) => a + (p.pnl_dollar || 0), 0);
  const totalMktVal = open.reduce((a, p) => a + (p.market_value || 0), 0);
  const urgent      = open.filter(p => (p.sell_urgency || 0) >= 2).length;
  const topPicks    = screenerResults.filter(s => s.score >= 70).slice(0, 5);

  return (
    <div className="fade-up">
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Open Positions", val: open.length,       sub: "in portfolio",  color: "var(--blue)" },
          { label: "Total P&L",      val: (totalPnL >= 0 ? "+" : "") + "$" + Math.abs(totalPnL).toFixed(0), sub: "unrealized", color: PNL_COLOR(totalPnL) },
          { label: "Market Value",   val: "$" + totalMktVal.toFixed(0), sub: "current", color: "var(--text)" },
          { label: "Sell Alerts",    val: urgent, sub: urgent > 0 ? "needs attention" : "all clear", color: urgent > 0 ? "var(--red)" : "var(--green)" },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={i === 3 && urgent > 0 ? { borderColor: "rgba(255,77,77,.3)" } : {}}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="card">
          <div className="card-title">🔥 Top Screener Picks</div>
          {topPicks.length === 0
            ? <div className="empty" style={{ padding: "20px 0" }}><p>Run a scan in the Screener tab to find opportunities</p></div>
            : topPicks.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14, minWidth: 52 }}>{s.ticker}</div>
                <div style={{ flex: 1 }}>
                  <ScoreGauge score={s.score} />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{s.setup}</div>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, textAlign: "right" }}>
                  <div>${typeof s.price === "number" ? s.price.toFixed(2) : s.price}</div>
                  <div style={{ fontSize: 10, color: "var(--green)" }}>{s.win_rate}% WR</div>
                </div>
              </div>
            ))
          }
        </div>

        <div className="card">
          <div className="card-title">📊 Portfolio Snapshot</div>
          {open.length === 0
            ? <div className="empty" style={{ padding: "20px 0" }}><p>No open positions — log a trade after buying</p></div>
            : open.slice(0, 5).map((p, i) => {
                const badge = URGENCY_BADGE[p.sell_urgency || 0];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14, minWidth: 52 }}>{p.ticker}</div>
                    <div style={{ flex: 1 }}>
                      <PositionBar entry={p.entry_price} current={p.current_price} target={p.target_price} stop={p.stop_loss} />
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{p.days_held}d held</div>
                      <PriceReliabilityBadge position={p} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: PNL_COLOR(p.pnl_pct || 0) }}>
                        {(p.pnl_pct || 0) >= 0 ? "+" : ""}{(p.pnl_pct || 0).toFixed(1)}%
                      </span>
                      <span className="badge" style={{ background: badge.bg, color: badge.text, borderColor: badge.border, fontSize: 9 }}>{badge.label}</span>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card mt-4">
          <div className="card-title">📬 Recent Alerts</div>
          {alerts.slice(0, 4).map((a, i) => (
            <div key={i} className={`alert-card alert-${a.type?.startsWith("BUY") ? "buy" : a.type?.includes("SELL") ? "sell" : "info"}`}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }}>
                  {a.type?.startsWith("BUY") ? "🚀" : "⚠️"} {a.ticker} — {a.type}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{new Date(a.sent_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screener ─────────────────────────────────────────────────────────────────
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
                    <td><span className="tag">{r.setup}</span></td>
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
    setSaving(true);
    const { error } = await api(`/api/portfolio/${editPos.id}`, {
      method: "PUT",
      body: JSON.stringify({ target_price: editPos.target_price, stop_loss: editPos.stop_loss, notes: editPos.notes }),
    });
    setSaving(false);
    if (error) return flash(false, `Update failed: ${error}`);
    setEditPos(null); onRefresh();
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
                    const badge = URGENCY_BADGE[p.sell_urgency || 0];
                    return (
                      <tr key={i}>
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
                            <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => setEditPos({ ...p })}>Edit</button>
                            <button className="btn btn-red" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => { setClosePos(p); setClosePrice(p.current_price?.toFixed(2) || ""); }}>Close</button>
                          </div>
                        </td>
                      </tr>
                    );
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
              <div><label>Target Price</label><input className="input" type="number" step="0.01" value={editPos.target_price || ""} onChange={e => setEditPos({ ...editPos, target_price: e.target.value })} /></div>
              <div><label>Stop Loss</label><input className="input" type="number" step="0.01" value={editPos.stop_loss || ""} onChange={e => setEditPos({ ...editPos, stop_loss: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 10 }}><label>Notes</label><input className="input" value={editPos.notes || ""} onChange={e => setEditPos({ ...editPos, notes: e.target.value })} /></div>
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

  useEffect(() => {
    api("/api/alerts/history").then(({ data, error }) => {
      if (!error && data?.alerts) setAlerts(data.alerts);
      setLoading(false);
    });
  }, []);

  const runCheck = async () => {
    setChecking(true); setCheckResult(null); setCheckErr("");
    const { data, error } = await api("/api/portfolio/check-alerts", { method: "POST" });
    setChecking(false);
    if (error) return setCheckErr(`Check failed: ${error}`);
    setCheckResult(data);
    api("/api/alerts/history").then(({ data }) => { if (data?.alerts) setAlerts(data.alerts); });
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
      </div>

      {loading
        ? <div className="loader"><div className="spin" /><p>Loading…</p></div>
        : alerts.length === 0
          ? <div className="empty"><h3>No alerts yet</h3><p>Run a sell signal check or send a custom alert above</p></div>
          : alerts.map((a, i) => (
            <div key={i} className={`alert-card alert-${a.type?.startsWith("BUY") ? "buy" : a.type?.includes("SELL") ? "sell" : "info"}`}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13 }}>{a.ticker || "—"}</span>
                <span className="badge" style={a.type?.startsWith("BUY") ? { color: "var(--green)", borderColor: "var(--green)", background: "rgba(0,255,178,.1)" } :
                  a.type?.includes("SELL") ? { color: "var(--red)", borderColor: "var(--red)", background: "rgba(255,77,77,.1)" } :
                  { color: "var(--blue)", borderColor: "var(--blue)" }}>{a.type}</span>
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
              ["Dashboard shows no data",          "Normal until you run a scan and log a position"],
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
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => localStorage.getItem("guestDisclaimerAccepted") === "true");
  const [showTerms, setShowTerms] = useState(false);
  const tabs = [
    { id: "dashboard", label: "DASHBOARD", locked: true },
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
          <div className="logo">Swing<span>AI</span></div>
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
              <div style={{ fontSize: 18, fontWeight: 700 }}>{guestTab === "screener" ? "Stock Screener" : tabs.find(t => t.id === guestTab)?.label}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Read-only preview · Sign in to scan, trade, or send alerts</div>
            </div>
            {guestTab === "screener" ? (
              <div className={showLogin ? "grid-2" : undefined} style={{ gap: 12, alignItems: "start" }}>
                <div>
                  <ScreenerPage readOnly />
                  <button className="guest-footer-link" type="button" onClick={() => setShowTerms(true)}>Terms &amp; Disclaimer</button>
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
          </div>
        </main>
      </div>
      {!disclaimerAccepted && (
        <GuestDisclaimerModal onAccept={() => setDisclaimerAccepted(true)} />
      )}
      {showTerms && (
        <GuestDisclaimerModal readOnlyTerms onClose={() => setShowTerms(false)} />
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
    { id: "dashboard", label: "Dashboard" },
    { id: "screener",  label: "Screener" + (topToday > 0 ? ` (${topToday})` : "") },
    { id: "portfolio", label: "Portfolio" + (urgent > 0 ? ` ⚠️${urgent}` : "") },
    { id: "history",   label: "History" },
    { id: "alerts",    label: "Alerts" },
    { id: "settings",  label: "Settings" },
  ];

  const titles = { dashboard: "Dashboard", screener: "Stock Screener", portfolio: "Portfolio Monitor", history: "Trade History", alerts: "Telegram Alerts", settings: "Settings" };
  const subs   = {
    screener:  "Find high-probability setups · Score ≥70 = quality entry",
    portfolio: "Track open positions · AI checks for sell signals",
    dashboard: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    history:   "Closed trades and win rate statistics",
    alerts:    "Telegram alert history and manual controls",
    settings:  "API status and configuration",
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <div className="logo">Swing<span>AI</span></div>
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
            {tab === "dashboard" && <DashboardPage positions={positions} screenerResults={screenerResults} alerts={alerts} />}
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
          </div>
        </main>
      </div>
    </>
  );
}
