"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import * as XLSX from "xlsx-style";

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

function cellStyle(overrides: any = {}) {
  return {
    font: { name: "Arial", sz: 10, color: { rgb: "1A1F2E" }, ...overrides.font },
    fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" }, ...overrides.fill },
    alignment: { horizontal: "left", vertical: "center", ...overrides.alignment },
    border: {
      bottom: { style: "thin", color: { rgb: "E2E5EA" } },
      ...overrides.border,
    },
    ...overrides,
  };
}

function exportToXLSX(leads: Lead[], businessName: string) {
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

  // Build array-of-arrays
  const aoa: any[][] = [
    [`FrontdeskReply  ·  Customer Lead Intelligence Report`],                    // Row 1
    [`Exported ${today}  ·  All time  ·  Confidential`],                          // Row 2
    [`${leads.length}\nTOTAL LEADS`, ``, `${emailCount}\nHAVE EMAIL`, ``, `${phoneCount}\nHAVE PHONE`, ``, `${thisMonth}\nNEW THIS MONTH`], // Row 3
    [],                                                                            // Row 4 spacer
    ["#", "Customer Name", "Email Address", "Phone Number", "First Contact", "Last Contact", "Primary Inquiry"], // Row 5
    ...leads.map((l, i) => [
      i + 1,
      l.name,
      l.email || "—",
      l.phone || "—",
      formatDate(l.first_contact),
      formatDate(l.last_contact),
      INTENT_LABELS[l.top_intent] || l.top_intent,
    ]),
    [`Showing ${leads.length} of ${leads.length} leads  ·  All time`],            // Footer
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws["!cols"] = [
    { wch: 5 }, { wch: 22 }, { wch: 30 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
  ];

  // Row heights
  ws["!rows"] = [
    { hpt: 36 }, // banner
    { hpt: 20 }, // subtitle
    { hpt: 44 }, // KPIs
    { hpt: 8 },  // spacer
    { hpt: 28 }, // headers
    ...leads.map(() => ({ hpt: 26 })),
    { hpt: 22 }, // footer
  ];

  // Merges
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // banner
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // subtitle
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }, // KPI 1
    { s: { r: 2, c: 2 }, e: { r: 2, c: 3 } }, // KPI 2
    { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } }, // KPI 3
    { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }, // spacer
    { s: { r: leads.length + 5, c: 0 }, e: { r: leads.length + 5, c: 6 } }, // footer
  ];

  // ── Helper to apply style to a cell ──────────────────────────────────
  function applyStyle(cellRef: string, s: any, value?: any) {
    if (!ws[cellRef]) ws[cellRef] = { v: value ?? "", t: "s" };
    ws[cellRef].s = s;
  }

  // ── Row 1: Banner ────────────────────────────────────────────────────
  applyStyle("A1", cellStyle({
    font: { name: "Arial", sz: 13, bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "0F1923" } },
    alignment: { horizontal: "left", vertical: "center", indent: 2 },
    border: {},
  }));

  // ── Row 2: Subtitle ──────────────────────────────────────────────────
  applyStyle("A2", cellStyle({
    font: { name: "Arial", sz: 9, color: { rgb: "AAAAAA" } },
    fill: { patternType: "solid", fgColor: { rgb: "0F1923" } },
    alignment: { horizontal: "left", vertical: "center", indent: 2 },
    border: {},
  }));

  // ── Row 3: KPI cells ─────────────────────────────────────────────────
  const kpiAccents = ["F97316", "10B981", "3B82F6", "8B5CF6"];
  const kpiCols = ["A", "C", "E", "G"];
  kpiCols.forEach((col, i) => {
    applyStyle(`${col}3`, cellStyle({
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: "1A1F2E" } },
      fill: { patternType: "solid", fgColor: { rgb: "F7F8FA" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        left: { style: "medium", color: { rgb: kpiAccents[i] } },
        right: { style: "thin", color: { rgb: "E2E5EA" } },
        top: { style: "thin", color: { rgb: "E2E5EA" } },
        bottom: { style: "thin", color: { rgb: "E2E5EA" } },
      },
    }));
  });

  // ── Row 4: Spacer ────────────────────────────────────────────────────
  applyStyle("A4", cellStyle({
    fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
    border: {},
  }));

  // ── Row 5: Headers ───────────────────────────────────────────────────
  ["A","B","C","D","E","F","G"].forEach(col => {
    applyStyle(`${col}5`, cellStyle({
      font: { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "F97316" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: { bottom: { style: "thin", color: { rgb: "E2E5EA" } } },
    }));
  });

  // ── Data rows ────────────────────────────────────────────────────────
  leads.forEach((lead, i) => {
    const row = i + 6;
    const bg = i % 2 === 0 ? "FFFFFF" : "F7F8FA";
    const cols = ["A","B","C","D","E","F","G"];

    cols.forEach((col, ci) => {
      const isInquiry = ci === 6;
      const isNumber = ci === 0;
      const isCentered = [0, 4, 5, 6].includes(ci);
      const intentVal = lead.top_intent;

      let ibg = bg;
      let ifg = "1A1F2E";
      let bold = false;

      if (isInquiry) {
        bold = true;
        if (["faq", "general_inquiry", "inquiry"].includes(intentVal)) {
          ibg = "E6F4EA"; ifg = "1E6E35";
        } else if (["booking", "booking_request"].includes(intentVal)) {
          ibg = "FFF7ED"; ifg = "C2410C";
        } else if (["quote", "quote_request"].includes(intentVal)) {
          ibg = "F5F3FF"; ifg = "6D28D9";
        } else if (["emergency", "emergency_service"].includes(intentVal)) {
          ibg = "FEF2F2"; ifg = "B91C1C";
        } else {
          ibg = "E8F0FE"; ifg = "1A56DB";
        }
      }

      // Dim dashes
      const cellVal = ws[`${col}${row}`]?.v;
      if (cellVal === "—") ifg = "BBBBBB";

      applyStyle(`${col}${row}`, cellStyle({
        font: { name: "Arial", sz: isInquiry ? 9 : 10, bold, color: { rgb: ifg } },
        fill: { patternType: "solid", fgColor: { rgb: ibg } },
        alignment: {
          horizontal: isCentered ? "center" : "left",
          vertical: "center",
          indent: isCentered ? 0 : 1,
        },
        border: { bottom: { style: "thin", color: { rgb: "E2E5EA" } } },
      }));
    });
  });

  // ── Footer ───────────────────────────────────────────────────────────
  const footerRow = leads.length + 6;
  applyStyle(`A${footerRow}`, cellStyle({
    font: { name: "Arial", sz: 9, italic: true, color: { rgb: "4A5568" } },
    fill: { patternType: "solid", fgColor: { rgb: "F7F8FA" } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
    border: {},
  }));

  // ── Freeze panes & sheet options ─────────────────────────────────────
  ws["!freeze"] = { xSplit: 0, ySplit: 5 };
  ws["!sheetView"] = { showGridLines: false };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lead Database");

  const filename = `${businessName.toLowerCase().replace(/\s+/g, "-")}-leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
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
          onClick={() => exportToXLSX(filtered, businessName)}
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

          {/* Table header */}
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

          {/* Table rows */}
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
                  {/* Name */}
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

                  {/* Contact */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, justifyContent: "center" }}>
                    {lead.email && (
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>✉️ {lead.email}</span>
                    )}
                    {lead.phone && (
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>📱 {lead.phone}</span>
                    )}
                    {!lead.email && !lead.phone && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No contact info</span>
                    )}
                  </div>

                  {/* Intent */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                      background: `${intentColor}18`, color: intentColor,
                      border: `1px solid ${intentColor}30`,
                    }}>{intentLabel}</span>
                  </div>

                  {/* Message count */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                      {lead.message_count}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>msg{lead.message_count !== 1 ? "s" : ""}</span>
                  </div>

                  {/* First contact */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{formatDate(lead.first_contact)}</span>
                  </div>

                  {/* Last contact */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{timeAgo(lead.last_contact)}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded row */}
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
