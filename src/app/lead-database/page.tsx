"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  first_contact: string;
  last_contact: string;
  message_count: number;
  top_intent: string;
  intents: string[];
  source: string;
  status: string;
  chat_session_ids: string[];
  call_count: number;
  call_session_ids: string[];
}

interface ChatTranscript {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  message_count: number;
  messages: { id: string; role: string; content: string; sent_at: string }[];
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  new: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6", label: "New" },
  contacted: { bg: "rgba(249,115,22,0.1)", color: "#f97316", label: "Contacted" },
  quoted: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6", label: "Quoted" },
  converted: { bg: "rgba(16,185,129,0.1)", color: "#10b981", label: "Converted" },
};

const INTENT_LABELS: Record<string, string> = {
  emergency: "Emergency",
  emergency_service: "Emergency",
  booking_request: "Booking",
  booking: "Booking",
  quote_request: "Quote",
  quote: "Quote",
  general_inquiry: "Inquiry",
  inquiry: "Inquiry",
  faq: "FAQ",
  pricing_question: "Pricing",
  complaint: "Complaint",
  cancellation: "Cancellation",
  follow_up: "Follow Up",
  unknown: "Other",
  other: "Other",
};

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function exportToXLS(leads: Lead[], businessName: string) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const emailCount = leads.filter(l => l.email).length;
  const phoneCount = leads.filter(l => l.phone).length;
  const thisMonth = leads.filter(l => {
    const d = new Date(l.first_contact);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const accent = "#F97316";
  const darkBg = "#0F1923";
  const lightGray = "#F7F8FA";
  const midGray = "#E2E5EA";

  function intentStyle(intent: string): string {
    const map: Record<string, string> = {
      faq: "background:#E6F4EA;color:#1E6E35",
      general_inquiry: "background:#E6F4EA;color:#1E6E35",
      inquiry: "background:#E6F4EA;color:#1E6E35",
      booking: "background:#FFF7ED;color:#C2410C",
      booking_request: "background:#FFF7ED;color:#C2410C",
      quote: "background:#F5F3FF;color:#6D28D9",
      quote_request: "background:#F5F3FF;color:#6D28D9",
      emergency: "background:#FEF2F2;color:#B91C1C",
      emergency_service: "background:#FEF2F2;color:#B91C1C",
    };
    return map[intent] || "background:#E8F0FE;color:#1A56DB";
  }

  const TD = "white-space:nowrap;overflow:hidden;font-family:Arial,sans-serif;font-size:12px;";
  const BORDER = `border-bottom:1px solid ${midGray};`;

  const rows = leads.map((l, i) => {
    const bg = i % 2 === 0 ? "#FFFFFF" : "#F7F8FA";
    const label = INTENT_LABELS[l.top_intent] || l.top_intent;
    const fmtFirst = formatDate(l.first_contact);
    const fmtLast = formatDate(l.last_contact);
    return `
      <tr style="height:28px;background:${bg}">
        <td style="${TD}${BORDER}text-align:center;color:#9CA3AF;width:36px;padding:0 6px">${i + 1}</td>
        <td style="${TD}${BORDER}font-weight:600;color:#1A1F2E;width:150px;padding:0 12px">${l.name}</td>
        <td style="${TD}${BORDER}color:${l.email ? "#374151" : "#D1D5DB"};width:220px;padding:0 12px">${l.email || "\u2014"}</td>
        <td style="${TD}${BORDER}color:${l.phone ? "#374151" : "#D1D5DB"};width:140px;padding:0 12px">${l.phone || "\u2014"}</td>
        <td style="${TD}${BORDER}text-align:center;color:#6B7280;width:120px;padding:0 8px">${fmtFirst}</td>
        <td style="${TD}${BORDER}text-align:center;color:#6B7280;width:120px;padding:0 8px">${fmtLast}</td>
        <td style="${TD}${BORDER}text-align:center;width:110px;padding:0 8px">
          <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:3px;${intentStyle(l.top_intent)}">${label}</span>
        </td>
      </tr>`;
  }).join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Lead Database</x:Name>
<x:WorksheetOptions>
  <x:DisplayGridlines><x:Value>False</x:Value></x:DisplayGridlines>
  <x:FreezePanes/>
  <x:FrozenNoSplit/>
  <x:SplitHorizontal>6</x:SplitHorizontal>
  <x:TopRowBottomPane>6</x:TopRowBottomPane>
</x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body,table,td,th { font-family: Arial, sans-serif; }
  table { border-collapse: collapse; }
</style>
</head>
<body>
<table style="width:900px">
  <tr style="height:40px">
    <td colspan="7" style="background:${darkBg};color:#FFFFFF;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;padding:0 18px;letter-spacing:0.01em;white-space:nowrap">
      FrontdeskReply &nbsp;&nbsp;&middot;&nbsp;&nbsp; Customer Lead Intelligence Report
    </td>
  </tr>
  <tr style="height:22px">
    <td colspan="7" style="background:${darkBg};color:#6B7280;font-family:Arial,sans-serif;font-size:10px;padding:0 18px 6px;white-space:nowrap">
      Exported ${today} &nbsp;&nbsp;&middot;&nbsp;&nbsp; All time &nbsp;&nbsp;&middot;&nbsp;&nbsp; Confidential
    </td>
  </tr>
  <tr style="height:56px">
    <td colspan="2" style="background:${lightGray};border:1px solid ${midGray};border-left:4px solid ${accent};text-align:center;vertical-align:middle;font-family:Arial,sans-serif;padding:6px 8px">
      <div style="font-size:26px;font-weight:700;color:#111827;line-height:1.1">${leads.length}</div>
      <div style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:0.08em;margin-top:4px">TOTAL LEADS</div>
    </td>
    <td colspan="2" style="background:${lightGray};border:1px solid ${midGray};border-left:4px solid #10B981;text-align:center;vertical-align:middle;font-family:Arial,sans-serif;padding:6px 8px">
      <div style="font-size:26px;font-weight:700;color:#111827;line-height:1.1">${emailCount}</div>
      <div style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:0.08em;margin-top:4px">HAVE EMAIL</div>
    </td>
    <td style="background:${lightGray};border:1px solid ${midGray};border-left:4px solid #3B82F6;text-align:center;vertical-align:middle;font-family:Arial,sans-serif;padding:6px 8px">
      <div style="font-size:26px;font-weight:700;color:#111827;line-height:1.1">${phoneCount}</div>
      <div style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:0.08em;margin-top:4px">HAVE PHONE</div>
    </td>
    <td colspan="2" style="background:${lightGray};border:1px solid ${midGray};border-left:4px solid #8B5CF6;text-align:center;vertical-align:middle;font-family:Arial,sans-serif;padding:6px 8px">
      <div style="font-size:26px;font-weight:700;color:#111827;line-height:1.1">${thisMonth}</div>
      <div style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:0.08em;margin-top:4px">NEW THIS MONTH</div>
    </td>
  </tr>
  <tr style="height:10px"><td colspan="7" style="background:#FFFFFF;border:none"></td></tr>
  <tr style="height:32px;background:${accent}">
    <th style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:0 6px;text-align:center;width:36px;white-space:nowrap;letter-spacing:0.06em">#</th>
    <th style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:0 12px;text-align:left;width:150px;white-space:nowrap;letter-spacing:0.06em">CUSTOMER NAME</th>
    <th style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:0 12px;text-align:left;width:220px;white-space:nowrap;letter-spacing:0.06em">EMAIL ADDRESS</th>
    <th style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:0 12px;text-align:left;width:140px;white-space:nowrap;letter-spacing:0.06em">PHONE NUMBER</th>
    <th style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:0 8px;text-align:center;width:120px;white-space:nowrap;letter-spacing:0.06em">FIRST CONTACT</th>
    <th style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:0 8px;text-align:center;width:120px;white-space:nowrap;letter-spacing:0.06em">LAST CONTACT</th>
    <th style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:0 8px;text-align:center;width:110px;white-space:nowrap;letter-spacing:0.06em">PRIMARY INQUIRY</th>
  </tr>
  ${rows}
  <tr style="height:28px">
    <td colspan="7" style="background:${lightGray};color:#9CA3AF;font-family:Arial,sans-serif;font-size:10px;font-style:italic;padding:0 14px;border-top:2px solid ${midGray};white-space:nowrap;vertical-align:middle">
      Showing ${leads.length} of ${leads.length} leads &nbsp;&middot;&nbsp; All time
    </td>
  </tr>
</table>
</body></html>`;

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${businessName.toLowerCase().replace(/\s+/g, "-")}-leads-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

type SortField = "name" | "last_contact" | "first_contact" | "message_count";
type SortDir = "asc" | "desc";

export default function LeadDatabasePage() {
  const { user } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;
  const businessName = (user?.publicMetadata?.business_name as string) || "Business";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState("starter");
  const [search, setSearch] = useState("");
  const [filterIntent, setFilterIntent] = useState("all");
  const [sortField, setSortField] = useState<SortField>("last_contact");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [leadChats, setLeadChats] = useState<Record<string, ChatTranscript[]>>({});
  const [loadingChats, setLoadingChats] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Selection + email
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [copied, setCopied] = useState(false);
  const [leadNotes, setLeadNotes] = useState<Record<string, { id: string; note: string; created_at: string }[]>>({});
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState<string | null>(null);

  const EMAIL_TEMPLATES = [
    { name: "Follow-Up", subject: "Following up on your inquiry", body: "Hi there,\n\nThank you for reaching out to us! I wanted to follow up on your recent conversation and see if you had any additional questions.\n\nWe'd love to help you get started. Feel free to reply to this email or give us a call anytime.\n\nLooking forward to hearing from you!" },
    { name: "New Sessions", subject: "New sessions available — book your spot!", body: "Hi there,\n\nGreat news! We have new sessions available and spots are filling up fast.\n\nHead over to our website to learn more and secure your spot. Don't miss out!\n\nSee you soon!" },
    { name: "Thank You", subject: "Thank you for chatting with us!", body: "Hi there,\n\nThank you for taking the time to chat with us! We really appreciate your interest.\n\nIf you have any more questions, don't hesitate to reach out. We're always here to help.\n\nWarm regards!" },
  ];

  async function loadNotes(leadId: string) {
    if (leadNotes[leadId]) return;
    setLoadingNotes(leadId);
    try {
      const res = await fetch(`${API}/conversations/leads/${leadId}/notes`);
      const data = await res.json();
      setLeadNotes(prev => ({ ...prev, [leadId]: data.notes || [] }));
    } catch (e) { console.error(e); }
    finally { setLoadingNotes(null); }
  }

  async function saveNote(leadId: string) {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await fetch(`${API}/conversations/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote.trim(), user_id: "owner" }),
      });
      setLeadNotes(prev => ({
        ...prev,
        [leadId]: [{ id: Date.now().toString(), note: newNote.trim(), created_at: new Date().toISOString() }, ...(prev[leadId] || [])],
      }));
      setNewNote("");
    } catch (e) { console.error(e); }
    finally { setSavingNote(false); }
  }

  function getLeadQuality(lead: any): { label: string; color: string; bg: string } {
    const callCount = lead.call_count || 0;
    // Hot: gave phone + email + multiple messages OR 2+ calls
    if ((lead.email && lead.phone && lead.message_count >= 4) || callCount >= 2)
      return { label: "Hot", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
    // Warm: gave email + 2+ messages OR 1 call
    if ((lead.email && lead.message_count >= 2) || callCount >= 1)
      return { label: "Warm", color: "#f97316", bg: "rgba(249,115,22,0.1)" };
    // Cold: single message or no email
    return { label: "Cold", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
  }

  function getSourceBadge(lead: any): string {
    const src = lead.source || "unknown";
    if (src === "multi") return "💬📞 Chat + Call";
    if (src === "phone_call") return "📞 Phone Call";
    if (src === "live_chat") return "💬 Live Chat";
    if (src === "web_form") return "📝 Form";
    return "Unknown";
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  }

  function getSelectedEmails(): string[] {
    return filtered.filter(l => selected.has(l.id) && l.email).map(l => l.email!);
  }

  function copyEmails() {
    const emails = getSelectedEmails();
    if (!emails.length) return;
    navigator.clipboard.writeText(emails.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendBulkEmail() {
    const emails = getSelectedEmails();
    if (!emails.length || !emailSubject || !emailBody) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API}/conversations/leads/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, subject: emailSubject, message: emailBody, business_id: businessId }),
      });
      const data = await res.json();
      setSendResult({ sent: data.sent || 0, failed: data.failed || 0 });
      // Mark sent leads as "contacted"
      for (const lead of filtered.filter(l => selected.has(l.id) && l.email)) {
        updateLeadStatus(lead.id, "contacted");
      }
    } catch (e) {
      setSendResult({ sent: 0, failed: getSelectedEmails().length });
    } finally {
      setSending(false);
    }
  }

  async function updateLeadStatus(leadId: string, status: string) {
    setUpdatingStatus(leadId);
    try {
      await fetch(`${API}/conversations/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setLeads(leads.map(l => l.id === leadId ? { ...l, status } : l));
    } catch (e) { console.error(e); }
    finally { setUpdatingStatus(null); }
  }

  async function loadLeadChats(leadId: string) {
    if (leadChats[leadId]) return; // already loaded
    setLoadingChats(leadId);
    try {
      const res = await fetch(`${API}/conversations/leads/${leadId}/chats`);
      const data = await res.json();
      setLeadChats(prev => ({ ...prev, [leadId]: data.sessions || [] }));
    } catch (e) { console.error(e); }
    finally { setLoadingChats(null); }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/conversations/leads?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/billing/plan?business_id=${businessId}`).then(r => r.json()),
    ]).then(([d, plan]) => {
      setLeads(d.leads || []);
      if (plan?.plan_tier) setCurrentPlan(plan.plan_tier);
    }).catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [businessId]);

  const intents = useMemo(() => {
    const set = new Set(leads.map(l => l.top_intent).filter(Boolean));
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads.filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        l.name.toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q);
      const matchIntent = filterIntent === "all" || l.top_intent === filterIntent;
      const matchDateFrom = !dateFrom || l.first_contact >= dateFrom;
      const matchDateTo = !dateTo || l.first_contact <= dateTo + "T23:59:59";
      return matchSearch && matchIntent && matchDateFrom && matchDateTo;
    });

    result.sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "name") { av = a.name; bv = b.name; }
      else if (sortField === "message_count") { av = a.message_count; bv = b.message_count; }
      else if (sortField === "first_contact") { av = new Date(a.first_contact).getTime(); bv = new Date(b.first_contact).getTime(); }
      else { av = new Date(a.last_contact).getTime(); bv = new Date(b.last_contact).getTime(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, search, filterIntent, sortField, sortDir, dateFrom, dateTo]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span style={{ color: "var(--text-muted)", fontSize: 10 }}>↕</span>;
    return <span style={{ color: "var(--accent)", fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const emailCount = leads.filter(l => l.email).length;
  const phoneCount = leads.filter(l => l.phone).length;
  const thisMonth = leads.filter(l => {
    const d = new Date(l.first_contact);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1040, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
            Customer Intelligence
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
            Lead Database
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 6, marginBottom: 0 }}>
            Every customer who has ever contacted your business — all time.
          </p>
        </div>
        {currentPlan !== "starter" && (
          <button
            onClick={() => exportToXLS(filtered, businessName)}
            disabled={filtered.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px",
              background: filtered.length === 0 ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #f97316, #ea580c)",
              border: "none", borderRadius: 9, cursor: filtered.length === 0 ? "not-allowed" : "pointer",
              fontSize: 13.5, fontWeight: 600, color: filtered.length === 0 ? "var(--text-muted)" : "#fff",
              boxShadow: filtered.length === 0 ? "none" : "0 2px 8px rgba(249,115,22,0.3)",
              transition: "all 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Export Excel ({filtered.length})
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Leads", value: leads.length, color: "var(--accent)", sub: "unique contacts" },
          { label: "Have Email", value: emailCount, color: "#10b981", sub: "can receive email" },
          { label: "Have Phone", value: phoneCount, color: "#3b82f6", sub: "can receive SMS" },
          { label: "New This Month", value: thisMonth, color: "#8b5cf6", sub: "first contact" },
        ].map(card => (
          <div key={card.label} style={{
            flex: 1, minWidth: 140,
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
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: "9px 14px",
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderRadius: 8, fontSize: 13, color: "var(--text-primary)",
            outline: "none", fontFamily: "inherit",
          }}
        />
        <select
          value={filterIntent}
          onChange={e => setFilterIntent(e.target.value)}
          style={{
            padding: "9px 12px", background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)", borderRadius: 8,
            fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
            outline: "none", fontFamily: "inherit",
          }}
        >
          <option value="all">All inquiry types</option>
          {intents.map(i => (
            <option key={i} value={i}>{INTENT_LABELS[i] || i}</option>
          ))}
        </select>
      </div>

      {/* Date range + actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>From:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 7, fontSize: 12, color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>To:</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 7, fontSize: 12, color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear dates</button>
        )}

        <div style={{ flex: 1 }} />

        {selected.size > 0 && currentPlan !== "starter" && (
          <>
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{selected.size} selected</span>
            <button onClick={copyEmails} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
              {copied ? "✓ Copied!" : `Copy ${getSelectedEmails().length} emails`}
            </button>
            <button onClick={() => { setShowEmailModal(true); setSendResult(null); setEmailSubject(""); setEmailBody(""); }} disabled={getSelectedEmails().length === 0} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", color: "#fff", opacity: getSelectedEmails().length === 0 ? 0.5 : 1 }}>
              ✉️ Email {getSelectedEmails().length} leads
            </button>
          </>
        )}
      </div>

      {/* Email compose modal */}
      {showEmailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => !sending && setShowEmailModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 24, width: 520, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Email {getSelectedEmails().length} Leads</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
              Send a branded email via FrontdeskReply to your selected leads. Each lead receives an individual email.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>To</label>
              <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", maxHeight: 60, overflowY: "auto", lineHeight: 1.6 }}>
                {getSelectedEmails().join(", ")}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Quick Templates</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {EMAIL_TEMPLATES.map(t => (
                  <button key={t.name} onClick={() => { setEmailSubject(t.subject); setEmailBody(t.body); }} style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer",
                    background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "var(--accent)",
                  }}>{t.name}</button>
                ))}
              </div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Subject</label>
              <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="e.g. New sessions available — book your spot!" style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Message</label>
              <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Write your message here..." rows={6} style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            </div>

            {sendResult && (
              <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, background: sendResult.failed === 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${sendResult.failed === 0 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, fontSize: 13, color: sendResult.failed === 0 ? "#10b981" : "#ef4444" }}>
                {sendResult.failed === 0 ? `✅ Successfully sent to ${sendResult.sent} leads!` : `Sent ${sendResult.sent}, failed ${sendResult.failed}`}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowEmailModal(false)} disabled={sending} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                {sendResult ? "Close" : "Cancel"}
              </button>
              {!sendResult && (
                <button onClick={sendBulkEmail} disabled={sending || !emailSubject || !emailBody} style={{ padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: !emailSubject || !emailBody ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #f97316, #ea580c)", border: "none", cursor: !emailSubject || !emailBody ? "not-allowed" : "pointer", boxShadow: emailSubject && emailBody ? "0 2px 6px rgba(249,115,22,0.3)" : "none" }}>
                  {sending ? "Sending..." : `Send to ${getSelectedEmails().length} leads`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 60, borderRadius: 10, background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: 12, padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
            {search ? "No leads match your search" : "No leads yet"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Leads appear here as customers contact you through the widget.
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "32px 2fr 2fr 1.2fr 1fr 1fr 1.2fr",
            padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)",
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ cursor: "pointer", accentColor: "var(--accent)" }} />
            </div>
            {[
              { label: "Customer", field: "name" as SortField },
              { label: "Contact Info", field: null },
              { label: "Inquiry Type", field: null },
              { label: "Messages", field: "message_count" as SortField },
              { label: "First Contact", field: "first_contact" as SortField },
              { label: "Last Contact", field: "last_contact" as SortField },
            ].map(col => (
              <div
                key={col.label}
                onClick={() => col.field && toggleSort(col.field)}
                style={{
                  fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  cursor: col.field ? "pointer" : "default",
                  display: "flex", alignItems: "center", gap: 4,
                  userSelect: "none",
                }}
              >
                {col.label}
                {col.field && <SortIcon field={col.field} />}
              </div>
            ))}
          </div>

          {filtered.map((lead, idx) => {
            const isOpen = expanded === lead.id;
            const intentColor = INTENT_COLORS[lead.top_intent] || "#6b7280";
            const intentLabel = INTENT_LABELS[lead.top_intent] || lead.top_intent;

            return (
              <div key={lead.id}>
                <div
                  onClick={() => setExpanded(isOpen ? null : lead.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "32px 2fr 2fr 1.2fr 1fr 1fr 1.2fr",
                    padding: "14px 18px", cursor: "pointer",
                    borderBottom: idx < filtered.length - 1 || isOpen ? "1px solid var(--border-subtle)" : "none",
                    background: isOpen ? "rgba(249,115,22,0.04)" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} style={{ cursor: "pointer", accentColor: "var(--accent)" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(249,115,22,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 600, color: "var(--accent)",
                    }}>
                      {(lead.name || "?")[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>
                      {lead.name}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2, justifyContent: "center" }}>
                    {lead.email && <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>✉️ {lead.email}</span>}
                    {lead.phone && <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>📱 {lead.phone}</span>}
                    {!lead.email && !lead.phone && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No contact info</span>}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                      background: `${intentColor}18`, color: intentColor,
                      border: `1px solid ${intentColor}30`,
                    }}>{intentLabel}</span>
                    {(() => { const q = getLeadQuality(lead); return (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: q.bg, color: q.color, border: `1px solid ${q.color}30` }}>{q.label}</span>
                    ); })()}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{lead.message_count}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>msgs</span>
                    {(lead.call_count || 0) > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>📞 {lead.call_count}</span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{formatDate(lead.first_contact)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{timeAgo(lead.last_contact)}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{
                    padding: "16px 18px 18px 18px",
                    borderBottom: idx < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    background: "rgba(249,115,22,0.03)",
                  }}>
                    {/* Contact details row */}
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
                      {[
                        { label: "Full Name", value: lead.name },
                        { label: "Email", value: lead.email || "—" },
                        { label: "Phone", value: lead.phone || "—" },
                        { label: "First Contact", value: formatDate(lead.first_contact) },
                        { label: "Last Contact", value: formatDate(lead.last_contact) },
                        { label: "Messages", value: String(lead.message_count) },
                        { label: "Source", value: getSourceBadge(lead) },
                        { label: "Calls", value: `${lead.call_count || 0} phone calls` },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Lifecycle status — Growth/Pro only */}
                    {currentPlan !== "starter" && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Lead Status</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["new", "contacted", "quoted", "converted"] as const).map(s => {
                          const sc = STATUS_COLORS[s];
                          const isActive = lead.status === s;
                          return (
                            <button
                              key={s}
                              onClick={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, s); }}
                              disabled={updatingStatus === lead.id}
                              style={{
                                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                background: isActive ? sc.bg : "rgba(255,255,255,0.04)",
                                border: isActive ? `1.5px solid ${sc.color}` : "1px solid var(--border-subtle)",
                                color: isActive ? sc.color : "var(--text-muted)",
                                transition: "all 0.15s",
                              }}
                            >{sc.label}</button>
                          );
                        })}
                      </div>
                    </div>
                    )}

                    {/* Internal Notes — Pro only */}
                    {["pro","enterprise"].includes(currentPlan) && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        Internal Notes
                        {!leadNotes[lead.id] && (
                          <button onClick={(e) => { e.stopPropagation(); loadNotes(lead.id); }} style={{ fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}>
                            {loadingNotes === lead.id ? "Loading..." : "Load notes"}
                          </button>
                        )}
                      </div>
                      {leadNotes[lead.id] && (
                        <>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }} onClick={e => e.stopPropagation()}>
                            <input
                              value={newNote} onChange={e => setNewNote(e.target.value)}
                              placeholder="Add a note (e.g., Called Tuesday, following up Friday)..."
                              onKeyDown={e => { if (e.key === "Enter") saveNote(lead.id); }}
                              style={{ flex: 1, padding: "7px 10px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }}
                            />
                            <button onClick={() => saveNote(lead.id)} disabled={savingNote || !newNote.trim()} style={{ padding: "7px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: newNote.trim() ? "var(--accent)" : "rgba(255,255,255,0.06)", color: newNote.trim() ? "#fff" : "var(--text-muted)", border: "none" }}>
                              {savingNote ? "..." : "Save"}
                            </button>
                          </div>
                          {leadNotes[lead.id].length === 0 && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No notes yet. Add your first note above.</div>
                          )}
                          {leadNotes[lead.id].map(n => (
                            <div key={n.id} style={{ padding: "8px 10px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 6, marginBottom: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                              <div style={{ marginBottom: 2 }}>{n.note}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    )}

                    {/* Lead Status — Growth/Pro only */}
                    {currentPlan === "starter" ? null : null}

                    {/* Chat transcripts */}
                    {lead.email && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Chat History</div>
                          {!leadChats[lead.id] && (
                            <button
                              onClick={(e) => { e.stopPropagation(); loadLeadChats(lead.id); }}
                              style={{ fontSize: 11, color: "var(--accent)", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
                            >{loadingChats === lead.id ? "Loading..." : "Load chats"}</button>
                          )}
                        </div>
                        {leadChats[lead.id] && leadChats[lead.id].length === 0 && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No chat transcripts found.</div>
                        )}
                        {leadChats[lead.id] && leadChats[lead.id].map(session => (
                          <div key={session.id} style={{ marginBottom: 10, background: "rgba(0,0,0,0.15)", borderRadius: 8, padding: 10, maxHeight: 200, overflowY: "auto" }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                              {new Date(session.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {session.message_count} msgs
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {session.messages.map(msg => (
                                <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "visitor" ? "flex-end" : "flex-start" }}>
                                  <div style={{
                                    maxWidth: "75%", padding: "6px 10px", borderRadius: 10, fontSize: 12, lineHeight: 1.4,
                                    ...(msg.role === "visitor" ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 3 }
                                      : { background: "var(--bg-card)", color: "var(--text-primary)", borderBottomLeftRadius: 3 }),
                                  }}>
                                    <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 1 }}>
                                      {msg.role === "visitor" ? lead.name : "Vela"} · {new Date(msg.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                    </div>
                                    {msg.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Showing {filtered.length} of {leads.length} leads · All time
        </div>
      )}
    </div>
  );
}
