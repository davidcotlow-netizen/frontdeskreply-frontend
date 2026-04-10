import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";
import LayoutShell from "./LayoutShell";

export const metadata: Metadata = {
  title: "FrontdeskReply",
  description: "AI-powered lead response for home service businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en">
        <body style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)", minHeight: "100vh" }}>
          <LayoutShell>{children}</LayoutShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
