"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const ADMIN_KEY = "fdr-admin-dj-2026";

// Only these Clerk user IDs / emails can access admin
const ADMIN_EMAILS = ["djcotlow1981@gmail.com", "david.cotlow@gmail.com"];

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  plan: string;
  plan_status: string;
  chats_this_month: number;
  calls_this_month: number;
  call_minutes_used: number;
  call_minutes_limit: number;
  voice_number: string;
  faq_count: number;
  last_active: string | null;
  created_at: string;
  billing_renewal: number | null;
  stripe_status: string;
}

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  pro: { bg: "rgba(139,92,246,0.12)", color: "#8b5cf6" },
  growth: { bg: "rgba(249,115,22,0.12)", color: "#f97316" },
  starter: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  none: { bg: "rgba(107,114,128,0.12)", color: "#6b7280" },
};

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress || "";
    if (ADMIN_EMAILS.includes(email)) {
      setAuthorized(true);
      fetch(`${API}/admin/clients?admin_key=${ADMIN_KEY}`)
        .then(r => r.json())
        .then(d => setClients(d.clients || []))
        .catch(() => setClients([]))
        .finally(() => setLoading(false));
    } else {
      setAuthorized(false);
      setLoading(false);
    }
  }, [isLoaded, user]);

  if (!isLoaded || loading) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <div className="shimmer" style={{ height: 200, borderRadius: 14 }} />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{ padding: "32px 36px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Admin Access Only</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>This page is restricted to FrontDeskReply administrators.</div>
      </div>
    );
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q) || c.plan.includes(q);
  });

  const totalChats = clients.reduce((s, c) => s + c.chats_this_month, 0);
  const totalCalls = clients.reduce((s, c) => s + c.calls_this_month, 0);
  const totalMinutes = clients.reduce((s, c) => s + c.call_minutes_used, 0);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
          Internal
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: 0, marginBottom: 6 }}>
          Admin Dashboard
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: 0 }}>
          All clients, plans, and usage at a glance.
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderTop: "2px solid var(--accent)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Total Clients</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{clients.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderTop: "2px solid #3b82f6", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Chats This Month</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{totalChats}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderTop: "2px solid #8b5cf6", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Calls This Month</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{totalCalls}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderTop: "2px solid #10b981", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Voice Minutes</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{totalMinutes}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name, email, phone, or plan..."
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

      {/* Client table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 1.6fr 0.6fr 0.4fr 0.5fr 0.5fr 1fr 0.9fr 0.9fr",
          padding: "10px 18px", borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(255,255,255,0.02)",
        }}>
          {["Business", "Contact", "Plan", "FAQs", "Chats", "Calls", "Voice Min", "Billing", "Last Active"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>No clients found</div>
          </div>
        ) : filtered.map((client, idx) => {
          const planStyle = PLAN_COLORS[client.plan] || PLAN_COLORS.none;
          const overLimit = client.call_minutes_limit > 0 && client.call_minutes_used > client.call_minutes_limit;
          const usagePct = client.call_minutes_limit > 0 ? Math.round((client.call_minutes_used / client.call_minutes_limit) * 100) : 0;

          return (
            <div key={client.id} style={{
              display: "grid", gridTemplateColumns: "1.6fr 1.6fr 0.6fr 0.4fr 0.5fr 0.5fr 1fr 0.9fr 0.9fr",
              padding: "12px 18px", alignItems: "center",
              borderBottom: idx < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}>
              {/* Business */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{client.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{client.city}</div>
                {client.created_at && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Since {new Date(client.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>}
              </div>

              {/* Contact */}
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{client.email || "—"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{client.phone || "—"}</div>
              </div>

              {/* Plan */}
              <div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                  background: planStyle.bg, color: planStyle.color,
                  textTransform: "capitalize",
                }}>{client.plan}</span>
              </div>

              {/* FAQs */}
              <div style={{ fontSize: 13, fontWeight: 600, color: client.faq_count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                {client.faq_count}
              </div>

              {/* Chats */}
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {client.chats_this_month}
              </div>

              {/* Calls */}
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {client.calls_this_month}
              </div>

              {/* Voice Minutes */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: overLimit ? "#ef4444" : "var(--text-primary)" }}>
                    {client.call_minutes_used}
                  </span>
                  {client.call_minutes_limit > 0 && (
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>/ {client.call_minutes_limit}</span>
                  )}
                </div>
                {client.call_minutes_limit > 0 && (
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 3, width: "80%" }}>
                    <div style={{
                      height: "100%", borderRadius: 2, width: `${Math.min(usagePct, 100)}%`,
                      background: usagePct > 90 ? "#ef4444" : usagePct > 70 ? "#f59e0b" : "#10b981",
                    }} />
                  </div>
                )}
                {client.voice_number && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{client.voice_number}</div>
                )}
              </div>

              {/* Billing */}
              <div>
                {client.billing_renewal ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(client.billing_renewal * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 10, color: client.stripe_status === "active" ? "#10b981" : "#f59e0b" }}>
                      {client.stripe_status === "active" ? "Active" : client.stripe_status}
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Test</span>
                )}
              </div>

              {/* Last Active */}
              <div style={{ fontSize: 11, color: client.last_active ? "var(--text-secondary)" : "var(--text-muted)" }}>
                {client.last_active ? new Date(client.last_active).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
        Showing {filtered.length} of {clients.length} clients &middot; Data for current month
      </div>
    </div>
  );
}
