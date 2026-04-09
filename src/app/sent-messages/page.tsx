"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Period = "today" | "week" | "month";
type Tab = "chats" | "sent";

/* ── Types ─────────────────────────────────────────────────────── */

interface ChatMessage {
  id: string;
  role: "visitor" | "ai" | "human";
  content: string;
  sent_at: string;
  confidence_score: number | null;
}

interface ChatConversation {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  human_active: boolean;
  message_count: number;
  last_message_preview: string;
  messages: ChatMessage[];
}

interface SentMessage {
  id: string;
  sent_at: string;
  auto_sent: boolean;
  send_method: string;
  body_sent: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_message: string;
  intent: string;
  received_at: string;
}

/* ── Helpers ───────────────────────────────────────────────────── */

const INTENT_COLORS: Record<string, string> = {
  emergency: "#ef4444", booking_request: "#f97316", quote_request: "#8b5cf6",
  general_inquiry: "#3b82f6", faq: "#10b981", complaint: "#f43f5e",
  cancellation: "#f59e0b", unknown: "#6b7280",
};
const INTENT_LABELS: Record<string, string> = {
  emergency: "Emergency", booking_request: "Booking", quote_request: "Quote",
  general_inquiry: "Inquiry", faq: "FAQ", complaint: "Complaint",
  cancellation: "Cancellation", unknown: "Other",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function duration(start: string, end: string | null): string {
  if (!end) return "ongoing";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function PastConversationsPage() {
  const { user } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [tab, setTab] = useState<Tab>("chats");
  const [period, setPeriod] = useState<Period>("month");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Chat conversations
  const [chats, setChats] = useState<ChatConversation[]>([]);
  // Sent messages (email/SMS)
  const [sentMsgs, setSentMsgs] = useState<SentMessage[]>([]);

  useEffect(() => {
    setLoading(true);
    setExpanded(null);

    if (tab === "chats") {
      fetch(`${API}/conversations/chat-history?business_id=${businessId}&period=${period}`)
        .then(r => r.json())
        .then(d => setChats(d.conversations || []))
        .catch(() => setChats([]))
        .finally(() => setLoading(false));
    } else {
      fetch(`${API}/conversations/sent?business_id=${businessId}&period=${period}`)
        .then(r => r.json())
        .then(d => setSentMsgs(d.sent || []))
        .catch(() => setSentMsgs([]))
        .finally(() => setLoading(false));
    }
  }, [businessId, period, tab]);

  const filteredChats = chats.filter(c => {
    const q = search.toLowerCase();
    if (!q) return true;
    return c.visitor_name.toLowerCase().includes(q) ||
      c.visitor_email.toLowerCase().includes(q) ||
      c.visitor_phone.includes(q) ||
      c.last_message_preview.toLowerCase().includes(q);
  });

  const filteredSent = sentMsgs.filter(m => {
    const q = search.toLowerCase();
    if (!q) return true;
    return m.customer_name.toLowerCase().includes(q) ||
      (m.customer_email || "").toLowerCase().includes(q) ||
      (m.customer_phone || "").includes(q) ||
      m.body_sent.toLowerCase().includes(q);
  });

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div style={{ padding: "32px 28px", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
            Conversation History
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Past Conversations
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 6, marginBottom: 0 }}>
            View all live chat conversations and sent messages with your customers.
          </p>
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

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        <button onClick={() => setTab("chats")} style={{
          padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 600,
          background: tab === "chats" ? "var(--accent)" : "transparent",
          color: tab === "chats" ? "#fff" : "var(--text-muted)",
          transition: "all 0.15s",
        }}>💬 Live Chats</button>
        <button onClick={() => setTab("sent")} style={{
          padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 600,
          background: tab === "sent" ? "var(--accent)" : "transparent",
          color: tab === "sent" ? "#fff" : "var(--text-muted)",
          transition: "all 0.15s",
        }}>✉️ Sent Messages</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {tab === "chats" ? (
          <>
            <SummaryCard label="Total Chats" value={chats.length} color="var(--accent)" sub="conversations" />
            <SummaryCard label="Total Messages" value={chats.reduce((sum, c) => sum + c.message_count, 0)} color="#10b981" sub="across all chats" />
            <SummaryCard label="Active Now" value={chats.filter(c => c.status === "active").length} color="#3b82f6" sub="live conversations" />
          </>
        ) : (
          <>
            <SummaryCard label="Total Sent" value={sentMsgs.length} color="var(--accent)" sub="messages delivered" />
            <SummaryCard label="Auto-Sent" value={sentMsgs.filter(m => m.auto_sent).length} color="#10b981" sub="no approval needed" />
            <SummaryCard label="Manually Approved" value={sentMsgs.filter(m => !m.auto_sent).length} color="#3b82f6" sub="reviewed by you" />
          </>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name, email, phone, or message content..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "9px 14px",
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderRadius: 8, fontSize: 13, color: "var(--text-primary)",
            outline: "none", fontFamily: "inherit",
          }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 80, borderRadius: 12, background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : tab === "chats" ? (
        /* ── Live Chat Conversations ─────────────────────────────── */
        filteredChats.length === 0 ? (
          <EmptyState icon="💬" title={search ? "No chats match your search" : "No chat conversations yet"} sub={search ? "Try a different search term." : "Chat conversations will appear here once visitors use the live chat widget."} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredChats.map(chat => {
              const isOpen = expanded === chat.id;
              const statusColor = chat.status === "active" ? "#10b981" : chat.status === "escalated" ? "#ef4444" : "#6b7280";

              return (
                <div key={chat.id} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                  borderRadius: 12, overflow: "hidden",
                  borderLeft: `3px solid ${statusColor}`,
                }}>
                  {/* Row header */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : chat.id)}
                    style={{
                      padding: "14px 18px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(249,115,22,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 600, color: "var(--accent)",
                    }}>
                      {(chat.visitor_name || "V")[0].toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                        {chat.visitor_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {chat.visitor_email || chat.visitor_phone || "No contact info"}
                      </div>
                    </div>

                    <div style={{ flex: 2, minWidth: 200 }}>
                      <div style={{
                        fontSize: 12.5, color: "var(--text-secondary)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320,
                      }}>
                        {chat.last_message_preview || "No messages"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                        background: `${statusColor}18`, color: statusColor,
                        border: `1px solid ${statusColor}30`,
                      }}>
                        {chat.status === "active" ? "Active" : chat.status === "escalated" ? "Escalated" : "Ended"}
                      </span>

                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 6,
                        background: "rgba(255,255,255,0.04)", color: "var(--text-muted)",
                      }}>
                        {chat.message_count} msgs
                      </span>

                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>
                        {timeAgo(chat.started_at)}
                      </span>

                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded: contact info + full chat history */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "18px" }}>
                      {/* Contact info bar */}
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 18, padding: "12px 16px", background: "rgba(249,115,22,0.05)", borderRadius: 10, border: "1px solid rgba(249,115,22,0.12)" }}>
                        {[
                          { label: "Name", value: chat.visitor_name },
                          { label: "Email", value: chat.visitor_email || "—" },
                          { label: "Phone", value: chat.visitor_phone || "—" },
                          { label: "Started", value: formatDate(chat.started_at) },
                          { label: "Duration", value: duration(chat.started_at, chat.ended_at) },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Chat transcript */}
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                        Chat Transcript
                      </div>
                      <div style={{
                        maxHeight: 400, overflowY: "auto",
                        display: "flex", flexDirection: "column", gap: 6,
                        padding: "12px", background: "rgba(0,0,0,0.15)", borderRadius: 10,
                      }}>
                        {chat.messages.map(msg => (
                          <div key={msg.id} style={{
                            display: "flex",
                            justifyContent: msg.role === "visitor" ? "flex-end" : "flex-start",
                          }}>
                            <div style={{
                              maxWidth: "75%", padding: "8px 12px", borderRadius: 12,
                              fontSize: 13, lineHeight: 1.5,
                              ...(msg.role === "visitor" ? {
                                background: "var(--accent)", color: "#fff",
                                borderBottomRightRadius: 4,
                              } : msg.role === "human" ? {
                                background: "rgba(16,185,129,0.15)", color: "var(--text-primary)",
                                borderBottomLeftRadius: 4,
                              } : {
                                background: "var(--bg-card)", color: "var(--text-primary)",
                                borderBottomLeftRadius: 4,
                              }),
                            }}>
                              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>
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
        )
      ) : (
        /* ── Sent Messages (email/SMS) ──────────────────────────── */
        filteredSent.length === 0 ? (
          <EmptyState icon="📬" title={search ? "No messages match your search" : "No messages sent yet"} sub={search ? "Try a different search term." : "Sent messages will appear here once customers start reaching out."} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredSent.map(msg => {
              const isOpen = expanded === msg.id;
              const intentColor = INTENT_COLORS[msg.intent] || "#6b7280";
              const intentLabel = INTENT_LABELS[msg.intent] || msg.intent;
              const contact = msg.customer_email || msg.customer_phone || "No contact info";

              return (
                <div key={msg.id} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                  borderRadius: 12, overflow: "hidden",
                  borderLeft: `3px solid ${msg.auto_sent ? "#10b981" : "#3b82f6"}`,
                }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : msg.id)}
                    style={{
                      padding: "14px 18px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(249,115,22,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 600, color: "var(--accent)",
                    }}>
                      {(msg.customer_name || "?")[0].toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{msg.customer_name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{contact}</div>
                    </div>

                    <div style={{ flex: 2, minWidth: 200 }}>
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                        {msg.body_sent}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: `${intentColor}18`, color: intentColor, border: `1px solid ${intentColor}30` }}>{intentLabel}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: msg.auto_sent ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", color: msg.auto_sent ? "#10b981" : "#3b82f6" }}>
                        {msg.auto_sent ? "Auto" : "Approved"}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
                        {msg.send_method === "email" ? "✉️ Email" : "💬 SMS"}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>{timeAgo(msg.sent_at)}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "18px 18px 18px 68px", display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        {[
                          { label: "Customer", value: msg.customer_name },
                          { label: "Email", value: msg.customer_email || "—" },
                          { label: "Phone", value: msg.customer_phone || "—" },
                          { label: "Sent at", value: formatDate(msg.sent_at) },
                          { label: "Received at", value: msg.received_at ? formatDate(msg.received_at) : "—" },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Customer&apos;s Message</div>
                        <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          &ldquo;{msg.customer_message}&rdquo;
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                          Response Sent {msg.auto_sent ? "(Auto-sent by AI)" : "(Manually approved)"}
                        </div>
                        <div style={{
                          padding: "12px 14px",
                          background: msg.auto_sent ? "rgba(16,185,129,0.06)" : "rgba(59,130,246,0.06)",
                          border: `1px solid ${msg.auto_sent ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)"}`,
                          borderRadius: 8, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, whiteSpace: "pre-wrap",
                        }}>
                          {msg.body_sent}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Footer count */}
      {!loading && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Showing {tab === "chats" ? filteredChats.length : filteredSent.length} of {tab === "chats" ? chats.length : sentMsgs.length} {tab === "chats" ? "conversations" : "messages"}
        </div>
      )}
    </div>
  );
}

/* ── Reusable components ───────────────────────────────────────── */

function SummaryCard({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
      borderTop: `2px solid ${color}`, borderRadius: 12, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
      borderRadius: 12, padding: "48px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}
