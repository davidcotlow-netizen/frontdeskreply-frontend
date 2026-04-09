"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatSeconds(s: number | null): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.round(s / 60)}m ${Math.round(s % 60)}s`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function useCountUp(target: number, duration = 600): number {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * ease));
      if (progress < 1) requestAnimationFrame(step);
      else prev.current = target;
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

interface ChatConversation {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  message_count: number;
  last_message_preview: string;
  messages: { id: string; role: string; content: string; sent_at: string }[];
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [summary, setSummary] = useState<any>(null);
  const [recentChats, setRecentChats] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load(silent = false) {
    if (!isLoaded) return;
    if (!silent) setRefreshing(true);
    try {
      const [s, c] = await Promise.all([
        fetch(`${API}/analytics/summary?business_id=${businessId}&period=today`).then(r => r.json()),
        fetch(`${API}/conversations/chat-history?business_id=${businessId}&period=week`).then(r => r.json()),
      ]);
      setSummary(s);
      setRecentChats((c.conversations || []).slice(0, 10));
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    load();
    const interval = setInterval(() => load(true), 15000);
    return () => clearInterval(interval);
  }, [isLoaded, businessId]);

  const firstName = user?.firstName || "";
  const chatCount = summary?.chat_conversations ?? 0;
  const totalMessages = summary?.chat_messages ?? 0;
  const avgLength = chatCount > 0 ? Math.round(totalMessages / chatCount) : 0;
  const activeNow = recentChats.filter(c => c.status === "active").length;

  const statusMessage = loading
    ? "Loading your dashboard..."
    : chatCount === 0
    ? "No conversations yet today — your chatbot is standing by."
    : `${chatCount} conversation${chatCount > 1 ? "s" : ""} today with ${totalMessages} messages exchanged.`;

