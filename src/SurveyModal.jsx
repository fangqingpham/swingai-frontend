import { useState } from "react";

/**
 * SwingAI guest feedback survey — dependency-free overlay (no icon library).
 * Props:
 *   onSubmit(payload)  called when the user finishes (either "No thanks" or full submit)
 *   onClose()          called when the overlay is dismissed
 *
 * payload = {
 *   overall_rating, continued, ease_of_use, tenure, portfolio_change,
 *   ai_analysis_accuracy, would_recommend, improvement_feedback, submitted_at
 * }
 */

const C = {
  bg: "#06080D",
  card: "#0D1118",
  panel: "#121821",
  border: "rgba(255,255,255,0.10)",
  borderHi: "rgba(0,255,178,0.35)",
  text: "rgba(246,248,251,0.94)",
  sub: "rgba(223,232,244,0.66)",
  faint: "rgba(223,232,244,0.40)",
  green: "#00FFB2",
  gold: "#FBB024",
  red: "#FF4D4D",
  blue: "#4DA6FF",
};

const DURATIONS = ["Less than 1 month", "1 – 2 months", "2 – 3 months", "More than 3 months"];
const EASE = ["Very difficult", "Difficult", "Neutral", "Easy", "Very easy"];
const PORTFOLIO = [
  { group: "Gains", tone: C.green, options: ["Increased more than 30%", "Increased 20 – 30%", "Increased 10 – 20%", "Increased up to 10%"] },
  { group: "No change", tone: C.sub, options: ["No material change"] },
  { group: "Losses", tone: C.red, options: ["Decreased up to 30%", "Decreased 30 – 50%", "Decreased more than 50%"] },
];

