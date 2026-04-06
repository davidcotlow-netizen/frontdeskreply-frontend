"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

type Period = "today" | "week" | "month";

interface Summary {
  new_leads: number;
  avg_first_response_seconds: number | null;
  auto_handled_count: number;
  human_reviewed_count: number;
  urgent_count: number;
  booking_requests_captured: number;
  period: string;
}

interface IntentItem { intent: string; count: number; }
interface ResponseTimeItem { hour: string; avg_seconds: number; }
interface KeywordItem { phrase: string; count: number; }
interface IntentKeywords { intent: string; message_count: number; keywords: KeywordItem[]; }

const INTENT_COLORS: Record<string, string> = {
  emergency:        "#ef4444",
  emergency_service:"#ef4444",
  booking_request:  "#f97316",
  booking:          "#f97316",
  quote_request:    "#8b5cf6",
  quote:            "#8b5cf6",
  general_inquiry:  "#3b82f6",
  inquiry:          "#3b82f6",
  faq:              "#10b981",
  pricing_question: "#ec4899",
  complaint:        "#f43f5e",
  cancellation:     "#f59e0b",
  follow_up:        "#06b6d4",
  unknown:          "#6b7280",
  other:            "#6b7280",
};

const INTENT_LABELS: Record<string, string> = {
  emergency:         "Emergency",
  emergency_service: "Emergency",
  booking_request:   "Booking Request",
  booking:           "Booking Request",
  quote_request:     "Quote Request",
  quote:             "Quote Request",
  general_inquiry:   "General Inquiry",
  inquiry:           "General Inquiry",
  faq:               "FAQ / Question",
  pricing_question:  "Pricing Question",
  complaint:         "Complaint",
  cancellation:      "Cancellation",
  follow_up:         "Follow Up",
  unknown:           "Other",
  other:             "Other",
};

function formatSeconds(s: number | null): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.round(s / 60)}m ${Math.round(s % 60)}s`;
}

function formatHour(h: string): string {
  const d = new Date(h);
  const hr = d.getHours();
  return hr === 0 ? "12am" : hr < 12 ? `${hr}am` : hr === 12 ? "12pm" : `${hr - 12}pm`;
}

function ResponseTimeChart({ data }: { data: ResponseTimeItem[] }) {
  if (!data.length) return (
    <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No response time data yet</span>
    </div>
  );

  const W = 580, H = 160, PAD = { top: 16, right: 24, bottom: 32, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => d.avg_seconds), 30);
  const xScale = (i: number) => PAD.left + (i / (data.length - 1 || 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - (v / (maxVal || 1)) * innerH;
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.avg_seconds)}`).join(" ");
  const areaPoints = [`${PAD.left},${PAD.top + innerH}`, ...data.map((d, i) => `${xScale(i)},${yScale(d.avg_seconds)}`), `${xScale(data.length - 1)},${PAD.top + innerH}`].join(" ");
  const yTicks = [0, Math.round(maxVal / 2), Math.round(maxVal)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map(tick => (
        <g key={tick}>
          <line x1={PAD.left} y1={yScale(tick)} x2={PAD.left + innerW} y2={yScale(tick)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.left - 8} y={yScale(tick) + 4} textAnchor="end" fill="#718096" fontSize="10" fontFamily="Arial">{formatSeconds(tick)}</text>
        </g>
      ))}
      <polygon points={areaPoints} fill="url(#areaGrad)" />
      <polyline points={points} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xScale(i)} cy={yScale(d.avg_seconds)} r="4" fill="#f97316" stroke="#1a1a2e" strokeWidth="2" />
          <text x={xScale(i)} y={H - 4} textAnchor="middle" fill="#718096" fontSize="10" fontFamily="Arial">{formatHour(d.hour)}</text>
        </g>
      ))}
      {(() => {
        const refY = yScale(Math.min(240, maxVal));
        return (
          <g>
            <line x1={PAD.left} y1={refY} x2={PAD.left + innerW} y2={refY} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
            <text x={PAD.left + innerW - 2} y={refY - 4} textAnchor="end" fill="#ef4444" fontSize="9" fontFamily="Arial" opacity="0.7">Industry avg (4 min)</text>
          </g>
        );
      })()}
    </svg>
  );
}

