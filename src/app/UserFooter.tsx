"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";

export default function UserFooter() {
  const { user } = useUser();

  const name = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.emailAddresses?.[0]?.emailAddress || "Staff"
    : "";
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const bizName = (user?.publicMetadata?.business_name as string) || "Your Business";

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
          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "500" }}>Starter Plan</span>
          <a href="/billing" style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "600", textDecoration: "none" }}>Upgrade →</a>
        </div>
        <div className="plan-bar">
          <div className="plan-bar-fill" style={{ width: "40%" }} />
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", display: "flex", justifyContent: "space-between" }}>
          <span>24 / 60 messages</span>
          <span style={{ opacity: 0.6 }}>this month</span>
        </div>
      </div>
    </div>
  );
}
