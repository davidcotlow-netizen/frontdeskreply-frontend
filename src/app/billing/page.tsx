"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const PLANS = [
  {
    tier: "starter",
    name: "Starter",
    price: "$79",
    desc: "Perfect for getting started",
    limit: "300 conversations/mo",
    features: ["Web form + chat widget", "AI draft responses", "Approval queue", "Email & SMS replies", "Basic analytics"],
    highlight: false,
  },
  {
    tier: "growth",
    name: "Growth",
    price: "$149",
    desc: "Most popular for home service businesses",
    limit: "1,000 conversations/mo",
    features: ["Everything in Starter", "Auto-send for approved types", "SMS integration", "Full analytics dashboard", "Priority support"],
    highlight: true,
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$299",
    desc: "For high-volume operations",
    limit: "Unlimited conversations",
    features: ["Everything in Growth", "API access", "Multi-location support", "Custom integrations", "Dedicated onboarding"],
    highlight: false,
  },
];

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatPeriod(start: number, end: number) {
  const s = new Date(start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(end * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    paid:          { bg: "rgba(16,185,129,0.1)",  color: "var(--green)", label: "Paid" },
    open:          { bg: "rgba(249,115,22,0.1)",  color: "var(--accent)", label: "Due" },
    void:          { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)", label: "Void" },
    uncollectible: { bg: "rgba(239,68,68,0.1)",   color: "#f87171", label: "Failed" },
  };
  const s = map[status] || map.void;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33`, borderRadius: "5px", padding: "2px 8px", fontSize: "11px", fontWeight: "600" }}>
      {s.label}
    </span>
  );
}

export default function BillingPage() {
  const { user, isLoaded } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setSuccess(true);
    if (params.get("canceled") === "true") setCanceled(true);

    fetch(`${API}/billing/plan?business_id=${businessId}`)
      .then(r => r.json())
      .then(setPlan)
      .finally(() => setLoading(false));

    fetch(`${API}/billing/history?business_id=${businessId}`)
      .then(r => r.json())
      .then(data => setInvoices(data.invoices || []))
      .catch(() => setInvoices([]))
      .finally(() => setInvoicesLoading(false));
  }, [isLoaded, businessId]);

  async function handleUpgrade(tier: string) {
    setUpgrading(tier);
    try {
      const res = await fetch(
        `${API}/billing/create-checkout?business_id=${businessId}&plan_tier=${tier}&return_url=${encodeURIComponent(window.location.href)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch (e) {
      console.error("Checkout error:", e);
    } finally {
      setUpgrading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch(
        `${API}/billing/portal?business_id=${businessId}&return_url=${encodeURIComponent(window.location.href)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.portal_url) window.location.href = data.portal_url;
    } catch (e) {
      console.error("Portal error:", e);
    } finally {
      setPortalLoading(false);
    }
  }

  const currentTier = plan?.plan_tier || "starter";
  const usedCount = plan?.conversations_used || 0;
  const limitCount = plan?.monthly_conversation_limit || 300;
  const usagePct = Math.min((usedCount / limitCount) * 100, 100);

  return (
    <div style={{ padding: "32px 36px", maxWidth: "960px" }}>

      {/* Header */}
      <div className="fade-in" style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "500", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>
          Subscription
        </div>
        <h1 style={{ fontSize: "26px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "6px" }}>
          Billing & Plans
        </h1>
        <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
          Manage your subscription and usage.
        </p>
      </div>

      {/* Success / Canceled banners */}
      {success && (
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>✅</span>
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--green)" }}>Subscription activated!</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Your plan has been upgraded successfully.</div>
          </div>
        </div>
      )}
      {canceled && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <div style={{ fontSize: "13.5px", color: "var(--yellow)" }}>Checkout canceled — no changes were made.</div>
        </div>
      )}

      {/* Current Plan Card */}
      {!loading && (
        <div className="fade-in" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "20px 24px", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "4px" }}>Current Plan</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.03em", fontFamily: "'DM Serif Display', serif" }}>
                  {PLANS.find(p => p.tier === currentTier)?.name || "Starter"}
                </span>
                <span style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: "5px", padding: "2px 8px", fontSize: "11px", fontWeight: "600", color: "var(--accent)" }}>
                  Active
                </span>
              </div>
            </div>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "8px 16px", fontSize: "12.5px", color: "var(--text-secondary)", cursor: "pointer", opacity: portalLoading ? 0.6 : 1 }}
            >
              {portalLoading ? "Loading..." : "Manage Subscription →"}
            </button>
          </div>

          {/* Usage bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Conversations this month</span>
              <span style={{ fontSize: "12px", color: usagePct > 80 ? "var(--accent)" : "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
                {usedCount} / {limitCount === 999999 ? "∞" : limitCount}
              </span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "4px",
                width: `${usagePct}%`,
                background: usagePct > 80 ? "linear-gradient(90deg, var(--accent), #fb923c)" : "linear-gradient(90deg, var(--green), #34d399)",
                transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
              }} />
            </div>
            {usagePct > 80 && (
              <div style={{ fontSize: "11.5px", color: "var(--accent)", marginTop: "6px" }}>
                ⚠️ Approaching your monthly limit — consider upgrading.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
        {PLANS.map((p, i) => {
          const isCurrent = p.tier === currentTier;
          return (
            <div key={p.tier} className={`fade-in-${i + 1}`} style={{
              background: p.highlight ? "var(--bg-card-hover)" : "var(--bg-card)",
              border: p.highlight ? "1px solid rgba(249,115,22,0.3)" : isCurrent ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-subtle)",
              borderRadius: "14px", padding: "22px", position: "relative",
              display: "flex", flexDirection: "column",
            }}>
              {p.highlight && (
                <div style={{ position: "absolute", top: "-1px", left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #f97316, #ea580c)", borderRadius: "0 0 8px 8px", padding: "3px 12px", fontSize: "10px", fontWeight: "700", color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div style={{ position: "absolute", top: "14px", right: "14px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "5px", padding: "2px 8px", fontSize: "10px", fontWeight: "600", color: "var(--green)" }}>
                  Current
                </div>
              )}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>{p.name}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "12px" }}>{p.desc}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                  <span style={{ fontSize: "28px", fontWeight: "600", color: "var(--text-primary)", fontFamily: "'DM Serif Display', serif", letterSpacing: "-0.03em" }}>{p.price}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>/month</span>
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--accent)", marginTop: "4px" }}>{p.limit}</div>
              </div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px", flex: 1 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--green)", flexShrink: 0, marginTop: "1px" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => !isCurrent && handleUpgrade(p.tier)}
                disabled={isCurrent || upgrading === p.tier}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
                  cursor: isCurrent ? "default" : "pointer",
                  background: isCurrent ? "rgba(16,185,129,0.08)" : p.highlight ? "linear-gradient(135deg, #f97316, #ea580c)" : "rgba(255,255,255,0.06)",
                  border: isCurrent ? "1px solid rgba(16,185,129,0.2)" : p.highlight ? "none" : "1px solid var(--border-subtle)",
                  color: isCurrent ? "var(--green)" : p.highlight ? "#fff" : "var(--text-secondary)",
                  opacity: upgrading && upgrading !== p.tier ? 0.5 : 1,
                  transition: "all 0.15s",
                  boxShadow: p.highlight && !isCurrent ? "0 2px 8px rgba(249,115,22,0.3)" : "none",
                }}
              >
                {isCurrent ? "Current Plan" : upgrading === p.tier ? "Redirecting..." : `Upgrade to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: "20px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
        All plans include a 14-day free trial · Cancel anytime · Powered by Stripe
      </div>

      {/* Payment History */}
      <div style={{ marginTop: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "500", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>
              Billing Records
            </div>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Payment History
            </h2>
          </div>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "8px 16px", fontSize: "12.5px", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            Manage Billing →
          </button>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "14px", overflow: "hidden" }}>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 100px 80px 110px", gap: "12px", padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
            {["Date", "Billing Period", "Amount", "Status", "Invoice"].map(h => (
              <div key={h} style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {/* Loading state */}
          {invoicesLoading && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Loading payment history...
            </div>
          )}

          {/* Empty state */}
          {!invoicesLoading && invoices.length === 0 && (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>🧾</div>
              <div style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)", marginBottom: "6px" }}>No payment history yet</div>
              <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Your invoices will appear here once you subscribe to a paid plan.</div>
            </div>
          )}

          {/* Invoice rows */}
          {!invoicesLoading && invoices.map((inv, idx) => (
            <div
              key={inv.id}
              style={{
                display: "grid", gridTemplateColumns: "1fr 2fr 100px 80px 110px", gap: "12px",
                padding: "14px 20px", alignItems: "center",
                borderBottom: idx < invoices.length - 1 ? "1px solid var(--border-subtle)" : "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* Date */}
              <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: "500" }}>
                {formatDate(inv.date)}
              </div>

              {/* Billing period */}
              <div>
                <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                  {inv.period_start && inv.period_end ? formatPeriod(inv.period_start, inv.period_end) : "—"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", textTransform: "capitalize" }}>
                  {inv.plan_tier} plan · #{inv.number}
                </div>
              </div>

              {/* Amount */}
              <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: "600", fontFamily: "'Geist Mono', monospace" }}>
                ${inv.amount.toFixed(2)}
              </div>

              {/* Status */}
              <div>
                <StatusBadge status={inv.status} />
              </div>

              {/* Invoice links */}
              <div style={{ display: "flex", gap: "8px" }}>
                {inv.invoice_url && (
                  <a
                    href={inv.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", fontWeight: "500", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    View
                  </a>
                )}
                {inv.invoice_pdf && (
                  <>
                    {inv.invoice_url && <span style={{ color: "var(--border-subtle)", fontSize: "12px" }}>·</span>}
                    <a
                      href={inv.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none", fontWeight: "500", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      PDF ↓
                    </a>
                  </>
                )}
                {!inv.invoice_url && !inv.invoice_pdf && (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
