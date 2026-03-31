import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";
import UserFooter from "./UserFooter";
import SidebarNav from "./SidebarNav";

export const metadata: Metadata = {
  title: "FrontdeskReply",
  description: "AI-powered lead response for home service businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en">
        <body style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)", minHeight: "100vh" }}>
          <div style={{ display: "flex", minHeight: "100vh" }}>

            <aside style={{
              width: "220px", flexShrink: 0,
              backgroundColor: "var(--bg-sidebar)",
              borderRight: "1px solid var(--border-subtle)",
              display: "flex", flexDirection: "column",
              position: "fixed", height: "100%", zIndex: 10,
            }}>

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

            <main style={{ flex: 1, marginLeft: "220px", minHeight: "100vh", backgroundColor: "var(--bg-surface)" }}>
              {children}
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