function IntentChart({ data }: { data: IntentItem[] }) {
  if (!data.length) return (
    <div style={{ padding: "40px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No intent data yet</span>
    </div>
  );
  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.map(item => {
        const color = INTENT_COLORS[item.intent] || "#6b7280";
        const label = INTENT_LABELS[item.intent] || item.intent.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const pct = Math.round((item.count / total) * 100);
        return (
          <div key={item.intent}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{pct}%</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, minWidth: 24, textAlign: "right" }}>{item.count}</span>
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(item.count / max) * 100}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent?: string; icon: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderTop: `2px solid ${accent || "var(--accent)"}`, borderRadius: 12, padding: "18px 20px", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── What Customers Are Asking ─────────────────────────────────────────────────
function CustomerInsights({ data, loading }: { data: IntentKeywords[]; loading: boolean }) {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => { setActiveTab(0); }, [data]);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 40, background: "rgba(255,255,255,0.03)", borderRadius: 8, animation: "shimmer 1.5s infinite" }} />
      ))}
    </div>
  );

  if (!data.length) return (
    <div style={{ padding: "48px 0", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No messages yet</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Send some test messages to see keyword insights appear here.</div>
    </div>
  );

  const active = data[activeTab];
  const color = INTENT_COLORS[active?.intent] || "#6b7280";
  const maxCount = Math.max(...(active?.keywords.map(k => k.count) || [1]), 1);

  return (
    <div>
      {/* Intent tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {data.map((group, idx) => {
          const c = INTENT_COLORS[group.intent] || "#6b7280";
          const label = INTENT_LABELS[group.intent] || group.intent.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
          const isActive = idx === activeTab;
          return (
            <button
              key={group.intent}
              onClick={() => setActiveTab(idx)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 14px", borderRadius: 20,
                border: isActive ? `1.5px solid ${c}` : "1px solid var(--border-subtle)",
                background: isActive ? `${c}18` : "transparent",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: isActive ? c : "var(--text-secondary)" }}>{label}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
                background: isActive ? `${c}25` : "rgba(255,255,255,0.06)",
                color: isActive ? c : "var(--text-muted)",
              }}>{group.message_count}</span>
            </button>
          );
        })}
      </div>

      {/* Keyword list for active intent */}
      {active && (
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Top phrases from <strong style={{ color: "var(--text-secondary)" }}>{active.message_count}</strong> {INTENT_LABELS[active.intent] || active.intent} messages
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
            {active.keywords.length === 0 ? (
              <div style={{ gridColumn: "1/-1", fontSize: 13, color: "var(--text-muted)", padding: "16px 0" }}>
                Not enough messages yet to extract keywords — send more test messages.
              </div>
            ) : active.keywords.map((kw, idx) => {
              const barW = (kw.count / maxCount) * 100;
              return (
                <div key={kw.phrase} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", minWidth: 16 }}>#{idx + 1}</span>
                      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, textTransform: "capitalize" }}>{kw.phrase}</span>
                    </div>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, padding: "1px 7px", borderRadius: 8,
                      background: `${color}18`, color: color,
                    }}>{kw.count}x</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barW}%`, background: color, borderRadius: 2, opacity: 0.7, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight callout */}
          {active.keywords.length > 0 && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 10, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text-primary)" }}>Tip:</strong> If "<span style={{ color }}>{active.keywords[0]?.phrase}</span>" appears frequently but isn't addressed in your FAQs, consider adding it. This helps FrontdeskReply auto-respond more accurately.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [period, setPeriod] = useState<Period>("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [intents, setIntents] = useState<IntentItem[]>([]);
  const [responseTime, setResponseTime] = useState<ResponseTimeItem[]>([]);
  const [keywords, setKeywords] = useState<IntentKeywords[]>([]);
  const [loading, setLoading] = useState(true);
  const [keywordsLoading, setKeywordsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [s, i, r] = await Promise.all([
          fetch(`${API_BASE}/analytics/summary?business_id=${businessId}&period=${period}`).then(r => r.json()),
          fetch(`${API_BASE}/analytics/intent-breakdown?business_id=${businessId}&period=${period}`).then(r => r.json()),
          fetch(`${API_BASE}/analytics/response-time?business_id=${businessId}`).then(r => r.json()),
        ]);
        setSummary(s);
        setIntents(i.data || []);
        setResponseTime(r.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [businessId, period]);

  useEffect(() => {
    setKeywordsLoading(true);
    fetch(`${API_BASE}/analytics/top-keywords?business_id=${businessId}&period=${period}`)
      .then(r => r.json())
      .then(d => setKeywords(d.data || []))
      .catch(() => setKeywords([]))
      .finally(() => setKeywordsLoading(false));
  }, [businessId, period]);

  const autoRate = summary
    ? summary.auto_handled_count + summary.human_reviewed_count > 0
      ? Math.round((summary.auto_handled_count / (summary.auto_handled_count + summary.human_reviewed_count)) * 100)
      : 0
    : 0;

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
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>Performance snapshot for your AI receptionist</p>
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
          {[...Array(5)].map((_, i) => <div key={i} style={{ flex: 1, minWidth: 140, height: 100, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12 }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="New Leads" value={String(summary?.new_leads ?? 0)} sub={period === "today" ? "today" : period === "week" ? "this week" : "this month"} accent="#f97316" icon="📥" />
          <StatCard label="Avg Response" value={formatSeconds(summary?.avg_first_response_seconds ?? null)} sub="industry avg: 4 min" accent="#10b981" icon="⚡" />
          <StatCard label="Auto-Handled" value={`${autoRate}%`} sub={`${summary?.auto_handled_count ?? 0} messages`} accent="#3b82f6" icon="🤖" />
          <StatCard label="Urgent" value={String(summary?.urgent_count ?? 0)} sub="flagged for immediate action" accent="#ef4444" icon="🚨" />
          <StatCard label="Bookings Captured" value={String(summary?.booking_requests_captured ?? 0)} sub="booking requests detected" accent="#8b5cf6" icon="📅" />
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px 20px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Response Time</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>Avg AI draft time by hour (seconds)</div>
          </div>
          {loading ? <div style={{ height: 160, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} /> : <ResponseTimeChart data={responseTime} />}
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Message Intent Breakdown</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>What customers are asking about</div>
          </div>
          {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ height: 32, background: "rgba(255,255,255,0.03)", borderRadius: 6 }} />)}</div> : <IntentChart data={intents} />}
        </div>
      </div>

      {/* What Customers Are Asking */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>What Customers Are Asking</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>Top keywords and phrases from real customer messages — by intent</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", padding: "4px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
            {period === "today" ? "Today" : period === "week" ? "Last 7 days" : "Last 30 days"}
          </div>
        </div>
        <CustomerInsights data={keywords} loading={keywordsLoading} />
      </div>

      {/* Performance vs Industry */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Performance vs Industry</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 20 }}>How FrontdeskReply compares to typical home service businesses</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            { label: "First Response Time", yours: formatSeconds(summary?.avg_first_response_seconds ?? null), industry: "4 min", better: summary?.avg_first_response_seconds !== null && (summary?.avg_first_response_seconds ?? 999) < 240 },
            { label: "Lead Response Rate", yours: summary?.new_leads ? "100%" : "—", industry: "~48%", better: true },
            { label: "After-Hours Coverage", yours: "24/7", industry: "None", better: true },
          ].map(row => (
            <div key={row.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>{row.label}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>Your Business</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: row.better ? "#10b981" : "var(--text-primary)", letterSpacing: "-0.02em" }}>{row.yours}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>Industry Avg</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", letterSpacing: "-0.02em" }}>{row.industry}</div>
                </div>
              </div>
              {row.better && (
                <div style={{ marginTop: 12, padding: "4px 10px", background: "rgba(16,185,129,0.1)", borderRadius: 6, fontSize: 11, color: "#10b981", fontWeight: 500, display: "inline-block" }}>↑ Ahead of industry</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
