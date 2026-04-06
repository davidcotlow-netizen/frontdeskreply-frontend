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
}

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
  const [search, setSearch] = useState("");
  const [filterIntent, setFilterIntent] = useState("all");
  const [sortField, setSortField] = useState<SortField>("last_contact");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/conversations/leads?business_id=${businessId}`)
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => setLeads([]))
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
      return matchSearch && matchIntent;
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
  }, [leads, search, filterIntent, sortField, sortDir]);

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
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
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
            display: "grid", gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1fr 1.2fr",
            padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)",
            background: "rgba(255,255,255,0.02)",
          }}>
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
                    display: "grid", gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1fr 1.2fr",
                    padding: "14px 18px", cursor: "pointer",
                    borderBottom: idx < filtered.length - 1 || isOpen ? "1px solid var(--border-subtle)" : "none",
                    background: isOpen ? "rgba(249,115,22,0.04)" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
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

                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                      background: `${intentColor}18`, color: intentColor,
                      border: `1px solid ${intentColor}30`,
                    }}>{intentLabel}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{lead.message_count}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>msg{lead.message_count !== 1 ? "s" : ""}</span>
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
                    padding: "16px 18px 18px 70px",
                    borderBottom: idx < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    background: "rgba(249,115,22,0.03)",
                    display: "flex", gap: 32, flexWrap: "wrap",
                  }}>
                    {[
                      { label: "Full Name", value: lead.name },
                      { label: "Email", value: lead.email || "—" },
                      { label: "Phone", value: lead.phone || "—" },
                      { label: "First Contact", value: formatDate(lead.first_contact) },
                      { label: "Last Contact", value: formatDate(lead.last_contact) },
                      { label: "Total Messages", value: String(lead.message_count) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{value}</div>
                      </div>
                    ))}
                    {lead.intents.length > 1 && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>All Inquiry Types</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {lead.intents.map(i => (
                            <span key={i} style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 5,
                              background: `${INTENT_COLORS[i] || "#6b7280"}18`,
                              color: INTENT_COLORS[i] || "#6b7280",
                            }}>{INTENT_LABELS[i] || i}</span>
                          ))}
                        </div>
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