  return (
    <div style={{ padding: "32px 36px", maxWidth: "1100px" }}>

      {/* Header */}
      <div className="fade-in" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "500", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "6px" }}>
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", letterSpacing: "-0.01em" }}>
            {statusMessage}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {refreshing && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Syncing...</span>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: "7px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "8px", padding: "7px 12px",
          }}>
            <div className="pulse-glow" style={{ width: "7px", height: "7px", background: "#10b981", borderRadius: "50%" }} />
            <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "500", letterSpacing: "0.01em" }}>Chatbot Active</span>
          </div>
          <button
            onClick={() => load()}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
              borderRadius: "8px", padding: "7px 12px",
              fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "32px" }}>
        <StatCard label="New Leads" value={loading ? null : (summary?.new_leads ?? 0)} sub="captured today" accent="orange" delay="fade-in-1"
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1a5 5 0 100 10A5 5 0 008 1zM3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3z" fill="currentColor" opacity="0.7"/></svg>}
        />
        <StatCard label="Conversations" value={loading ? null : chatCount} sub="chat sessions today" accent="blue" delay="fade-in-2"
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 2.5V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" opacity="0.7"/></svg>}
        />
        <StatCard label="Avg Chat Length"
          value={loading ? null : (avgLength > 0 ? `${avgLength} msgs` : "—")}
          sub="messages per conversation" accent="green" delay="fade-in-3" isString
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 7h6M5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/><rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.7"/></svg>}
        />
        <StatCard label="AI Response Time"
          value={loading ? null : formatSeconds(summary?.chat_avg_response_seconds ?? null)}
          sub="avg reply speed" accent="green" delay="fade-in-4" isString
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" opacity="0.7"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/></svg>}
        />
      </div>

      {/* Recent Conversations */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Recent Conversations
            </h2>
            {activeNow > 0 && (
              <span style={{ background: "#10b981", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", lineHeight: 1.6 }}>
                {activeNow} active
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
              Updated {timeAgo(lastRefresh.toISOString())} · auto-refresh 15s
            </div>
            <a href="/sent-messages" style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              View all →
            </a>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" style={{ height: "80px", borderRadius: "14px" }} />
            ))}
          </div>
        ) : recentChats.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "52px 24px", textAlign: "center" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(232,113,74,0.1)", border: "1px solid rgba(232,113,74,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "18px" }}>💬</div>
            <div style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "4px" }}>No conversations yet this week</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>When visitors chat on your website, conversations will appear here.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentChats.map((chat) => {
              const isOpen = expanded === chat.id;
              const statusColor = chat.status === "active" ? "#10b981" : "#6b7280";
              const contact = chat.visitor_email || chat.visitor_phone || "";

              return (
                <div key={chat.id} className="fade-in" style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                  borderRadius: 12, overflow: "hidden",
                  borderLeft: `3px solid ${statusColor}`,
                }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : chat.id)}
                    style={{
                      padding: "14px 18px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 14,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(249,115,22,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 600, color: "var(--accent)",
                    }}>
                      {(chat.visitor_name || "V")[0].toUpperCase()}
                    </div>

                    {/* Name + contact */}
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                        {chat.visitor_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{contact}</div>
                    </div>

                    {/* Preview */}
                    <div style={{ flex: 2, minWidth: 160 }}>
                      <div style={{
                        fontSize: 12.5, color: "var(--text-secondary)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300,
                      }}>
                        {chat.last_message_preview || "No messages"}
                      </div>
                    </div>

                    {/* Meta */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                        background: `${statusColor}18`, color: statusColor,
                        border: `1px solid ${statusColor}30`,
                      }}>
                        {chat.status === "active" ? "Active" : "Ended"}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
                        {chat.message_count} msgs
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", minWidth: 55, textAlign: "right" }}>
                        {timeAgo(chat.started_at)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded transcript */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 18px" }}>
                      {/* Contact bar */}
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: "rgba(249,115,22,0.05)", borderRadius: 8, border: "1px solid rgba(249,115,22,0.1)" }}>
                        {[
                          { label: "Name", value: chat.visitor_name },
                          { label: "Email", value: chat.visitor_email || "—" },
                          { label: "Phone", value: chat.visitor_phone || "—" },
                          { label: "Started", value: new Date(chat.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Messages */}
                      <div style={{
                        maxHeight: 300, overflowY: "auto",
                        display: "flex", flexDirection: "column", gap: 5,
                        padding: "10px", background: "rgba(0,0,0,0.15)", borderRadius: 8,
                      }}>
                        {chat.messages.map(msg => (
                          <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "visitor" ? "flex-end" : "flex-start" }}>
                            <div style={{
                              maxWidth: "75%", padding: "7px 11px", borderRadius: 10,
                              fontSize: 12.5, lineHeight: 1.5,
                              ...(msg.role === "visitor" ? {
                                background: "var(--accent)", color: "#fff", borderBottomRightRadius: 3,
                              } : msg.role === "human" ? {
                                background: "rgba(16,185,129,0.15)", color: "var(--text-primary)", borderBottomLeftRadius: 3,
                              } : {
                                background: "var(--bg-card)", color: "var(--text-primary)", borderBottomLeftRadius: 3,
                              }),
                            }}>
                              <div style={{ fontSize: 9.5, opacity: 0.55, marginBottom: 1 }}>
                                {msg.role === "visitor" ? chat.visitor_name : msg.role === "human" ? "You" : "AI"}
                                {" · "}
                                {new Date(msg.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </div>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent, delay, icon, isString }: {
  label: string; value: any; sub?: string; accent: string; delay: string;
  icon?: React.ReactNode; isString?: boolean;
}) {
  const numValue = typeof value === "number" ? value : 0;
  const animated = useCountUp(!isString && value !== null ? numValue : 0, 700);
  const displayValue = isString ? value : (value === null ? "—" : animated);
  const accentColor = accent === "green" ? "var(--green)" : accent === "blue" ? "var(--blue)" : accent === "red" ? "var(--red)" : "var(--accent)";
  const accentDim = accent === "green" ? "var(--green-dim)" : accent === "blue" ? "var(--blue-dim)" : accent === "red" ? "var(--red-dim)" : "var(--accent-dim)";

  return (
    <div className={`stat-card accent-${accent} ${delay}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ color: accentColor, background: accentDim, padding: "5px", borderRadius: "6px", display: "flex", alignItems: "center" }}>{icon}</span>
      </div>
      <div className="count-up" style={{ fontSize: "32px", fontWeight: "600", color: accentColor, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "8px", fontFamily: "'DM Serif Display', Georgia, serif" }}>
        {displayValue}
      </div>
      {sub && <div style={{ fontSize: "11.5px", color: "var(--text-muted)", letterSpacing: "-0.01em" }}>{sub}</div>}
    </div>
  );
}
