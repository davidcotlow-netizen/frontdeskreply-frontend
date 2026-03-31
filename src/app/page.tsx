"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { getDashboardSummary, getQueue } from "@/lib/api";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name: string): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`(.*?)`/g, "$1");
}

function formatResponseTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
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

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [summary, setSummary] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!isLoaded) return;
    if (!silent) setRefreshing(true);
    try {
      const [s, q] = await Promise.all([
        getDashboardSummary(businessId),
        getQueue(businessId),
      ]);
      setSummary(s);
      setQueue(q.items || []);
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

  const urgentCount = queue.filter((i) => i.priority === "urgent").length;
  const pendingCount = queue.length;
  const firstName = user?.firstName || "";

  const statusMessage = loading
    ? "Loading your dashboard..."
    : pendingCount === 0
    ? "You're all caught up — no messages waiting."
    : urgentCount > 0
    ? `${urgentCount} urgent message${urgentCount > 1 ? "s" : ""} need your attention.`
    : `${pendingCount} message${pendingCount > 1 ? "s" : ""} waiting for your review.`;

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
          <p style={{ fontSize: "13.5px", color: urgentCount > 0 ? "#f87171" : "var(--text-secondary)", letterSpacing: "-0.01em" }}>
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
            <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "500", letterSpacing: "0.01em" }}>AI Active</span>
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
        <StatCard label="Avg Response"
          value={loading ? null : (summary?.avg_first_response_seconds ? formatResponseTime(summary.avg_first_response_seconds) : "—")}
          sub="vs 4 min industry avg" accent="green" delay="fade-in-2" isString
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" opacity="0.7"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/></svg>}
        />
        <StatCard label="Auto-Handled" value={loading ? null : (summary?.auto_handled_count ?? 0)}
          sub={summary?.new_leads > 0 ? `${Math.round((summary.auto_handled_count / summary.new_leads) * 100)}% automation` : "automation rate"}
          accent="blue" delay="fade-in-3"
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0111.3-2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/><path d="M14 8a6 6 0 01-11.3 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/></svg>}
        />
        <StatCard label="Urgent Now" value={loading ? null : urgentCount}
          sub={urgentCount > 0 ? "Needs immediate action" : "All clear"}
          accent={urgentCount > 0 ? "red" : "orange"} delay="fade-in-4" urgent={urgentCount > 0}
          icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 13h14L8 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.7"/><path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/></svg>}
        />
      </div>

      {/* Queue */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Approval Queue
            </h2>
            {queue.length > 0 && (
              <span style={{ background: "var(--accent)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", lineHeight: 1.6 }}>
                {queue.length}
              </span>
            )}
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
            Updated {timeAgo(lastRefresh.toISOString())} · auto-refresh 15s
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2].map((i) => (
              <div key={i} className="shimmer" style={{ height: "160px", borderRadius: "14px" }} />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "52px 24px", textAlign: "center" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "18px" }}>✓</div>
            <div style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "4px" }}>Queue is empty — all caught up.</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>New messages will appear here automatically.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {queue.map((item, idx) => (
              <QueueCard key={item.id} item={item} onAction={load} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, delay, icon, isString, urgent }: {
  label: string; value: any; sub?: string; accent: string; delay: string;
  icon?: React.ReactNode; isString?: boolean; urgent?: boolean;
}) {
  const numValue = typeof value === "number" ? value : 0;
  const animated = useCountUp(!isString && value !== null ? numValue : 0, 700);
  const displayValue = isString ? value : (value === null ? "—" : animated);
  const accentColor = accent === "green" ? "var(--green)" : accent === "blue" ? "var(--blue)" : accent === "red" ? "var(--red)" : "var(--accent)";
  const accentDim = accent === "green" ? "var(--green-dim)" : accent === "blue" ? "var(--blue-dim)" : accent === "red" ? "var(--red-dim)" : "var(--accent-dim)";

  return (
    <div className={`stat-card accent-${accent} ${delay}`} style={{ ...(urgent ? { borderColor: "rgba(239,68,68,0.3)" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ color: accentColor, background: accentDim, padding: "5px", borderRadius: "6px", display: "flex", alignItems: "center" }}>{icon}</span>
      </div>
      <div className="count-up" style={{ fontSize: "32px", fontWeight: "600", color: accentColor, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "8px", fontFamily: "'DM Serif Display', Georgia, serif" }}>
        {displayValue}
      </div>
      {sub && <div style={{ fontSize: "11.5px", color: urgent ? "rgba(239,68,68,0.7)" : "var(--text-muted)", letterSpacing: "-0.01em" }}>{sub}</div>}
    </div>
  );
}

function QueueCard({ item, onAction, index }: { item: any; onAction: () => void; index: number }) {
  const message = item.inbound_messages;
  const draft = item.response_drafts;
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(stripMarkdown(draft?.draft_body || ""));
  const [working, setWorking] = useState(false);
  const [workingAction, setWorkingAction] = useState<string>("");
  const isUrgent = item.priority === "urgent";
  const name = message?.sender_name || "Unknown";
  const intent = (message?.intent || "other") as string;
  const confidence = message?.confidence;
  const channel = message?.channel_type || "web_form";

  const intentClass = intent === "emergency" ? "intent-emergency" : intent === "complaint" ? "intent-complaint" :
    intent === "booking_request" ? "intent-booking" : intent === "quote_request" ? "intent-quote" :
    intent === "faq" ? "intent-faq" : intent === "billing" ? "intent-billing" : "intent-other";

  const avatarColor = intent === "emergency" ? { bg: "rgba(239,68,68,0.15)", text: "#f87171" } :
    intent === "complaint" ? { bg: "rgba(245,158,11,0.15)", text: "#fbbf24" } :
    intent.includes("booking") || intent.includes("quote") ? { bg: "rgba(59,130,246,0.15)", text: "#60a5fa" } :
    { bg: "rgba(255,255,255,0.07)", text: "var(--text-secondary)" };

  async function handleApprove() {
    setWorking(true); setWorkingAction("approve");
    try { const { approveQueueItem } = await import("@/lib/api"); await approveQueueItem(item.id, "staff"); onAction(); }
    finally { setWorking(false); setWorkingAction(""); }
  }
  async function handleEditSend() {
    setWorking(true); setWorkingAction("send");
    try { const { editAndSendQueueItem } = await import("@/lib/api"); await editAndSendQueueItem(item.id, "staff", editedBody); onAction(); }
    finally { setWorking(false); setWorkingAction(""); }
  }
  async function handleDismiss() {
    setWorking(true); setWorkingAction("dismiss");
    try { const { dismissQueueItem } = await import("@/lib/api"); await dismissQueueItem(item.id, "staff"); onAction(); }
    finally { setWorking(false); setWorkingAction(""); }
  }

  const channelLabel = channel === "sms" ? "SMS" : channel === "email" ? "Email" : "Web Form";

  return (
    <div className={`queue-card ${intentClass} ${isUrgent ? "urgent-pulse" : ""} fade-in`} style={{ animationDelay: `${index * 0.06}s` }}>
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: avatarColor.bg, color: avatarColor.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "600" }}>
              {initials(name)}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{name}</span>
                <IntentBadge intent={intent} />
                {isUrgent && <span className="badge badge-urgent">Urgent</span>}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>via {channelLabel}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {confidence && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
                {Math.round(confidence * 100)}% conf
              </div>
            )}
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
              {timeAgo(item.queued_at || message?.received_at)}
            </span>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "12px 14px", marginBottom: "12px", marginLeft: "42px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "5px" }}>Customer message</div>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6, letterSpacing: "-0.01em" }}>"{message?.body}"</p>
        </div>

        <div className="draft-area" style={{ marginBottom: "14px", marginLeft: "42px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1.5C3.5 1.5 1.5 3.5 1.5 6S3.5 10.5 6 10.5 10.5 8.5 10.5 6 8.5 1.5 6 1.5z" fill="rgba(59,130,246,0.8)"/><path d="M4.5 6l1 1 2-2" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#60a5fa", letterSpacing: "0.05em", textTransform: "uppercase" }}>AI Draft</span>
            </div>
            {!editing && <button onClick={() => setEditing(true)} style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Edit draft</button>}
          </div>
          {editing ? (
            <textarea style={{ width: "100%", background: "transparent", color: "var(--text-primary)", fontSize: "13.5px", lineHeight: 1.65, resize: "none", outline: "none", fontFamily: "inherit", border: "none" }}
              rows={4} value={editedBody} onChange={(e) => setEditedBody(e.target.value)} autoFocus />
          ) : (
            <p style={{ fontSize: "13.5px", color: "var(--text-primary)", lineHeight: 1.65, letterSpacing: "-0.01em" }}>
              {stripMarkdown(draft?.draft_body || "No draft generated.")}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginLeft: "42px" }}>
          {editing ? (
            <>
              <button className="btn-approve" onClick={handleEditSend} disabled={working}>
                {workingAction === "send" ? "Sending..." : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6l3.5 3.5L11 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> Send Edited Reply</>}
              </button>
              <button className="btn-edit" onClick={() => { setEditing(false); setEditedBody(stripMarkdown(draft?.draft_body || "")); }}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn-approve" onClick={handleApprove} disabled={working}>
                {workingAction === "approve" ? "Sending..." : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6l3.5 3.5L11 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> Approve & Send</>}
              </button>
              <button className="btn-dismiss" onClick={handleDismiss} disabled={working} title="Dismiss">
                {workingAction === "dismiss" ? "..." : "✕"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const cls = intent === "emergency" ? "badge badge-emergency" : intent === "complaint" ? "badge badge-complaint" :
    intent === "booking_request" ? "badge badge-booking" : intent === "quote_request" ? "badge badge-quote" :
    intent === "faq" ? "badge badge-faq" : intent === "billing" ? "badge badge-billing" : "badge badge-other";
  return <span className={cls}>{intent.replace(/_/g, " ")}</span>;
}
