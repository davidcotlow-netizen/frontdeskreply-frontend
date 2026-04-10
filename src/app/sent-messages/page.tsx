"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Period = "today" | "week" | "month";

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

/* ── Helpers ───────────────────────────────────────────────────── */

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

  const [tab, setTab] = useState<"chats" | "calls">("chats");
  const [period, setPeriod] = useState<Period>("month");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "ended">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    setExpanded(null);
    Promise.all([
      fetch(`${API}/conversations/chat-history?business_id=${businessId}&period=${period}`).then(r => r.json()),
      fetch(`${API}/conversations/call-history?business_id=${businessId}&period=${period}`).then(r => r.json()),
    ]).then(([c, cl]) => {
      setChats(c.conversations || []);
      setCalls(cl.calls || []);
    }).catch(() => { setChats([]); setCalls([]); })
      .finally(() => setLoading(false));
  }, [businessId, period]);

  const filtered = chats.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.visitor_name.toLowerCase().includes(q) ||
      c.visitor_email.toLowerCase().includes(q) ||
      c.visitor_phone.includes(q) ||
      c.last_message_preview.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function exportTranscript(chat: ChatConversation) {
    const msgRows = chat.messages.map(m => {
      const time = new Date(m.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const label = m.role === "visitor" ? chat.visitor_name : m.role === "human" ? "You" : "Vela (AI)";
      const bg = m.role === "visitor" ? "#FFF7ED" : m.role === "human" ? "#E8F5E9" : "#F0F4FF";
      const color = m.role === "visitor" ? "#C2410C" : m.role === "human" ? "#1E6E35" : "#1A56DB";
      const align = m.role === "visitor" ? "right" : "left";
      return `<tr><td style="padding:6px 12px;font-size:12px;color:#9CA3AF;width:70px;vertical-align:top;text-align:right;border-bottom:1px solid #F0F0F0">${time}</td><td style="padding:6px 12px;font-size:11px;font-weight:600;color:${color};width:100px;vertical-align:top;border-bottom:1px solid #F0F0F0">${label}</td><td style="padding:8px 14px;font-size:13px;color:#374151;line-height:1.6;background:${bg};border-radius:6px;border-bottom:1px solid #F0F0F0">${m.content.replace(/</g, "&lt;")}</td></tr>`;
    }).join("");

    const html = `<html><head><meta charset="UTF-8"><style>body,table,td{font-family:Arial,sans-serif}table{border-collapse:collapse}</style></head><body>
<table style="width:700px">
  <tr style="height:40px"><td colspan="3" style="background:#0F1923;color:#FFF;font-size:15px;font-weight:bold;padding:0 18px">FrontdeskReply &middot; Chat Transcript</td></tr>
  <tr style="height:22px"><td colspan="3" style="background:#0F1923;color:#6B7280;font-size:10px;padding:0 18px 6px">Exported ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</td></tr>
  <tr style="height:10px"><td colspan="3"></td></tr>
  <tr style="height:48px">
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #E8714A;padding:8px 14px" colspan="1"><div style="font-size:9px;color:#9CA3AF;font-weight:700;margin-bottom:2px">VISITOR</div><div style="font-size:13px;color:#111827;font-weight:600">${chat.visitor_name}</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #3B82F6;padding:8px 14px"><div style="font-size:9px;color:#9CA3AF;font-weight:700;margin-bottom:2px">EMAIL</div><div style="font-size:12px;color:#111827">${chat.visitor_email || "—"}</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #10B981;padding:8px 14px"><div style="font-size:9px;color:#9CA3AF;font-weight:700;margin-bottom:2px">PHONE</div><div style="font-size:12px;color:#111827">${chat.visitor_phone || "—"}</div></td>
  </tr>
  <tr style="height:32px">
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;padding:4px 14px"><div style="font-size:9px;color:#9CA3AF;font-weight:700">STARTED</div><div style="font-size:11px;color:#374151">${formatDate(chat.started_at)}</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;padding:4px 14px"><div style="font-size:9px;color:#9CA3AF;font-weight:700">DURATION</div><div style="font-size:11px;color:#374151">${duration(chat.started_at, chat.ended_at)}</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;padding:4px 14px"><div style="font-size:9px;color:#9CA3AF;font-weight:700">MESSAGES</div><div style="font-size:11px;color:#374151">${chat.message_count}</div></td>
  </tr>
  <tr style="height:14px"><td colspan="3"></td></tr>
  <tr><td colspan="3" style="font-size:12px;font-weight:700;color:#111827;padding:8px 0">Conversation</td></tr>
  ${msgRows}
  <tr style="height:20px"><td colspan="3"></td></tr>
  <tr><td colspan="3" style="background:#F7F8FA;color:#9CA3AF;font-size:10px;font-style:italic;padding:8px 14px;border-top:2px solid #E2E5EA">Generated by FrontdeskReply &middot; frontdeskreply.com</td></tr>
</table></body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-transcript-${chat.visitor_name.replace(/\s+/g, "-").toLowerCase()}-${chat.started_at.slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalMessages = chats.reduce((sum, c) => sum + c.message_count, 0);
  const activeCount = chats.filter(c => c.status === "active").length;

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
            View all chat conversations and phone calls with your customers.
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
        }}>💬 Live Chats ({chats.length})</button>
        <button onClick={() => setTab("calls")} style={{
          padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 600,
          background: tab === "calls" ? "#8b5cf6" : "transparent",
          color: tab === "calls" ? "#fff" : "var(--text-muted)",
        }}>📞 Phone Calls ({calls.length})</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {tab === "chats" ? (
          <>
            <SummaryCard label="Total Conversations" value={chats.length} color="var(--accent)" sub="chat sessions" />
            <SummaryCard label="Total Messages" value={totalMessages} color="#10b981" sub="across all chats" />
            <SummaryCard label="Active Now" value={activeCount} color="#3b82f6" sub="live conversations" />
          </>
        ) : (
          <>
            <SummaryCard label="Total Calls" value={calls.length} color="#8b5cf6" sub="phone calls" />
            <SummaryCard label="Total Minutes" value={Math.round(calls.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0) / 60)} color="#10b981" sub="call minutes" />
            <SummaryCard label="Avg Duration" value={calls.length > 0 ? Math.round(calls.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0) / calls.length) : 0} color="#3b82f6" sub="seconds per call" />
          </>
        )}
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
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
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          style={{
            padding: "9px 12px", background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)", borderRadius: 8,
            fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
            outline: "none", fontFamily: "inherit",
          }}
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
        </select>
      </div>

      {/* Phone Calls list */}
      {tab === "calls" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {calls.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📞</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>No phone calls yet</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Phone calls will appear here when callers reach Vela Voice AI.</div>
            </div>
          ) : calls.map((call: any) => {
            const isOpen = expanded === call.id;
            return (
              <div key={call.id} style={{
                background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                borderRadius: 12, overflow: "hidden", borderLeft: "3px solid #8b5cf6",
              }}>
                <div onClick={() => setExpanded(isOpen ? null : call.id)} style={{
                  padding: "14px 18px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📞</div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{call.caller_phone || "Unknown"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{call.caller_name || "Caller"}</div>
                  </div>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                      {call.last_caller_message || "No transcript"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>
                      {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, "0")}` : "0:00"}
                    </span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>{call.transcript_count || 0} msgs</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>{timeAgo(call.started_at)}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "18px" }}>
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 18, padding: "12px 16px", background: "rgba(139,92,246,0.05)", borderRadius: 10, border: "1px solid rgba(139,92,246,0.12)" }}>
                      {[
                        { label: "Phone", value: call.caller_phone || "Unknown" },
                        { label: "Name", value: call.caller_name || "Caller" },
                        { label: "Started", value: formatDate(call.started_at) },
                        { label: "Duration", value: call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : "N/A" },
                        { label: "Messages", value: String(call.transcript_count || 0) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Call Transcript</div>
                    <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: "12px", background: "rgba(0,0,0,0.15)", borderRadius: 10 }}>
                      {(call.transcripts || []).map((t: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: t.role === "caller" ? "flex-end" : "flex-start" }}>
                          <div style={{
                            maxWidth: "75%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                            ...(t.role === "caller" ? { background: "#8b5cf6", color: "#fff", borderBottomRightRadius: 4 } : { background: "var(--bg-card)", color: "var(--text-primary)", borderBottomLeftRadius: 4 }),
                          }}>
                            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>
                              {t.role === "caller" ? "Caller" : "Vela"} · {new Date(t.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </div>
                            {t.content}
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

      {/* Chat Conversation list */}
      {tab === "chats" && loading ? (
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
          <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
            {search ? "No conversations match your search" : "No conversations yet"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {search ? "Try a different search term." : "Chat conversations will appear here once visitors use the live chat on your website."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(chat => {
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Chat Transcript
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); exportTranscript(chat); }} style={{
                        fontSize: 11, color: "var(--accent)", background: "rgba(249,115,22,0.08)",
                        border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6,
                        padding: "4px 10px", cursor: "pointer", fontWeight: 500,
                      }}>Export .txt</button>
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
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Showing {filtered.length} of {chats.length} conversations
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
