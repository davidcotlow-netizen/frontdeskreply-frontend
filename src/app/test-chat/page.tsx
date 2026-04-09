"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";

export default function TestChatPage() {
  const { user, isLoaded } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    // Inject the widget script
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.setAttribute("data-business-id", businessId);
    script.setAttribute("data-agent-name", "Milo");
    script.setAttribute("data-color", "#E8714A");
    document.body.appendChild(script);

    return () => {
      // Cleanup widget on unmount
      const host = document.getElementById("fdr-chat-widget-host");
      if (host) host.remove();
      script.remove();
    };
  }, [isLoaded, businessId]);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
          Chatbot Preview
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: 0, marginBottom: 6 }}>
          Test Your Chatbot
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: 0 }}>
          The Milo chat widget is loaded on this page. Click the chat bubble in the bottom-right to test it with your FAQ data.
        </p>
      </div>

      <div ref={containerRef} style={{
        background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🐾</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Milo is ready</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Click the chat bubble to start a test conversation</div>
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.7, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
            <strong style={{ color: "var(--text-secondary)" }}>Tips for testing:</strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              <li>Ask questions that are in your FAQ list to verify accuracy</li>
              <li>Ask something NOT in your FAQs to see how Milo handles it</li>
              <li>Check that Milo directs to your phone number when unsure</li>
              <li>Verify the greeting message and tone match your brand</li>
            </ul>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
            Note: Test conversations will appear in your Past Conversations and Analytics like real ones.
          </div>
        </div>
      </div>
    </div>
  );
}
