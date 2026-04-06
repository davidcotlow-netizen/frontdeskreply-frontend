"use client";

import { usePathname } from "next/navigation";

const navItems = [
  {
    section: "Workspace",
    links: [
      {
        href: "/",
        label: "Dashboard",
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" fill="currentColor"/>
            <rect x="8.5" y="1" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.4"/>
            <rect x="1" y="8.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.4"/>
            <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" opacity="0.4"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: "Insights",
    links: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M1 12l4-4 3 2.5 4-6L15 6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 14h14" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity="0.4"/>
          </svg>
        ),
      },
      {
        href: "/sent-messages",
        label: "Sent Messages",
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M14 2L7 9" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2L9.5 14L7 9L2 6.5L14 2Z" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        href: "/settings",
        label: "Settings",
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.15"/>
            <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.27 1.27M11.33 11.33l1.27 1.27M3.4 12.6l1.27-1.27M11.33 4.67l1.27-1.27" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity="0.7"/>
          </svg>
        ),
      },
      {
        href: "/billing",
        label: "Billing",
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.15"/>
            <path d="M1 6h14" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/>
          </svg>
        ),
      },
    ],
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav style={{
      flex: 1,
      padding: "10px 8px",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    }}>
      {navItems.map((group) => (
        <div key={group.section}>
          <div style={{
            fontSize: "10px",
            fontWeight: "600",
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "12px 10px 4px",
          }}>
            {group.section}
          </div>

          {group.links.map((link) => {
            const active = isActive(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: active ? "600" : "400",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  background: active ? "rgba(249,115,22,0.1)" : "transparent",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
                  }
                }}
              >
                <span style={{ color: active ? "var(--accent)" : "currentColor", display: "flex", flexShrink: 0 }}>
                  {link.icon}
                </span>
                {link.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
