"use client";

import { useState, useEffect } from "react";
import UserFooter from "./UserFooter";
import SidebarNav from "./SidebarNav";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (!e.matches) setSidebarOpen(false);
    };
    handleChange(mq);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Hamburger button — mobile only */}
      <button
        className="hamburger-btn"
        onClick={() => setSidebarOpen((prev) => !prev)}
        aria-label="Toggle sidebar"
        style={{
          position: "fixed",
          top: "14px",
          left: "14px",
          zIndex: 20,
          display: "none",            /* hidden by default; CSS media query shows it */
          alignItems: "center",
          justifyContent: "center",
          width: "38px",
          height: "38px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "8px",
          cursor: "pointer",
          color: "var(--text-primary)",
          padding: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect y="3" width="20" height="2" rx="1" fill="currentColor" />
          <rect y="9" width="20" height="2" rx="1" fill="currentColor" />
          <rect y="15" width="20" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      {/* Overlay backdrop — mobile only, when sidebar is open */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: "220px",
          flexShrink: 0,
          backgroundColor: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          height: "100%",
          zIndex: 10,
          transition: "transform 0.25s ease",
          transform: isMobile && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px", height: "32px",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              borderRadius: "9px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: "700", color: "#fff",
              boxShadow: "0 2px 8px rgba(249,115,22,0.35)",
              flexShrink: 0,
            }}>F</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>FrontdeskReply</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1 }}>Dashboard</div>
            </div>
          </div>
        </div>

        {/* Dynamic nav */}
        <SidebarNav />

        {/* User block + plan usage */}
        <UserFooter />
      </aside>

      <main style={{
        flex: 1,
        marginLeft: isMobile ? 0 : "220px",
        minHeight: "100vh",
        backgroundColor: "var(--bg-surface)",
        transition: "margin-left 0.25s ease",
      }}>
        {children}
      </main>
    </div>
  );
}
