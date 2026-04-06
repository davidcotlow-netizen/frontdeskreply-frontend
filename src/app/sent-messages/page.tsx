"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Period = "today" | "week" | "month";

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

const INTENT_COLORS: Record<string, string> = {
  emergency: "#ef4444",
  emergency_service: "#ef4444",
  booking_request: "#f97316",
  booking: "#f97316",
  quote_request: "#8b5cf6",
  quote: "#8b5cf6",
  general_inquiry: "#3b82f6",
  inquiry: "#3b82f6",
  faq: "#10b981",
  pricing_question: "#ec4899",
  complaint: "#f43f5e",
  cancellation: "#f59e0b",
  follow_up: "#06b6d4",
  unknown: "#6b7280",
  other: "#6b7280",
};

const INTENT_LABELS: Record<string, string> = {
  emergency: "Emergency",
  emergency_service: "Emergency",
  booking_request: "Booking Request",
  booking: "Booking Request",
  quote_request: "Quote Request",
  quote: "Quote Request",
  general_inquiry: "General Inquiry",
  inquiry: "General Inquiry",
  faq: "FAQ",
  pricing_question: "Pricing",
  complaint: "Complaint",
  cancellation: "Cancellation",
  follow_up: "Follow Up",
  unknown: "Other",
  other: "Other",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SentMessagesPage() {
  const { user } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [period, setPeriod] = useState<Period>("month");
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<"all" | "email" | "sms">("all");
  const [filterAuto, setFilterAuto] = useState<"all" | "auto" | "manual">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/conversations/sent?business_id=${businessId}&period=${period}`)
      .then(r => r.json())
      .then(d => setMessages(d.sent || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [businessId, period]);

  const filtered = messages.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.customer_name.toLowerCase().includes(q) ||
      (m.customer_email || "").toLowerCase().includes(q) ||
      (m.customer_phone || "").includes(q) ||
      m.body_sent.toLowerCase().includes(q) ||
      m.customer_message.toLowerCase().includes(q);
    const matchMethod = filterMethod === "all" || m.send_method === filterMethod;
    const matchAuto = filterAuto === "all" ||
      (filterAuto === "auto" && m.auto_sent) ||
      (filterAuto === "manual" && !m.auto_sent);
    return matchSearch && matchMethod && matchAuto;
  });

  const autoCount = messages.filter(m => m.auto_sent).length;
  const manualCount = messages.filter(m => !m.auto_sent).length;

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
            Sent Messages
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 6, marginBottom: 0 }}>
            Every message sent to your customers — auto and manually approved.
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

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Sent", value: messages.length, color: "var(--accent)", sub: "messages delivered" },
          { label: "Auto-Sent", value: autoCount, color: "#10b981", sub: "no approval needed" },
          { label: "Manually Approved", value: manualCount, color: "#3b82f6", sub: "reviewed by you" },
        ].map(card => (
          <div key={card.label} style={{
            flex: 1, minWidth: 160,
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderTop: `2px solid ${card.color}`, borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by name, email, phone, or message content..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: "9px 14px",
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderRadius: 8, fontSize: 13, color: "var(--text-primary)",
            outline: "none", fontFamily: "inherit",
          }}
        />
        <select
          value={filterMethod}
          onChange={e => setFilterMethod(e.target.value as any)}
          style={{
            padding: "9px 12px", background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)", borderRadius: 8,
            fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
            outline: "none", fontFamily: "inherit",
          }}
        >
          <option value="all">All channels</option>
          <option value="email">Email only</option>
          <option value="sms">SMS only</option>
        </select>
        <select
          value={filterAuto}
          onChange={e => setFilterAuto(e.target.value as any)}
          style={{
            padding: "9px 12px", background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)", borderRadius: 8,
            fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
            outline: "none", fontFamily: "inherit",
          }}
        >
          <option value="all">Auto + Manual</option>
          <option value="auto">Auto-sent only</option>
          <option value="manual">Manual only</option>
        </select>
      </div>

      {/* Message list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 80, borderRadius: 12, background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: 12, padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
            {search ? "No messages match your search" : "No messages sent yet"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {search ? "Try a different search term." : "Sent messages will appear here once customers start reaching out."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(msg => {
            const isOpen = expanded === msg.id;
            const intentColor = INTENT_COLORS[msg.intent] || "#6b7280";
            const intentLabel = INTENT_LABELS[msg.intent] || msg.intent;
            const contact = msg.customer_email || msg.customer_phone || "No contact info";

            return (
              <div
                key={msg.id}
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                  borderRadius: 12, overflow: "hidden",
                  borderLeft: `3px solid ${msg.auto_sent ? "#10b981" : "#3b82f6"}`,
                  transition: "border-color 0.15s",
                }}
              >
                {/* Row header */}
                <div
                  onClick={() => setExpanded(isOpen ? null : msg.id)}
                  style={{
                    padding: "14px 18px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(249,115,22,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 600, color: "var(--accent)",
                  }}>
                    {(msg.customer_name || "?")[0].toUpperCase()}
                  </div>

                  {/* Name + contact */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                      {msg.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{contact}</div>
                  </div>

                  {/* Preview of sent message */}
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <div style={{
                      fontSize: 12.5, color: "var(--text-secondary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      maxWidth: 320,
                    }}>
                      {msg.body_sent}
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                      background: `${intentColor}18`, color: intentColor,
                      border: `1px solid ${intentColor}30`,
                    }}>{intentLabel}</span>

                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                      background: msg.auto_sent ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)",
                      color: msg.auto_sent ? "#10b981" : "#3b82f6",
                    }}>
                      {msg.auto_sent ? "Auto" : "Approved"}
                    </span>

                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 6,
                      background: "rgba(255,255,255,0.04)", color: "var(--text-muted)",
                    }}>
                      {msg.send_method === "email" ? "✉️ Email" : "💬 SMS"}
                    </span>

                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>
                      {timeAgo(msg.sent_at)}
                    </span>

                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{
                    borderTop: "1px solid var(--border-subtle)",
                    padding: "18px 18px 18px 68px",
                    display: "flex", flexDirection: "column", gap: 16,
                  }}>
                    {/* Customer info */}
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

                    {/* Customer's original message */}
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Customer&apos;s Message
                      </div>
                      <div style={{
                        padding: "10px 14px", background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border-subtle)", borderRadius: 8,
                        fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
                      }}>
                        &ldquo;{msg.customer_message}&rdquo;
                      </div>
                    </div>

                    {/* AI response sent */}
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Response Sent {msg.auto_sent ? "(Auto-sent by AI)" : "(Manually approved)"}
                      </div>
                      <div style={{
                        padding: "12px 14px",
                        background: msg.auto_sent ? "rgba(16,185,129,0.06)" : "rgba(59,130,246,0.06)",
                        border: `1px solid ${msg.auto_sent ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)"}`,
                        borderRadius: 8,
                        fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
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
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Showing {filtered.length} of {messages.length} messages
        </div>
      )}
    </div>
  );
}