export default function SurveyModal({ onSubmit, onClose }) {
  const [step, setStep] = useState("rating"); // rating | gate | detailed | done
  const [exitedEarly, setExitedEarly] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [ease, setEase] = useState(null);
  const [duration, setDuration] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [aiAccuracy, setAiAccuracy] = useState(0);
  const [recommend, setRecommend] = useState(null);
  const [comment, setComment] = useState("");

  const detailedValid = ease !== null && duration !== null && portfolio !== null && recommend !== null;

  const finish = (continued) => {
    const payload = {
      overall_rating: rating,
      continued,
      ease_of_use: continued && ease !== null ? EASE[ease] : null,
      tenure: continued ? duration : null,
      portfolio_change: continued ? portfolio : null,
      ai_analysis_accuracy: continued ? (aiAccuracy || null) : null,
      would_recommend: continued ? recommend : null,
      improvement_feedback: continued ? (comment.trim() || null) : null,
      submitted_at: new Date().toISOString(),
    };
    try { onSubmit && onSubmit(payload); } catch (e) { /* ignore */ }
    setStep("done");
  };

  const Star = ({ filled, size, onClick, onEnter, onLeave }) => (
    <span
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ cursor: onClick ? "pointer" : "default", fontSize: size, lineHeight: 1, color: filled ? C.gold : "rgba(255,255,255,0.14)", transition: "color .15s, transform .12s", display: "inline-block" }}
    >★</span>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto", background: `radial-gradient(120% 90% at 50% -10%, ${C.panel} 0%, ${C.card} 55%)`, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,0.6)", color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card, zIndex: 2 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.3px" }}>
            Swing<span style={{ color: C.green }}>AI</span>
          </span>
          <span style={{ marginLeft: 10, fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: "1.6px" }}>Feedback</span>
          <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", background: "none", border: "none", color: C.faint, fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>×</button>
        </div>

        <div style={{ padding: "28px 24px 32px" }}>
          {/* STEP 1 — RATING */}
          {step === "rating" && (
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 23, margin: "0 0 6px" }}>How do you like the app?</h2>
              <p style={{ color: C.sub, margin: "0 0 24px", fontSize: 14 }}>Tap a star to rate your overall experience with SwingAI.</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={42} filled={(hover || rating) >= n} onClick={() => setRating(n)} onEnter={() => setHover(n)} onLeave={() => setHover(0)} />
                ))}
              </div>
              <div style={{ textAlign: "center", height: 20, color: C.gold, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                {(hover || rating) > 0 ? `${hover || rating} / 5 — ${["Poor", "Fair", "Good", "Very good", "Excellent"][(hover || rating) - 1]}` : ""}
              </div>
              <button disabled={!rating} onClick={() => setStep("gate")} style={primaryBtn(!!rating)}>Continue →</button>
            </div>
          )}

          {/* STEP 2 — GATE */}
          {step === "gate" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} filled={rating >= n} />)}
              </div>
              <h2 style={{ fontWeight: 800, fontSize: 22, margin: "0 0 10px" }}>Thank you for rating us</h2>
              <p style={{ color: C.sub, margin: "0 auto 26px", fontSize: 14, maxWidth: 420, lineHeight: 1.55 }}>
                Your input directly shapes the product. Would you be willing to answer a few more questions so we can improve SwingAI and serve you better?
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => { setExitedEarly(true); finish(false); }} style={ghostBtn()}>No, thanks</button>
                <button onClick={() => setStep("detailed")} style={{ ...primaryBtn(true), marginTop: 0, width: "auto", padding: "12px 24px" }}>Yes, continue →</button>
              </div>
            </div>
          )}

          {/* STEP 3 — DETAILED */}
          {step === "detailed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <Section n="01" title="How easy is SwingAI to use?">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {EASE.map((o, i) => (
                    <button key={o} onClick={() => setEase(i)} style={segBtn(ease === i)}>{o}</button>
                  ))}
                </div>
              </Section>

              <Section n="02" title="How long have you been using SwingAI?">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {DURATIONS.map((o) => <Chip key={o} label={o} active={duration === o} tone={C.blue} onClick={() => setDuration(o)} />)}
                </div>
              </Section>

              <Section n="03" title="How has your portfolio changed since you started?" hint="Measured from your first day on SwingAI to today.">
                {PORTFOLIO.map((g) => (
                  <div key={g.group} style={{ marginBottom: 12 }}>
                    <div style={{ color: g.tone, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>{g.group}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {g.options.map((o) => <Chip key={o} label={o} active={portfolio === o} tone={g.tone} onClick={() => setPortfolio(o)} />)}
                    </div>
                  </div>
                ))}
              </Section>

              <Section n="04" title="How accurate is the AI stock analysis?">
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={28} filled={aiAccuracy >= n} onClick={() => setAiAccuracy(n)} />)}
                </div>
              </Section>

              <Section n="05" title="Would you recommend SwingAI to others?">
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setRecommend(true)} style={yesNoBtn(recommend === true, C.green)}>Yes</button>
                  <button onClick={() => setRecommend(false)} style={yesNoBtn(recommend === false, C.red)}>No</button>
                </div>
              </Section>

              <Section n="06" title="What is the one thing we could improve?" hint="Optional.">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Share anything that would make SwingAI more valuable to you…"
                  style={{ width: "100%", resize: "vertical", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "11px 13px", fontSize: 14, fontFamily: "Inter, system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                />
              </Section>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={() => setStep("gate")} style={ghostBtn()}>← Back</button>
                <button disabled={!detailedValid} onClick={() => finish(true)} style={{ ...primaryBtn(detailedValid), marginTop: 0, flex: 1 }}>Submit feedback ✓</button>
              </div>
              {!detailedValid && <p style={{ color: C.faint, fontSize: 12, margin: 0, textAlign: "center" }}>Please answer questions 1–3 and 5 to submit.</p>}
            </div>
          )}

          {/* STEP 4 — DONE */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 20px", display: "grid", placeItems: "center", background: "rgba(0,255,178,0.13)", border: `1px solid ${C.borderHi}`, color: C.green, fontSize: 28 }}>✓</div>
              <h2 style={{ fontWeight: 800, fontSize: 22, margin: "0 0 10px" }}>{exitedEarly ? "Thank you" : "Thank you for completing the survey"}</h2>
              <p style={{ color: C.sub, margin: "0 auto 22px", fontSize: 14, maxWidth: 380, lineHeight: 1.55 }}>
                {exitedEarly
                  ? "We appreciate your rating and will keep working to make SwingAI better for you."
                  : "Your responses have been recorded. They genuinely help us build a smarter, more reliable trading platform."}
              </p>
              <button onClick={onClose} style={{ ...primaryBtn(true), marginTop: 0, width: "auto", padding: "11px 26px" }}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function Section({ n, title, hint, children }) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: hint ? 4 : 12 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.green, fontWeight: 700 }}>{n}</span>
          <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{title}</h3>
        </div>
        {hint && <p style={{ color: C.faint, fontSize: 12, margin: "0 0 12px", paddingLeft: 22 }}>{hint}</p>}
        <div style={{ paddingLeft: 22 }}>{children}</div>
      </div>
    );
  }

  function Chip({ label, active, tone, onClick }) {
    return (
      <button onClick={onClick} style={{ padding: "9px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 500, background: active ? `${tone}22` : C.panel, color: active ? tone : C.sub, border: `1px solid ${active ? tone : C.border}`, transition: "all .12s" }}>{label}</button>
    );
  }
}

function primaryBtn(enabled) {
  return { marginTop: 26, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 20px", borderRadius: 10, border: "none", cursor: enabled ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 15, color: enabled ? "#04140d" : "rgba(223,232,244,0.4)", background: enabled ? "linear-gradient(135deg, #00FFB2, #00C48C)" : "#121821", opacity: enabled ? 1 : 0.7, transition: "all .15s" };
}
function ghostBtn() {
  return { display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 22px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14, color: "rgba(223,232,244,0.66)", background: "transparent", border: "1px solid rgba(255,255,255,0.10)" };
}
function segBtn(on) {
  return { padding: "10px 4px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600, lineHeight: 1.2, background: on ? "#00FFB2" : "#121821", color: on ? "#04140d" : "rgba(223,232,244,0.66)", border: `1px solid ${on ? "#00FFB2" : "rgba(255,255,255,0.10)"}`, transition: "all .12s" };
}
function yesNoBtn(on, tone) {
  return { flex: 1, padding: "13px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 15, background: on ? `${tone}22` : "#121821", color: on ? tone : "rgba(223,232,244,0.66)", border: `1px solid ${on ? tone : "rgba(255,255,255,0.10)"}`, transition: "all .12s" };
}
