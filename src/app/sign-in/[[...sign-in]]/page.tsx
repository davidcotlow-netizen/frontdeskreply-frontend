import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "var(--bg-base)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "32px",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "40px", height: "40px",
          background: "linear-gradient(135deg, #f97316, #ea580c)",
          borderRadius: "11px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px", fontWeight: "700", color: "#fff",
          boxShadow: "0 4px 16px rgba(249,115,22,0.4)",
        }}>F</div>
        <div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Frontdesk AI</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>AI-powered lead response</div>
        </div>
      </div>

      {/* Clerk sign-in component */}
      <SignIn
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: "400px" },
            card: {
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
            },
            headerTitle: { color: "var(--text-primary)", fontSize: "18px", fontWeight: "600" },
            headerSubtitle: { color: "var(--text-secondary)" },
            formFieldLabel: { color: "var(--text-secondary)", fontSize: "13px" },
            formFieldInput: {
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "14px",
            },
            formButtonPrimary: {
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
            },
            footerActionLink: { color: "var(--accent)" },
            identityPreviewText: { color: "var(--text-primary)" },
            identityPreviewEditButton: { color: "var(--accent)" },
          },
        }}
      />

      <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", maxWidth: "320px", lineHeight: 1.6 }}>
        Secure staff access for home service businesses powered by Frontdesk AI.
      </p>
    </div>
  );
}
