import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── Config ─────────────────────────────────────────────────────────────────
const API_BASE = ""; // Vercel rewrites proxy /api/* to Railway — see vercel.json
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cpoumpdgmjbqhmjqrgec.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb3VtcGRnbWpicWhtanFyZ2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDcxNDcsImV4cCI6MjA5NTI4MzE0N30.q4-QleVM5flNGGltA7veVwrQq0e8NX-luz6eNdJ3lNs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Returns { data, error } — never throws
const api = async (path, opts = {}) => {
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...opts.headers },
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
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #050B14;
    --bg2:      #0D1520;
    --bg3:      #111D2E;
    --bg4:      #182435;
    --border:   rgba(0,255,178,0.12);
    --border2:  rgba(255,255,255,0.06);
    --green:    #00FFB2;
    --green2:   #A3F7BF;
    --red:      #FF4D4D;
    --amber:    #FBB024;
    --blue:     #4DA6FF;
    --muted:    rgba(255,255,255,0.35);
    --text:     rgba(255,255,255,0.9);
    --text2:    rgba(255,255,255,0.6);
    --mono:     'JetBrains Mono', monospace;
    --ui:       'Syne', sans-serif;
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--ui); overflow: hidden; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  .header { display: flex; align-items: center; gap: 16px; padding: 0 20px; height: 52px; background: var(--bg2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .logo { font-family: var(--ui); font-weight: 800; font-size: 18px; letter-spacing: -0.5px; background: linear-gradient(135deg, var(--green), #4DA6FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .logo span { font-weight: 400; opacity: 0.5; }
  .header-nav { display: flex; gap: 4px; margin-left: 12px; }
  .nav-btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-family: var(--ui); font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; background: transparent; color: var(--text2); transition: all 0.15s; }
  .nav-btn:hover { background: var(--bg3); color: var(--text); }
  .nav-btn.active { background: rgba(0,255,178,0.12); color: var(--green); }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); }
  .user-pill { padding: 4px 12px; border-radius: 20px; background: var(--bg3); border: 1px solid var(--border2); font-size: 11px; color: var(--text2); cursor: pointer; }
  .logout-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border2); background: transparent; color: var(--muted); font-size: 11px; cursor: pointer; }
  .logout-btn:hover { border-color: var(--red); color: var(--red); }

  .main { display: flex; flex: 1; overflow: hidden; }
  .content { flex: 1; overflow-y: auto; padding: 20px; }

  .card { background: var(--bg2); border: 1px solid var(--border2); border-radius: 10px; padding: 16px; }
  .card-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .mt-3 { margin-top: 12px; }
  .mt-4 { margin-top: 16px; }
  .w-full { width: 100%; }

  .stat-card { background: var(--bg2); border: 1px solid var(--border2); border-radius: 10px; padding: 14px 16px; }
  .stat-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
  .stat-value { font-family: var(--mono); font-size: 24px; font-weight: 700; margin-top: 4px; }
  .stat-sub { font-size: 11px; color: var(--text2); margin-top: 3px; }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-family: var(--mono); }
  th { text-align: left; padding: 8px 10px; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; position: sticky; top: 0; background: var(--bg2); z-index: 1; }
  td { padding: 9px 10px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); white-space: nowrap; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  tr:last-child td { border-bottom: none; }

  .score-bar { display: flex; align-items: center; gap: 8px; }
  .score-bar-bg { flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }

  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid currentColor; white-space: nowrap; }

  .pos-progress { position: relative; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: visible; min-width: 80px; }
  .pos-fill { height: 100%; border-radius: 3px; }
  .pos-marker { position: absolute; top: -4px; width: 2px; height: 14px; background: white; border-radius: 1px; box-shadow: 0 0 4px rgba(255,255,255,0.6); }

  .btn { padding: 7px 14px; border-radius: 6px; border: none; cursor: pointer; font-family: var(--ui); font-size: 12px; font-weight: 700; transition: all 0.15s; white-space: nowrap; }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .btn-green { background: rgba(0,255,178,0.15); color: var(--green); border: 1px solid rgba(0,255,178,0.3); }
  .btn-green:hover:not(:disabled) { background: rgba(0,255,178,0.25); }
  .btn-red { background: rgba(255,77,77,0.15); color: var(--red); border: 1px solid rgba(255,77,77,0.3); }
  .btn-red:hover:not(:disabled) { background: rgba(255,77,77,0.25); }
  .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border2); }
  .btn-ghost:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
  .btn-blue { background: rgba(77,166,255,0.15); color: var(--blue); border: 1px solid rgba(77,166,255,0.3); }
  .btn-amber { background: rgba(251,176,36,0.15); color: var(--amber); border: 1px solid rgba(251,176,36,0.3); }

  .input { background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px; padding: 8px 12px; color: var(--text); font-family: var(--mono); font-size: 13px; outline: none; width: 100%; }
  .input:focus { border-color: var(--green); }
  .input::placeholder { color: var(--muted); }
  label { font-size: 11px; font-weight: 600; color: var(--text2); margin-bottom: 4px; display: block; }

  .login-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 0%, rgba(0,255,178,0.04) 0%, transparent 60%), var(--bg); }
  .login-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 40px 36px; width: 360px; box-shadow: 0 0 60px rgba(0,255,178,0.05); }
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

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 24px; width: min(480px, 90vw); box-shadow: 0 20px 80px rgba(0,0,0,0.5); }
  .modal-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

  .alert-card { background: var(--bg3); border: 1px solid var(--border2); border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
  .alert-buy  { border-left: 3px solid var(--green); }
  .alert-sell { border-left: 3px solid var(--red); }
  .alert-info { border-left: 3px solid var(--blue); }

  .tag { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(255,255,255,0.07); color: var(--text2); }
  .signals-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .signal-pill { padding: 2px 8px; border-radius: 4px; font-size: 10px; background: rgba(0,255,178,0.08); color: var(--green2); border: 1px solid rgba(0,255,178,0.15); }

  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .section-title { font-size: 15px; font-weight: 700; }
  .section-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .grid-2.gap-3 { gap: 12px; }

  @media (max-width: 900px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .grid-2, .grid-4 { grid-template-columns: 1fr; } .header-nav .nav-btn { font-size: 10px; padding: 5px 8px; } }
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

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage() {
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

  return (
    <div className="login-screen">
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
    </div>
  );
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
function ScreenerPage() {
  const [results, setResults]     = useState([]);
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

  useEffect(() => {
    api("/api/screener/results").then(({ data }) => {
      if (data?.results?.length) setResults(data.results);
    });
  }, []);

  const runScan = async () => {
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
        if (onScanComplete) onScanComplete();
      }
    }, 3000);
  };

  const analyzeStock = async ticker => {
    setSelected(ticker); setAnalyzeLoading(true); setAnalysis(null);
    const { data, error } = await api("/api/ai/analyze", { method: "POST", body: JSON.stringify({ ticker }) });
    setAnalysis(error ? { error } : data);
    setAnalyzeLoading(false);
  };

  const sendAlert = async ticker => {
    setAlertSent(p => ({ ...p, [ticker]: "sending" }));
    await api(`/api/alerts/send-buy?ticker=${ticker}`, { method: "POST" });
    setAlertSent(p => ({ ...p, [ticker]: "sent" }));
    setTimeout(() => setAlertSent(p => ({ ...p, [ticker]: null })), 3000);
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
              onChange={e => setCustomTickers(e.target.value)} onKeyDown={e => e.key === "Enter" && runScan()} style={{ fontSize: 12 }} />
          </div>
          <div style={{ minWidth: 110 }}>
            <label>Min Score</label>
            <input className="input" type="number" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <button className="btn btn-green" onClick={runScan} disabled={loading} style={{ padding: "8px 20px", alignSelf: "flex-end" }}>
            {loading ? "⏳ Scanning…" : "▶ Run Scan"}
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
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>
          💡 <b>Tip:</b> Type <b>AAPL MSFT NVDA</b> for a quick 3-stock test first.
        </div>
      </div>

      {filtered.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{filtered.length} results</span>
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

      {filtered.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Ticker</th><th>Price</th><th>Chg%</th><th>Score</th><th>Win Rate</th><th>Setup</th><th>RSI</th><th>Vol</th><th>Target</th><th>Stop</th><th>R:R</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</td>
                    <td>${typeof r.price === "number" ? r.price.toFixed(2) : r.price}</td>
                    <td><span style={{ color: (r.change_pct || 0) >= 0 ? "var(--green)" : "var(--red)" }}>{(r.change_pct || 0) >= 0 ? "+" : ""}{(r.change_pct || 0).toFixed(2)}%</span></td>
                    <td><ScoreGauge score={r.score} /></td>
                    <td><span style={{ color: SCORE_COLOR(r.score), fontWeight: 700 }}>{r.win_rate}%</span></td>
                    <td><span className="tag">{r.setup}</span></td>
                    <td><span style={{ color: (r.rsi || 50) < 35 ? "var(--green)" : (r.rsi || 50) > 70 ? "var(--red)" : "var(--text2)" }}>{r.rsi?.toFixed(0) || "–"}</span></td>
                    <td><span style={{ color: (r.vol_ratio || 0) > 1.5 ? "var(--amber)" : "var(--text2)" }}>{r.vol_ratio?.toFixed(1) || "–"}x</span></td>
                    <td style={{ color: "var(--green)" }}>${r.target?.toFixed(2)}</td>
                    <td style={{ color: "var(--red)" }}>${r.stop?.toFixed(2)}</td>
                    <td style={{ color: "var(--blue)" }}>1:{r.risk_reward?.toFixed(1)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-blue" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => analyzeStock(r.ticker)}>AI</button>
                        <button className="btn btn-amber" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => sendAlert(r.ticker)} disabled={alertSent[r.ticker] === "sending"}>
                          {alertSent[r.ticker] === "sent" ? "✓" : alertSent[r.ticker] === "sending" ? "…" : "📲"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      <div className="section-header">
        <div>
          <div className="section-title">Open Positions</div>
          <div className="section-sub">AI monitors these for sell signals automatically</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onRefresh} style={{ padding: "6px 12px", fontSize: 11 }}>↺ Refresh</button>
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
                  <tr><th>Ticker</th><th>Entry</th><th>Current</th><th>P&L</th><th>Qty</th><th>Value</th><th>Days</th><th>Progress</th><th>Signal</th><th>Reasons</th><th>Actions</th></tr>
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
    await api(`/api/settings?key=min_score_alert&value=${minScore}`, { method: "POST" });
    if (finnhubKey) await api(`/api/settings?key=finnhub_key&value=${finnhubKey}`, { method: "POST" });
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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab,         setTab]         = useLocalStorage("swingai-tab", "dashboard");
  const [positions,   setPositions]   = useState([]);
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

  const loadData = useCallback(async () => {
    const [posRes, alertRes, scanRes] = await Promise.all([
      api("/api/portfolio/positions"),
      api("/api/alerts/history"),
      api("/api/screener/results"),
    ]);
    if (posRes.data)   setPositions(posRes.data.positions || []);
    if (alertRes.data) setAlerts(alertRes.data.alerts || []);
    if (scanRes.data)  setScreenerResults(scanRes.data.results || []);
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="spin" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!user) return <LoginPage />;

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
            {tab === "screener"  && <ScreenerPage />}
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
