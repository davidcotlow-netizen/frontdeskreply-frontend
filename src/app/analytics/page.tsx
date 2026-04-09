"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Period = "today" | "week" | "month";

interface Summary {
  total_conversations: number;
  total_messages: number;
  visitor_messages: number;
  ai_messages: number;
  avg_response_seconds: number | null;
  avg_chat_length: number;
  active_now: number;
  leads_with_email: number;
  leads_with_phone: number;
}

interface DayData { date: string; count: number; }
interface ResponseDay { date: string; avg_seconds: number | null; count: number; }
interface QuestionItem { question: string; count: number; }

function formatSeconds(s: number | null): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.round(s / 60)}m ${Math.round(s % 60)}s`;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}

/* ── Bar Chart ───────────────────────────────────────────────── */
function BarChart({ data, color, label }: { data: DayData[]; color: string; label: string }) {
  const max = Math.max(...data.map(d => d.count), 1);

  if (!data.length || data.every(d => d.count === 0)) {
    return (
      <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No {label.toLowerCase()} data yet</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, padding: "0 4px" }}>
      {data.map(d => {
        const h = d.count > 0 ? Math.max((d.count / max) * 130, 8) : 4;
        return (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
              {d.count > 0 ? d.count : ""}
            </span>
            <div style={{
              width: "100%", maxWidth: 40, height: h, borderRadius: 4,
              background: d.count > 0 ? color : "rgba(255,255,255,0.06)",
              opacity: d.count > 0 ? 0.85 : 1,
              transition: "height 0.5s ease",
            }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{shortDay(d.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Stat Card ────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub: string; color: string; icon: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
      borderTop: `2px solid ${color}`, borderRadius: 12, padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { user, isLoaded } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [period, setPeriod] = useState<Period>("week");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [convByDay, setConvByDay] = useState<DayData[]>([]);
  const [responseByDay, setResponseByDay] = useState<ResponseDay[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    setLoading(true);

    Promise.all([
      fetch(`${API}/analytics/summary?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/conversations-by-day?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/response-time-trend?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/top-questions?business_id=${businessId}&period=${period}`).then(r => r.json()),
    ]).then(([s, c, r, q]) => {
      setSummary(s);
      setConvByDay(c.data || []);
      setResponseByDay(r.data || []);
      setQuestions(q.questions || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [isLoaded, businessId, period]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>Performance snapshot for your AI chatbot</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 4 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 12.5, fontWeight: 500,
              background: period === p.key ? "var(--accent)" : "transparent",
              color: period === p.key ? "#fff" : "var(--text-muted)",
              transition: "all 0.15s",
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[...Array(5)].map((_, i) => <div key={i} style={{ flex: 1, minWidth: 140, height: 110, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12 }} className="shimmer" />)}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Conversations" value={summary?.total_conversations ?? 0} sub="chat sessions" color="#E8714A" icon="💬" />
          <StatCard label="Messages" value={summary?.total_messages ?? 0} sub={`${summary?.visitor_messages ?? 0} visitor · ${summary?.ai_messages ?? 0} AI`} color="#3b82f6" icon="📝" />
          <StatCard label="Avg Chat Length" value={summary?.avg_chat_length ? `${summary.avg_chat_length} msgs` : "—"} sub="messages per conversation" color="#10b981" icon="📊" />
          <StatCard label="AI Response Time" value={formatSeconds(summary?.avg_response_seconds ?? null)} sub="avg reply speed" color="#06b6d4" icon="⚡" />
          <StatCard label="Leads Captured" value={summary?.leads_with_email ?? 0} sub={`${summary?.leads_with_phone ?? 0} with phone`} color="#8b5cf6" icon="📥" />
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Conversations by Day */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Conversations by Day</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>Chat sessions started per day</div>
          </div>
          {loading ? (
            <div style={{ height: 160, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} className="shimmer" />
          ) : (
            <BarChart data={convByDay} color="#E8714A" label="conversation" />
          )}
        </div>

        {/* Response Time by Day */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>AI Response Time</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>Average reply speed by day (seconds)</div>
          </div>
          {loading ? (
            <div style={{ height: 160, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} className="shimmer" />
          ) : (
            <ResponseTimeChart data={responseByDay} />
          )}
        </div>
      </div>

      {/* Top Visitor Questions */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px", marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>What Visitors Are Asking</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>Most common questions from live chat conversations</div>
        </div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(5)].map((_, i) => <div key={i} style={{ height: 36, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} className="shimmer" />)}
          </div>
        ) : questions.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>No visitor questions yet</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Chat conversations will populate this section with real customer questions.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {questions.map((q, idx) => {
              const maxCount = questions[0]?.count || 1;
              const barW = (q.count / maxCount) * 100;
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace", minWidth: 24, textAlign: "right" }}>
                    #{idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                        &ldquo;{q.question}&rdquo;
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 8,
                        background: "rgba(232,113,74,0.12)", color: "#E8714A", flexShrink: 0,
                      }}>
                        {q.count}x
                      </span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barW}%`, background: "#E8714A", borderRadius: 2, opacity: 0.6, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {questions.length > 0 && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(232,113,74,0.06)", border: "1px solid rgba(232,113,74,0.15)", borderRadius: 10, display: "flex", gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--text-primary)" }}>Tip:</strong> If you see a frequent question not covered in your FAQs, add it in Settings. This helps your chatbot respond more accurately.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chatbot Performance */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Chatbot Performance</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 20 }}>How your AI chatbot compares to industry benchmarks</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            {
              label: "Response Time",
              yours: formatSeconds(summary?.avg_response_seconds ?? null),
              industry: "4 min",
              better: summary?.avg_response_seconds != null && summary.avg_response_seconds < 240,
            },
            {
              label: "Lead Capture Rate",
              yours: summary?.total_conversations
                ? `${Math.round((summary.leads_with_email / summary.total_conversations) * 100)}%`
                : "—",
              industry: "~48%",
              better: summary?.total_conversations ? (summary.leads_with_email / summary.total_conversations) > 0.48 : false,
            },
            {
              label: "Availability",
              yours: "24/7",
              industry: "Business hours",
              better: true,
            },
          ].map(row => (
            <div key={row.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>{row.label}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>Your Chatbot</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: row.better ? "#10b981" : "var(--text-primary)", letterSpacing: "-0.02em" }}>{row.yours}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>Industry Avg</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", letterSpacing: "-0.02em" }}>{row.industry}</div>
                </div>
              </div>
              {row.better && (
                <div style={{ marginTop: 12, padding: "4px 10px", background: "rgba(16,185,129,0.1)", borderRadius: 6, fontSize: 11, color: "#10b981", fontWeight: 500, display: "inline-block" }}>
                  Ahead of industry
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Response Time Chart ──────────────────────────────────────── */
function ResponseTimeChart({ data }: { data: ResponseDay[] }) {
  const filtered = data.filter(d => d.avg_seconds !== null);

  if (!filtered.length) {
    return (
      <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No response time data yet</span>
      </div>
    );
  }

  const max = Math.max(...filtered.map(d => d.avg_seconds || 0), 5);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, padding: "0 4px" }}>
      {data.map(d => {
        const val = d.avg_seconds;
        const h = val !== null ? Math.max((val / max) * 130, 8) : 4;
        return (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
              {val !== null ? `${Math.round(val)}s` : ""}
            </span>
            <div style={{
              width: "100%", maxWidth: 40, height: h, borderRadius: 4,
              background: val !== null ? "#06b6d4" : "rgba(255,255,255,0.06)",
              opacity: val !== null ? 0.85 : 1,
              transition: "height 0.5s ease",
            }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{shortDay(d.date)}</span>
          </div>
        );
      })}
    </div>
  );
}
