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
  conversion_rate: number;
  accuracy_rate: number;
  total_calls: number;
  total_call_minutes: number;
  avg_call_duration_seconds: number;
  active_calls: number;
}

interface DayData { date: string; count: number; }
interface ResponseDay { date: string; avg_seconds: number | null; count: number; }
interface QuestionItem { question: string; count: number; }

interface LeadSourceItem { source: string; count: number; }
interface LeadSourceData { sources: LeadSourceItem[]; total_with_source: number; channel_breakdown: { chat: number; phone: number }; }
interface FunnelStage { stage: string; count: number; }
interface FunnelData { funnel: FunnelStage[]; }
interface PeakHourCell { day: string; hour: number; count: number; }
interface PeakHoursData { data: PeakHourCell[]; max_count: number; days: string[]; }

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
  const [callsByDay, setCallsByDay] = useState<DayData[]>([]);
  const [responseByDay, setResponseByDay] = useState<ResponseDay[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSourceData | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHoursData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    setLoading(true);

    Promise.all([
      fetch(`${API}/analytics/summary?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/conversations-by-day?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/calls-by-day?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/response-time-trend?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/top-questions?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/analytics/lead-sources?business_id=${businessId}&period=${period}`).then(r => r.json()).catch(() => null),
      fetch(`${API}/analytics/conversion-funnel?business_id=${businessId}&period=${period}`).then(r => r.json()).catch(() => null),
      fetch(`${API}/analytics/peak-hours?business_id=${businessId}&period=${period}`).then(r => r.json()).catch(() => null),
    ]).then(([s, c, cb, r, q, ls, fn, ph]) => {
      setSummary(s);
      setConvByDay(c.data || []);
      setCallsByDay(cb.data || []);
      setResponseByDay(r.data || []);
      setQuestions(q.questions || []);
      setLeadSources(ls);
      setFunnelData(fn);
      setPeakHours(ph);
    }).catch(console.error).finally(() => setLoading(false));
  }, [isLoaded, businessId, period]);

  function exportAnalytics() {
    if (!summary) return;
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const periodLabel = period === "today" ? "Today" : period === "week" ? "This Week" : "This Month";

    const questionRows = questions.map((q, i) =>
      `<tr style="height:28px;background:${i % 2 === 0 ? "#FFFFFF" : "#F7F8FA"}">
        <td style="font-size:12px;color:#9CA3AF;text-align:center;padding:0 8px;border-bottom:1px solid #E2E5EA">${i + 1}</td>
        <td style="font-size:12px;color:#374151;padding:4px 12px;border-bottom:1px solid #E2E5EA">${q.question}</td>
        <td style="font-size:12px;color:#374151;text-align:center;font-weight:600;padding:0 8px;border-bottom:1px solid #E2E5EA">${q.count}x</td>
      </tr>`
    ).join("");

    const dayRows = convByDay.map((d, i) =>
      `<tr style="height:28px;background:${i % 2 === 0 ? "#FFFFFF" : "#F7F8FA"}">
        <td style="font-size:12px;color:#374151;padding:4px 12px;border-bottom:1px solid #E2E5EA">${d.date}</td>
        <td style="font-size:12px;color:#374151;text-align:center;font-weight:600;padding:0 8px;border-bottom:1px solid #E2E5EA">${d.count}</td>
      </tr>`
    ).join("");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><style>body,table,td,th{font-family:Arial,sans-serif}table{border-collapse:collapse}</style></head><body>
<table style="width:700px">
  <tr style="height:40px"><td colspan="3" style="background:#0F1923;color:#FFF;font-size:15px;font-weight:bold;padding:0 18px">FrontdeskReply &middot; Analytics Report</td></tr>
  <tr style="height:22px"><td colspan="3" style="background:#0F1923;color:#6B7280;font-size:10px;padding:0 18px 6px">Period: ${periodLabel} &middot; Exported ${today}</td></tr>
  <tr style="height:10px"><td colspan="3"></td></tr>
  <tr style="height:56px">
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #E8714A;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${summary.total_conversations}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">CONVERSATIONS</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #10B981;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${summary.total_messages}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">MESSAGES</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #3B82F6;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${formatSeconds(summary.avg_response_seconds)}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">AVG RESPONSE</div></td>
  </tr>
  <tr style="height:56px">
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #8B5CF6;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${summary.leads_with_email}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">LEADS CAPTURED</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #06B6D4;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${summary.conversion_rate}%</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">CONVERSION RATE</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #10B981;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${summary.avg_chat_length}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">AVG CHAT LENGTH</div></td>
  </tr>
  <tr style="height:16px"><td colspan="3"></td></tr>
  <tr><td colspan="3" style="font-size:13px;font-weight:700;color:#111827;padding:8px 0">Top Visitor Questions</td></tr>
  <tr style="height:28px;background:#F97316"><th style="color:#FFF;font-size:10px;font-weight:700;width:40px;padding:0 8px">#</th><th style="color:#FFF;font-size:10px;font-weight:700;text-align:left;padding:0 12px">QUESTION</th><th style="color:#FFF;font-size:10px;font-weight:700;width:60px;padding:0 8px">COUNT</th></tr>
  ${questionRows}
  <tr style="height:16px"><td colspan="3"></td></tr>
  <tr><td colspan="3" style="font-size:13px;font-weight:700;color:#111827;padding:8px 0">Conversations by Day</td></tr>
  <tr style="height:28px;background:#F97316"><th colspan="2" style="color:#FFF;font-size:10px;font-weight:700;text-align:left;padding:0 12px">DATE</th><th style="color:#FFF;font-size:10px;font-weight:700;width:80px;padding:0 8px">CONVERSATIONS</th></tr>
  ${dayRows}
  <tr style="height:28px"><td colspan="3" style="background:#F7F8FA;color:#9CA3AF;font-size:10px;font-style:italic;padding:0 14px;border-top:2px solid #E2E5EA">Generated by FrontdeskReply &middot; frontdeskreply.com</td></tr>
</table></body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frontdeskreply-analytics-${period}-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
        <button
          onClick={() => exportAnalytics()}
          disabled={loading || !summary}
          style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: summary ? "linear-gradient(135deg, #f97316, #ea580c)" : "rgba(255,255,255,0.04)",
            border: "none", color: summary ? "#fff" : "var(--text-muted)",
            boxShadow: summary ? "0 2px 6px rgba(249,115,22,0.3)" : "none",
          }}
        >Export Excel</button>
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
          <StatCard label="Leads Captured" value={summary?.leads_with_email ?? 0} sub={`${summary?.conversion_rate ?? 0}% conversion rate`} color="#8b5cf6" icon="📥" />
          <StatCard label="Vela Accuracy" value={`${summary?.accuracy_rate ?? 0}%`} sub="answered from FAQs vs redirected" color="#10b981" icon="🎯" />
          <StatCard label="Phone Calls" value={summary?.total_calls ?? 0} sub={`${summary?.total_call_minutes ?? 0} min total`} color="#8b5cf6" icon="📞" />
          <StatCard label="Avg Call Duration" value={formatSeconds(summary?.avg_call_duration_seconds ?? null)} sub="per phone call" color="#8b5cf6" icon="⏱️" />
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Conversations by Day */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Chat Conversations by Day</div>
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

      {/* Calls by Day */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px", marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Phone Calls by Day</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>Inbound calls per day</div>
        </div>
        {loading ? (
          <div style={{ height: 160, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} className="shimmer" />
        ) : (
          <BarChart data={callsByDay} color="#8b5cf6" label="call" />
        )}
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

      {/* Lead Sources */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px", marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Lead Sources &mdash; How They Found You</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 20 }}>Where your leads are coming from</div>
        {loading ? (
          <div style={{ height: 200, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} className="shimmer" />
        ) : !leadSources || !leadSources.sources || leadSources.sources.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📍</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>No source data yet</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Vela asks callers how they heard about you &mdash; data will appear after calls.</div>
          </div>
        ) : (
          <LeadSourceChart data={leadSources} />
        )}
      </div>

      {/* Conversion Funnel */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px", marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Conversion Funnel</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 20 }}>How leads progress through your pipeline</div>
        {loading ? (
          <div style={{ height: 200, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} className="shimmer" />
        ) : !funnelData || !funnelData.funnel || funnelData.funnel.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔽</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>No funnel data yet</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Start capturing leads to see your conversion pipeline.</div>
          </div>
        ) : (
          <ConversionFunnel data={funnelData} />
        )}
      </div>

      {/* Peak Hours Heatmap */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px", marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Peak Activity Hours</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 20 }}>When your chats and calls happen most</div>
        {loading ? (
          <div style={{ height: 200, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} className="shimmer" />
        ) : !peakHours || !peakHours.data || peakHours.data.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🕐</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>No activity data yet</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Usage patterns will appear as your chats and calls grow.</div>
          </div>
        ) : (
          <PeakHoursHeatmap data={peakHours} />
        )}
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

/* ── Lead Source Donut Chart ────────────────────────────────────── */
const SOURCE_COLORS: Record<string, string> = {
  instagram: "#E4405F", google: "#4285F4", facebook: "#1877F2",
  friend: "#10b981", website: "#f97316", tiktok: "#000000", other: "#6b7280",
};

function LeadSourceChart({ data }: { data: LeadSourceData }) {
  const total = data.sources.reduce((s, d) => s + d.count, 0) || 1;
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const inner = 36;

  // Build donut segments
  let cumAngle = -Math.PI / 2;
  const segments = data.sources.map(src => {
    const frac = src.count / total;
    const startAngle = cumAngle;
    cumAngle += frac * 2 * Math.PI;
    const endAngle = cumAngle;
    const largeArc = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + inner * Math.cos(endAngle);
    const iy1 = cy + inner * Math.sin(endAngle);
    const ix2 = cx + inner * Math.cos(startAngle);
    const iy2 = cy + inner * Math.sin(startAngle);
    const color = SOURCE_COLORS[src.source.toLowerCase()] || SOURCE_COLORS.other;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
    return { d, color, source: src.source, count: src.count };
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
        {/* Donut SVG */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          {segments.map((seg, i) => (
            <path key={i} d={seg.d} fill={seg.color} opacity={0.85} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="20" fontWeight="700">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="10">total</text>
        </svg>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.sources.map(src => {
            const color = SOURCE_COLORS[src.source.toLowerCase()] || SOURCE_COLORS.other;
            return (
              <div key={src.source} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, textTransform: "capitalize" }}>{src.source}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>{src.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Channel breakdown badges */}
      {data.channel_breakdown && (
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <div style={{
            padding: "6px 14px", borderRadius: 8,
            background: "rgba(232,113,74,0.1)", border: "1px solid rgba(232,113,74,0.2)",
            fontSize: 12, fontWeight: 600, color: "#E8714A",
          }}>
            Chat: {data.channel_breakdown.chat}
          </div>
          <div style={{
            padding: "6px 14px", borderRadius: 8,
            background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)",
            fontSize: 12, fontWeight: 600, color: "#8b5cf6",
          }}>
            Phone: {data.channel_breakdown.phone}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Conversion Funnel ──────────────────────────────────────────── */
function ConversionFunnel({ data }: { data: FunnelData }) {
  const stages = data.funnel;
  const maxCount = stages.length > 0 ? Math.max(...stages.map(s => s.count), 1) : 1;

  // Gradient from blue to green
  const colorStops = stages.map((_, i) => {
    const t = stages.length > 1 ? i / (stages.length - 1) : 0;
    // Interpolate #3b82f6 -> #10b981
    const r = Math.round(59 + t * (16 - 59));
    const g = Math.round(130 + t * (185 - 130));
    const b = Math.round(246 + t * (129 - 246));
    return `rgb(${r},${g},${b})`;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.count / maxCount) * 100, 12);
        const color = colorStops[i];
        const prevCount = i > 0 ? stages[i - 1].count : null;
        const dropPct = prevCount && prevCount > 0
          ? Math.round(((prevCount - stage.count) / prevCount) * 100)
          : null;

        return (
          <div key={i}>
            {/* Drop indicator between stages */}
            {dropPct !== null && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
                  ▼ {dropPct}% drop
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
                minWidth: 110, textAlign: "right",
              }}>
                {stage.stage}
              </span>
              <div style={{ flex: 1, position: "relative" }}>
                <div style={{
                  height: 32, borderRadius: 6,
                  width: `${widthPct}%`,
                  background: color, opacity: 0.8,
                  transition: "width 0.5s ease",
                  display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10,
                  margin: "0 auto 0 0",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "'Geist Mono', monospace" }}>
                    {stage.count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Peak Hours Heatmap ─────────────────────────────────────────── */
const HOUR_LABELS: { hour: number; label: string }[] = [
  { hour: 6, label: "6am" }, { hour: 9, label: "9am" }, { hour: 12, label: "12pm" },
  { hour: 15, label: "3pm" }, { hour: 18, label: "6pm" }, { hour: 21, label: "9pm" },
];
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS_RANGE = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22

function PeakHoursHeatmap({ data }: { data: PeakHoursData }) {
  const maxCount = data.max_count || 1;

  // Build lookup: "Day-Hour" -> count
  const lookup: Record<string, number> = {};
  data.data.forEach(c => {
    // Normalize day name to 3-char
    const dayShort = c.day.slice(0, 3);
    lookup[`${dayShort}-${c.hour}`] = c.count;
  });

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Hour labels row */}
      <div style={{ display: "flex", marginLeft: 44, marginBottom: 4, gap: 0 }}>
        {HOURS_RANGE.map(h => {
          const lbl = HOUR_LABELS.find(l => l.hour === h);
          return (
            <div key={h} style={{
              flex: 1, minWidth: 0, textAlign: "center",
              fontSize: 9.5, color: "var(--text-muted)",
              fontFamily: "'Geist Mono', monospace",
            }}>
              {lbl ? lbl.label : ""}
            </div>
          );
        })}
      </div>

      {/* Grid rows */}
      {DAY_ORDER.map(day => (
        <div key={day} style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 2 }}>
          <span style={{
            fontSize: 11, color: "var(--text-muted)", fontWeight: 500,
            width: 40, textAlign: "right", paddingRight: 6, flexShrink: 0,
          }}>
            {day}
          </span>
          {HOURS_RANGE.map(h => {
            const count = lookup[`${day}-${h}`] || 0;
            const intensity = count / maxCount;
            return (
              <div
                key={h}
                title={`${day} ${h}:00 — ${count} activities`}
                style={{
                  flex: 1, minWidth: 0, aspectRatio: "1", maxHeight: 28,
                  margin: 1, borderRadius: 3,
                  background: count > 0
                    ? `rgba(249, 115, 22, ${Math.max(intensity * 0.85, 0.1)})`
                    : "rgba(255,255,255,0.04)",
                  transition: "background 0.3s ease",
                }}
              />
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Less</span>
        {[0.1, 0.3, 0.55, 0.8].map((op, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: `rgba(249, 115, 22, ${op})` }} />
        ))}
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>More</span>
      </div>
    </div>
  );
}
