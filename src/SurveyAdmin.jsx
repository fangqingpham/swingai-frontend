import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// Reuses the app's global CSS (injected by App.jsx) and the same Supabase client.
// If no `supabase` prop is passed, falls back to a local client.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cpoumpdgmjbqhmjqrgec.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb3VtcGRnbWpicWhtanFyZ2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDcxNDcsImV4cCI6MjA5NTI4MzE0N30.q4-QleVM5flNGGltA7veVwrQq0e8NX-luz6eNdJ3lNs";

let _fallback;
const getClient = (passed) => {
  if (passed) return passed;
  if (!_fallback) _fallback = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _fallback;
};

const TENURE_ORDER = ["Less than 1 month", "1 – 2 months", "2 – 3 months", "More than 3 months"];
const EASE_ORDER = ["Very difficult", "Difficult", "Neutral", "Easy", "Very easy"];
const PORTFOLIO_ORDER = [
  "Increased more than 30%", "Increased 20 – 30%", "Increased 10 – 20%", "Increased up to 10%",
  "No material change",
  "Decreased up to 30%", "Decreased 30 – 50%", "Decreased more than 50%",
];

const RATING_COLOR = (n) => (n <= 2 ? "#FF4D4D" : n === 3 ? "#FBB024" : "#00FFB2");

const PORTFOLIO_COLOR = (label) =>
  label?.startsWith("Increased") ? "#00FFB2" : label?.startsWith("Decreased") ? "#FF4D4D" : "var(--muted)";

const mean = (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);

const tally = (rows, key, order) => {
  const counts = {};
  rows.forEach((r) => {
    const v = r[key];
    if (v != null && v !== "") counts[v] = (counts[v] || 0) + 1;
  });
  const ordered = order ? order.filter((k) => k in counts) : [];
  const extras = Object.keys(counts).filter((k) => !ordered.includes(k));
  return [...ordered, ...extras].map((k) => ({ label: k, count: counts[k] }));
};

function Stars({ n, size = 14 }) {
  return (
    <span style={{ color: "#FBB024", fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(n)}<span style={{ color: "var(--border)" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

function DistBar({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <div style={{ width: 150, fontSize: 12, color: "var(--text2)", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color || "var(--blue)", borderRadius: 4, transition: "width .4s" }} />
      </div>
      <div style={{ width: 28, textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)" }}>{count}</div>
    </div>
  );
}

function Distribution({ title, data, colorFn }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {data.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>No data yet.</div>
      ) : (
        data.map((d) => (
          <DistBar key={d.label} label={d.label} count={d.count} max={max} color={colorFn ? colorFn(d.label) : undefined} />
        ))
      )}
    </div>
  );
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)" }}>{payload[0].value} response{payload[0].value === 1 ? "" : "s"}</div>
    </div>
  );
};

export default function SurveyAdmin({ supabase }) {
  const client = getClient(supabase);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error } = await client
      .from("survey_responses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message || "Could not load responses.");
    setRows(data || []);
    setLoading(false);
  }, [client]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!rows?.length) return;
    const cols = ["created_at", "overall_rating", "continued", "ease_of_use", "tenure",
      "portfolio_change", "ai_analysis_accuracy", "would_recommend", "improvement_feedback"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `swingai-survey-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loader"><div className="spin" /><p>Loading feedback…</p></div>;

  if (error) return (
    <div className="fade-up">
      <div className="err-box">
        <b>Could not load survey responses:</b> {error}
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          If this says permission denied, run the admin read policy in Supabase → SQL Editor
          (survey_admin_policy.sql).
        </div>
      </div>
    </div>
  );

  const all = rows || [];
  const continued = all.filter((r) => r.continued);
  const total = all.length;

  const avgRating = mean(all.map((r) => Number(r.overall_rating)).filter(Number.isFinite));
  const avgAi = mean(continued.map((r) => Number(r.ai_analysis_accuracy)).filter(Number.isFinite));
  const recYes = continued.filter((r) => r.would_recommend === true).length;
  const recNo = continued.filter((r) => r.would_recommend === false).length;
  const recRate = recYes + recNo > 0 ? (recYes / (recYes + recNo)) * 100 : 0;

  const ratingDist = [1, 2, 3, 4, 5].map((n) => ({
    star: `${n}★`,
    n,
    count: all.filter((r) => Number(r.overall_rating) === n).length,
  }));

  const comments = all.filter((r) => r.improvement_feedback && r.improvement_feedback.trim());

  const stats = [
    { label: "Total Responses", val: total, sub: `${continued.length} completed full survey`, color: "var(--text)" },
    { label: "Avg Rating", val: total ? avgRating.toFixed(2) : "—", sub: "out of 5 stars", color: total ? RATING_COLOR(Math.round(avgRating)) : "var(--muted)" },
    { label: "Would Recommend", val: recYes + recNo ? `${recRate.toFixed(0)}%` : "—", sub: `${recYes} yes · ${recNo} no`, color: recRate >= 50 ? "var(--green)" : "var(--red)" },
    { label: "AI Analysis Accuracy", val: avgAi ? avgAi.toFixed(2) : "—", sub: "avg of those who continued", color: avgAi ? RATING_COLOR(Math.round(avgAi)) : "var(--muted)" },
  ];

  return (
    <div className="fade-up">
      <div className="section-header" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title">Feedback Overview</div>
          <div className="section-sub">Responses from the in-app survey</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} style={{ padding: "6px 12px", fontSize: 11 }}>↺ Refresh</button>
          <button className="btn btn-blue" onClick={exportCsv} disabled={!total} style={{ padding: "6px 12px", fontSize: 11 }}>Export CSV</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <h3>No responses yet</h3>
          <p>Feedback will appear here as visitors complete the survey.</p>
        </div>
      ) : (
        <>
          <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
            <div className="card">
              <div className="card-title">Rating Distribution</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ratingDist} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="star" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {ratingDist.map((d) => <Cell key={d.n} fill={RATING_COLOR(d.n)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Distribution title="How easy to use" data={tally(continued, "ease_of_use", EASE_ORDER)} />
          </div>

          <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
            <Distribution title="Time using SwingAI" data={tally(continued, "tenure", TENURE_ORDER)} />
            <Distribution title="Portfolio change since start" data={tally(continued, "portfolio_change", PORTFOLIO_ORDER)} colorFn={PORTFOLIO_COLOR} />
          </div>

          <div className="card">
            <div className="card-title">Comments · “What could we improve?” ({comments.length})</div>
            {comments.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>No written comments yet.</div>
            ) : (
              comments.map((r) => (
                <div key={r.id} className="alert-card alert-info" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <Stars n={Number(r.overall_rating) || 0} />
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {new Date(r.created_at).toLocaleDateString()} · {r.tenure || "—"}
                      {r.portfolio_change ? ` · ${r.portfolio_change}` : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                    {r.improvement_feedback}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
