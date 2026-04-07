"use client";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter Plan",
  growth:  "Growth Plan",
  pro:     "Pro Plan",
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 300,
  growth:  1000,
  pro:     999999,
};

interface PlanData {
  plan_tier: string;
  conversations_used: number;
  monthly_conversation_limit: number;
}

export default function UserFooter() {
  const { user } = useUser();
  const [planData, setPlanData] = useState<PlanData | null>(null);

  const name = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.emailAddresses?.[0]?.emailAddress || "Staff"
    : "";
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const bizName = (user?.publicMetadata?.business_name as string) || "Your Business";

  // Read plan from Clerk publicMetadata first, fallback to API
  const clerkPlan = (user?.publicMetadata?.plan as string) || null;

  useEffect(() => {
    if (!user) return;
    const businessId = (user.publicMetadata?.business_id as string) || "00000000-0000-0000-0000-000000000001";
    fetch(`${API}/billing/plan?business_id=${businessId}`)
      .then(r => r.json())
      .then(d => setPlanData(d))
      .catch(() => {});
  }, [user]);

  // Derive display values — API is source of truth for usage, Clerk for plan name
  const planTier = clerkPlan || planData?.plan_tier || "starter";
  const planLabel = PLAN_LABELS[planTier] || "Starter Plan";
  const isPro = planTier === "pro";
  const used = planData?.conversations_used ?? 0;
  const limit = planData?.monthly_conversation_limit ?? PLAN_LIMITS[planTier] ?? 300;
  const pct = isPro ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "var(--accent)";

  return (
    <div style={{ padding: "12px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "10px" }}>
      {user && (
        <div style={{
          display: "flex", alignItems: "center", gap: "9px",
          padding: "8px 10px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "10px",
        }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
            background: "rgba(249,115,22,0.2)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", fontWeight: "700",
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bizName}</div>
          </div>
          <SignOutButton>
            <button
              title="Sign out"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", padding: "4px", borderRadius: "4px",
                display: "flex", alignItems: "center",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </SignOutButton>
        </div>
      )}

      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "10px", padding: "12px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "500" }}>
            {planLabel}
          </span>
          {!isPro && (
            <a href="/billing" style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "600", textDecoration: "none" }}>
              Upgrade →
            </a>
          )}
          {isPro && (
            <a href="/billing" style={{ fontSize: "11px", color: "#10b981", fontWeight: "600", textDecoration: "none" }}>
              Manage →
            </a>
          )}
        </div>

        {isPro ? (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Unlimited conversations</span>
            <span style={{ opacity: 0.6 }}>this month</span>
          </div>
        ) : (
          <>
            <div className="plan-bar">
              <div className="plan-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", display: "flex", justifyContent: "space-between" }}>
              <span>{used} / {limit.toLocaleString()} messages</span>
              <span style={{ opacity: 0.6 }}>this month</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
