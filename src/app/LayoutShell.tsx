"use client";

import { useState, useEffect } from "react";
import UserFooter from "./UserFooter";
import SidebarNav from "./SidebarNav";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("fdr-theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("fdr-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

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
        {/* Logo + Theme Toggle */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} style={{
              width: "30px", height: "30px", borderRadius: "8px",
              background: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-secondary)", fontSize: "15px", padding: 0,
              transition: "all 0.2s",
            }}>
              {theme === "dark" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
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
