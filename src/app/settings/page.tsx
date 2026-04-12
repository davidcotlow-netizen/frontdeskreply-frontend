"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

const FALLBACK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Profile = {
  name: string;
  phone: string;
  city: string;
  hours: string;
  emergency_policy: string;
  service_areas: string;
  tone: string;
  emergency_contact_phone: string;
  owner_email: string;
};

type FAQ = {
  id?: string;
  question: string;
  answer: string;
  category: string;
  active: boolean;
};

type Tab = "profile" | "faqs" | "automation" | "notifications" | "email";

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const businessId = (user?.publicMetadata?.business_id as string) || FALLBACK_BUSINESS_ID;

  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile>({
    name: "", phone: "", city: "", hours: "",
    emergency_policy: "", service_areas: "",
    tone: "professional but warm", emergency_contact_phone: "",
    owner_email: "",
  });
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [deletingFaqId, setDeletingFaqId] = useState<string | null>(null);
  const [newFaq, setNewFaq] = useState<FAQ | null>(null);
  const [currentPlan, setCurrentPlan] = useState("starter");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voicePhone, setVoicePhone] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState("");

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ notify_on_chat: true, notify_on_call: true, notify_on_sms: true, weekly_report_enabled: true });
  const [notifSaving, setNotifSaving] = useState(false);

  // Import feature state
  const [importData, setImportData] = useState<any>(null);
  const [importPreview, setImportPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  // Email auto-reply state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailTestSent, setEmailTestSent] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // Outbound webhooks state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);

  // Proactive chat state
  const [proactiveDelay, setProactiveDelay] = useState(15);
  const [proactiveSaving, setProactiveSaving] = useState(false);

  // API keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("Default");
  const [generatedKey, setGeneratedKey] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  // Voice AI sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ status: string; faq_count?: number } | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    Promise.all([
      fetch(`${API}/settings/profile?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/settings/faqs?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/billing/plan?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/voice/status?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/settings/notifications?business_id=${businessId}`).then(r => r.json()).catch(() => ({})),
      fetch(`${API}/settings/email-status?business_id=${businessId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([p, f, plan, voice, notif, emailSt]) => {
      if (p && !p.detail) setProfile({ ...profile, ...p });
      if (f?.faqs) setFaqs(f.faqs);
      if (plan) setCurrentPlan(plan.plan_tier || "starter");
      if (voice?.enabled) { setVoiceEnabled(true); setVoicePhone(voice.phone_number || ""); }
      if (notif && !notif.detail) setNotifPrefs({ ...notifPrefs, ...notif });
      if (emailSt?.enabled) { setEmailEnabled(true); setEmailAddress(emailSt.forwarding_address || ""); }
      // Load proactive config and API keys after initial load
      fetch(`${API}/settings/proactive-config?business_id=${businessId}`).then(r => r.json()).then(d => {
        if (d?.auto_open_delay !== undefined) setProactiveDelay(d.auto_open_delay);
      }).catch(() => {});
      fetch(`${API}/settings/api-keys?business_id=${businessId}`).then(r => r.json()).then(d => {
        if (d?.keys) setApiKeys(d.keys);
      }).catch(() => {});
      fetch(`${API}/settings/webhooks-config?business_id=${businessId}`).then(r => r.json()).then(d => {
        if (d?.webhook_url) setWebhookUrl(d.webhook_url);
      }).catch(() => {});
    }).finally(() => setLoading(false));
  }, [isLoaded, businessId]);

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch(`${API}/settings/profile?business_id=${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function showVoiceSync(data: any) {
    const sync = data?.voice_sync;
    if (sync?.status === "synced") {
      setSyncResult({ status: "synced", faq_count: sync.faq_count });
    } else if (sync?.status === "error") {
      setSyncResult({ status: "error" });
    } else if (sync?.status === "skipped") {
      // No voice channel — no sync needed, don't show anything
      return;
    }
    setTimeout(() => setSyncResult(null), 4000);
  }

  async function saveFaq(faq: FAQ) {
    try {
      if (faq.id) {
        const res = await fetch(`${API}/settings/faqs/${faq.id}?business_id=${businessId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(faq),
        });
        if (!res.ok) { setSyncResult({ status: "error" }); setTimeout(() => setSyncResult(null), 4000); return; }
        const data = await res.json();
        setFaqs(faqs.map(f => f.id === faq.id ? faq : f));
        showVoiceSync(data);
      } else {
        const res = await fetch(`${API}/settings/faqs?business_id=${businessId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(faq),
        });
        if (!res.ok) { setSyncResult({ status: "error" }); setTimeout(() => setSyncResult(null), 4000); return; }
        const data = await res.json();
        setFaqs([...faqs, data.faq]);
        setNewFaq(null);
        showVoiceSync(data);
      }
      setEditingFaqId(null);
    } catch {
      setSyncResult({ status: "error" });
      setTimeout(() => setSyncResult(null), 4000);
    }
  }

  async function deleteFaq(faqId: string) {
    try {
      const res = await fetch(`${API}/settings/faqs/${faqId}?business_id=${businessId}`, { method: "DELETE" });
      if (!res.ok) { setSyncResult({ status: "error" }); setTimeout(() => setSyncResult(null), 4000); return; }
      const data = await res.json();
      setFaqs(faqs.filter(f => f.id !== faqId));
      showVoiceSync(data);
    } catch {
      setSyncResult({ status: "error" });
      setTimeout(() => setSyncResult(null), 4000);
    }
  }

  async function toggleFaq(faq: FAQ) {
    try {
      const updated = { ...faq, active: !faq.active };
      const res = await fetch(`${API}/settings/faqs/${faq.id}?business_id=${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) { setSyncResult({ status: "error" }); setTimeout(() => setSyncResult(null), 4000); return; }
      const data = await res.json();
      setFaqs(faqs.map(f => f.id === faq.id ? updated : f));
      showVoiceSync(data);
    } catch {
      setSyncResult({ status: "error" });
      setTimeout(() => setSyncResult(null), 4000);
    }
  }

  async function syncVoiceAI() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API}/settings/faqs/sync-voice?business_id=${businessId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult({ status: "synced", faq_count: data.faq_count });
      } else {
        setSyncResult({ status: "error" });
      }
    } catch {
      setSyncResult({ status: "error" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  }

  function exportFaqs() {
    if (!faqs.length) return;
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const rows = faqs.map((f, i) => {
      const bg = i % 2 === 0 ? "#FFFFFF" : "#F7F8FA";
      const statusColor = f.active ? "#10B981" : "#9CA3AF";
      const statusLabel = f.active ? "Active" : "Inactive";
      return `<tr style="height:auto;background:${bg}">
        <td style="font-size:12px;color:#9CA3AF;text-align:center;padding:8px 8px;border-bottom:1px solid #E2E5EA;vertical-align:top">${i + 1}</td>
        <td style="font-size:12px;color:#374151;padding:8px 12px;border-bottom:1px solid #E2E5EA;vertical-align:top;font-weight:600">${f.question.replace(/</g, "&lt;")}</td>
        <td style="font-size:12px;color:#374151;padding:8px 12px;border-bottom:1px solid #E2E5EA;vertical-align:top;line-height:1.5">${f.answer.replace(/</g, "&lt;")}</td>
        <td style="font-size:11px;color:#6B7280;text-align:center;padding:8px 8px;border-bottom:1px solid #E2E5EA;vertical-align:top">${f.category || "general"}</td>
        <td style="font-size:11px;font-weight:700;text-align:center;padding:8px 8px;border-bottom:1px solid #E2E5EA;vertical-align:top;color:${statusColor}">${statusLabel}</td>
      </tr>`;
    }).join("");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><style>body,table,td,th{font-family:Arial,sans-serif}table{border-collapse:collapse}</style></head><body>
<table style="width:900px">
  <tr style="height:40px"><td colspan="5" style="background:#0F1923;color:#FFF;font-size:15px;font-weight:bold;padding:0 18px">FrontdeskReply &middot; FAQ Knowledge Base</td></tr>
  <tr style="height:22px"><td colspan="5" style="background:#0F1923;color:#6B7280;font-size:10px;padding:0 18px 6px">${profile.name || "Business"} &middot; ${faqs.length} FAQs &middot; Exported ${today}</td></tr>
  <tr style="height:10px"><td colspan="5"></td></tr>
  <tr style="height:56px">
    <td colspan="2" style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #E8714A;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${faqs.length}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">TOTAL FAQS</div></td>
    <td colspan="2" style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #10B981;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${faqs.filter(f => f.active).length}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">ACTIVE</div></td>
    <td style="background:#F7F8FA;border:1px solid #E2E5EA;border-left:4px solid #6B7280;text-align:center;padding:6px 14px"><div style="font-size:26px;font-weight:700;color:#111827">${faqs.filter(f => !f.active).length}</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;margin-top:4px">INACTIVE</div></td>
  </tr>
  <tr style="height:10px"><td colspan="5"></td></tr>
  <tr style="height:28px;background:#F97316">
    <th style="color:#FFF;font-size:10px;font-weight:700;width:40px;padding:0 8px;text-align:center">#</th>
    <th style="color:#FFF;font-size:10px;font-weight:700;text-align:left;padding:0 12px;width:250px">QUESTION</th>
    <th style="color:#FFF;font-size:10px;font-weight:700;text-align:left;padding:0 12px;width:400px">ANSWER</th>
    <th style="color:#FFF;font-size:10px;font-weight:700;text-align:center;padding:0 8px;width:80px">CATEGORY</th>
    <th style="color:#FFF;font-size:10px;font-weight:700;text-align:center;padding:0 8px;width:60px">STATUS</th>
  </tr>
  ${rows}
  <tr style="height:28px"><td colspan="5" style="background:#F7F8FA;color:#9CA3AF;font-size:10px;font-style:italic;padding:0 14px;border-top:2px solid #E2E5EA">Generated by FrontdeskReply &middot; To re-import, save as JSON with {faqs: [{question, answer}]} format</td></tr>
</table></body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(profile.name || "business").toLowerCase().replace(/\s+/g, "-")}-faqs-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportFaqsAsJson() {
    const data = {
      business: { name: profile.name, phone: profile.phone },
      faqs: faqs.map(f => ({ question: f.question, answer: f.answer, category: f.category || "general", active: f.active })),
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(profile.name || "business").toLowerCase().replace(/\s+/g, "-")}-faqs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setImportData(data);
        setImportPreview(true);
      } catch {
        alert("Could not read file. Make sure it's a valid FrontdeskReply setup JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function applyImport() {
    if (!importData) return;
    setImporting(true);
    try {
      if (importData.business) {
        const b = importData.business;
        setProfile(prev => ({
          ...prev,
          name: b.name || prev.name,
          phone: b.phone || prev.phone,
          city: b.service_area || prev.city,
          service_areas: b.service_area || prev.service_areas,
          owner_email: b.email || prev.owner_email,
          hours: importData.hours
            ? Object.entries(importData.hours).map(([d, h]) => `${d}: ${h}`).join(", ")
            : prev.hours,
          emergency_policy: importData.after_hours_message || prev.emergency_policy,
        }));
      }
      if (importData.ai_settings?.tone) {
        setProfile(prev => ({
          ...prev,
          tone: importData.ai_settings.tone.toLowerCase().replace(/[^a-z ]/g, ""),
        }));
      }
      if (importData.faqs?.length) {
        const faqsToImport = importData.faqs
          .filter((f: any) => f.question)
          .map((f: any) => ({
            question: f.question,
            answer: f.answer || "",
            category: f.category || "general",
            active: f.active !== false,
          }));

        const res = await fetch(`${API}/settings/faqs/bulk?business_id=${businessId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ faqs: faqsToImport, replace: false }),
        });

        if (res.ok) {
          const data = await res.json();
          showVoiceSync(data);
          // Reload FAQs from server to get full list with IDs
          const refreshed = await fetch(`${API}/settings/faqs?business_id=${businessId}`).then(r => r.json());
          if (refreshed?.faqs) setFaqs(refreshed.faqs);
        } else {
          setSyncResult({ status: "error" });
          setTimeout(() => setSyncResult(null), 4000);
        }
      }
      setImportPreview(false);
      setImportData(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setImporting(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "profile", label: "Business Profile", icon: "🏢" },
    { id: "faqs", label: "FAQ Knowledge Base", icon: "💬" },
    { id: "automation", label: "Chatbot Settings", icon: "🤖" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "email", label: "Email Auto-Reply", icon: "✉" },
  ];

  return (
    <div style={{ padding: "32px 36px", maxWidth: "1400px" }}>

      {/* Header */}
      <div className="fade-in" style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "500", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>
          Configuration
        </div>
        <h1 style={{ fontSize: "26px", fontWeight: "600", color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "6px" }}>
          Settings
        </h1>
        <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
          Manage your business profile, FAQ knowledge base, and notification preferences.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "28px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 16px", fontSize: "13px", fontWeight: tab === t.id ? "600" : "400",
            color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
            borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: "-1px", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "7px",
          }}>
            <span style={{ fontSize: "13px" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: "60px", borderRadius: "10px" }} />)}
        </div>
      ) : (
        <>
          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              <Section title="Your Account" subtitle="Account details for reference and support">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Login Email</div>
                    <div style={{ fontSize: "13.5px", color: "var(--text-primary)", fontWeight: "500" }}>
                      {user?.primaryEmailAddress?.emailAddress || "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Business ID</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono, monospace)" }}>
                        {businessId}
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(businessId); }} style={{
                        background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
                        borderRadius: "5px", padding: "2px 8px", fontSize: "10px", color: "var(--text-muted)", cursor: "pointer",
                      }}>Copy</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Plan</div>
                    <div style={{ fontSize: "13.5px", color: "var(--accent)", fontWeight: "500", textTransform: "capitalize" }}>
                      {currentPlan}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Account Name</div>
                    <div style={{ fontSize: "13.5px", color: "var(--text-primary)", fontWeight: "500" }}>
                      {user?.fullName || user?.firstName || "—"}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Business Info" subtitle="Your chatbot uses these details when responding to visitors">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <Field label="Business Name" value={profile.name} onChange={v => setProfile({ ...profile, name: v })} placeholder="Pawty Yoga" />
                  <Field label="Phone Number" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v })} placeholder="(346) 410-6022" />
                  <Field label="City / Location" value={profile.city} onChange={v => setProfile({ ...profile, city: v })} placeholder="Houston, TX" />
                  <Field label="Service Areas" value={profile.service_areas} onChange={v => setProfile({ ...profile, service_areas: v })} placeholder="Houston, Katy, Sugar Land" />
                  <Field label="Owner Email" value={profile.owner_email} onChange={v => setProfile({ ...profile, owner_email: v })} placeholder="you@yourbusiness.com" />
                </div>
              </Section>

              <Section title="Hours & Availability" subtitle="Your chatbot references these when visitors ask about scheduling">
                <Field label="Business Hours" value={profile.hours} onChange={v => setProfile({ ...profile, hours: v })} placeholder="Mon–Fri 8am–6pm, Sat 9am–3pm" fullWidth />
              </Section>

              <Section title="After-Hours Message" subtitle="How your chatbot responds outside of business hours">
                <Field label="After-Hours Policy" value={profile.emergency_policy} onChange={v => setProfile({ ...profile, emergency_policy: v })} placeholder="Thanks for reaching out! We're not available right now but we'd love to help. Call us at (346) 410-6022 for urgent matters." fullWidth textarea />
                <Field label="Emergency Contact Phone" value={profile.emergency_contact_phone} onChange={v => setProfile({ ...profile, emergency_contact_phone: v })} placeholder="+17135550100" fullWidth />
              </Section>

              <Section title="Chatbot Tone" subtitle="How your AI chatbot sounds when talking to visitors">
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {["professional but warm", "friendly and casual", "formal and precise", "concise and direct"].map(t => (
                    <button key={t} onClick={() => setProfile({ ...profile, tone: t })} style={{
                      padding: "8px 14px", borderRadius: "8px", fontSize: "12.5px", cursor: "pointer",
                      background: profile.tone === t ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                      border: profile.tone === t ? "1px solid rgba(249,115,22,0.35)" : "1px solid var(--border-subtle)",
                      color: profile.tone === t ? "var(--accent)" : "var(--text-secondary)",
                      fontWeight: profile.tone === t ? "500" : "400", transition: "all 0.15s",
                    }}>{t}</button>
                  ))}
                </div>
              </Section>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "4px" }}>
                <button onClick={saveProfile} disabled={saving} style={{
                  background: "linear-gradient(135deg, #f97316, #ea580c)",
                  border: "none", borderRadius: "9px", padding: "10px 24px",
                  fontSize: "13.5px", fontWeight: "600", color: "#fff", cursor: "pointer",
                  opacity: saving ? 0.7 : 1, transition: "opacity 0.15s",
                  boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
                }}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                {saved && (
                  <span style={{ fontSize: "13px", color: "var(--green)", display: "flex", alignItems: "center", gap: "5px" }}>
                    ✓ Saved successfully
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── FAQS TAB ── */}
          {tab === "faqs" && (
            <div className="fade-in">

              {/* Import zone */}
              {!importPreview ? (
                <div style={{
                  background: "var(--bg-card)", border: "1px dashed rgba(249,115,22,0.35)",
                  borderRadius: "12px", padding: "20px 22px", marginBottom: "20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
                }}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "3px" }}>
                      Import / Update FAQs
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Upload a JSON file to bulk-import or update FAQs. Export your current list below, modify offline, then re-upload.
                    </div>
                  </div>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: "7px",
                    padding: "9px 18px", borderRadius: "8px", cursor: "pointer",
                    background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                    fontSize: "12.5px", fontWeight: "500", color: "var(--accent)",
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    <span>📂</span> Upload setup file
                    <input type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
                  </label>
                </div>
              ) : (
                <div style={{
                  background: "var(--bg-card)", border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: "12px", padding: "20px 22px", marginBottom: "20px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                    <span style={{ fontSize: "18px" }}>✅</span>
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--text-primary)" }}>
                        {importData?.business?.name || "Setup file loaded"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {importData?.faqs?.length || 0} FAQs · {importData?.business?.industry || ""}{importData?.exported_at ? " · Exported " + new Date(importData.exported_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto", marginBottom: "16px" }}>
                    {(importData?.faqs || []).slice(0, 8).map((f: any, i: number) => (
                      <div key={i} style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)",
                        borderRadius: "8px", padding: "10px 12px",
                      }}>
                        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)", marginBottom: "3px" }}>{f.question}</div>
                        <div style={{ fontSize: "12px", color: f.answer ? "var(--text-secondary)" : "var(--text-muted)", fontStyle: f.answer ? "normal" : "italic" }}>
                          {f.answer || "No answer yet"}
                        </div>
                      </div>
                    ))}
                    {(importData?.faqs?.length || 0) > 8 && (
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "6px 0" }}>
                        + {importData.faqs.length - 8} more FAQs in file
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={applyImport} disabled={importing} style={{
                      background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none",
                      borderRadius: "8px", padding: "9px 20px", fontSize: "13px",
                      fontWeight: "600", color: "#fff", cursor: "pointer", opacity: importing ? 0.7 : 1,
                    }}>
                      {importing ? "Importing…" : `Apply — import ${importData?.faqs?.length || 0} FAQs →`}
                    </button>
                    <button onClick={() => { setImportPreview(false); setImportData(null); }} style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
                      borderRadius: "8px", padding: "9px 16px", fontSize: "13px",
                      color: "var(--text-secondary)", cursor: "pointer",
                    }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                    {faqs.length} FAQ{faqs.length !== 1 ? "s" : ""} · Vela uses these to auto-answer visitor questions
                  </p>
                  {syncResult && (
                    <span style={{
                      fontSize: "12px", fontWeight: "500",
                      color: syncResult.status === "synced" ? "var(--green)" : "rgba(239,68,68,0.8)",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}>
                      {syncResult.status === "synced"
                        ? `Voice AI synced (${syncResult.faq_count} FAQs live)`
                        : "Sync failed — check Retell config"}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={syncVoiceAI} disabled={syncing || faqs.length === 0} style={{
                    background: syncing ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    borderRadius: "8px", padding: "7px 14px", fontSize: "12.5px",
                    color: "rgba(129,140,248,1)", fontWeight: "500", cursor: syncing ? "wait" : "pointer",
                    display: "flex", alignItems: "center", gap: "5px",
                    opacity: syncing ? 0.7 : 1, transition: "opacity 0.15s",
                  }}>
                    <span style={{
                      display: "inline-block", width: "13px", height: "13px",
                      ...(syncing ? { animation: "spin 1s linear infinite" } : {}),
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                      </svg>
                    </span>
                    {syncing ? "Syncing..." : "Push to Voice AI"}
                  </button>
                  <button onClick={exportFaqs} disabled={faqs.length === 0} style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
                    borderRadius: "8px", padding: "7px 14px", fontSize: "12.5px",
                    color: "var(--text-secondary)", fontWeight: "500", cursor: "pointer",
                  }}>
                    Export Excel
                  </button>
                  <button onClick={exportFaqsAsJson} disabled={faqs.length === 0} style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)",
                    borderRadius: "8px", padding: "7px 14px", fontSize: "12.5px",
                    color: "var(--text-secondary)", fontWeight: "500", cursor: "pointer",
                  }}>
                    Export JSON
                  </button>
                  <button onClick={() => setNewFaq({ question: "", answer: "", category: "general", active: true })} style={{
                    background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                    borderRadius: "8px", padding: "7px 14px", fontSize: "12.5px",
                    color: "var(--accent)", fontWeight: "500", cursor: "pointer",
                  }}>
                    + Add FAQ
                  </button>
                </div>
              </div>

              {newFaq && (
                <FAQEditor faq={newFaq} onChange={setNewFaq} onSave={() => saveFaq(newFaq)} onCancel={() => setNewFaq(null)} isNew />
              )}

              {faqs.length === 0 && !newFaq ? (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "40px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", marginBottom: "10px" }}>💬</div>
                  <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "500", marginBottom: "4px" }}>No FAQs yet</div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Add common questions so Claude can auto-answer them instantly.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {faqs.map(faq => (
                    <div key={faq.id}>
                      {editingFaqId === faq.id ? (
                        <FAQEditor faq={faq} onChange={updated => setFaqs(faqs.map(f => f.id === faq.id ? updated : f))}
                          onSave={() => saveFaq(faq)} onCancel={() => setEditingFaqId(null)} />
                      ) : (
                        <div style={{
                          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                          borderRadius: "12px", padding: "16px 18px",
                          opacity: faq.active ? 1 : 0.5, transition: "opacity 0.15s",
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "13.5px", fontWeight: "500", color: "var(--text-primary)", marginBottom: "5px" }}>
                                {faq.question}
                              </div>
                              <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                {faq.answer}
                              </div>
                              {faq.category && (
                                <span style={{ display: "inline-block", marginTop: "8px", fontSize: "10px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: "4px", padding: "2px 7px" }}>
                                  {faq.category}
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                              <button onClick={() => toggleFaq(faq)} title={faq.active ? "Disable" : "Enable"} style={{
                                width: "34px", height: "20px", borderRadius: "10px", border: "none", cursor: "pointer",
                                background: faq.active ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)",
                                position: "relative", transition: "background 0.2s",
                              }}>
                                <div style={{
                                  width: "14px", height: "14px", borderRadius: "50%",
                                  background: faq.active ? "var(--green)" : "var(--text-muted)",
                                  position: "absolute", top: "3px",
                                  left: faq.active ? "17px" : "3px", transition: "left 0.2s",
                                }} />
                              </button>
                              <button onClick={() => setEditingFaqId(faq.id!)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: "6px", padding: "5px 10px", fontSize: "11.5px", color: "var(--text-secondary)", cursor: "pointer" }}>
                                Edit
                              </button>
                              <button onClick={() => setDeletingFaqId(faq.id!)} style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", padding: "5px 10px", fontSize: "11.5px", color: "rgba(239,68,68,0.6)", cursor: "pointer", position: "relative" }}>
                                Delete
                              </button>
                            </div>
                            {deletingFaqId === faq.id && (
                              <div style={{
                                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                                background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
                                zIndex: 9999,
                              }} onClick={() => setDeletingFaqId(null)}>
                                <div onClick={e => e.stopPropagation()} style={{
                                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                                  borderRadius: 12, padding: "24px 28px", maxWidth: 340,
                                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                                }}>
                                  <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.5 }}>
                                    Delete this FAQ? This can&apos;t be undone.
                                  </p>
                                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                    <button onClick={() => setDeletingFaqId(null)} style={{
                                      padding: "7px 16px", borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                                      background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)",
                                      color: "var(--text-secondary)", cursor: "pointer",
                                    }}>Cancel</button>
                                    <button onClick={async () => { await deleteFaq(faq.id!); setDeletingFaqId(null); }} style={{
                                      padding: "7px 16px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                                      background: "#dc2626", border: "none",
                                      color: "#fff", cursor: "pointer",
                                    }}>Delete</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CHATBOT SETTINGS TAB ── */}
          {tab === "automation" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              <Section title="Chatbot Name & Greeting" subtitle="Customize how Vela introduces itself to visitors">
                <div style={{ background: "rgba(232,113,74,0.06)", border: "1px solid rgba(232,113,74,0.15)", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 28 }}>🐾</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Meet Vela</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      Your AI chatbot is named <strong style={{ color: "var(--accent)" }}>Vela</strong>. When visitors open the chat, Vela introduces itself and uses your FAQ knowledge base to answer questions. If Vela can't answer confidently, it directs visitors to call your phone number.
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  <strong>Default greeting:</strong> <em>"Hi [Name]! I'm Vela, your assistant at {profile.name || "your business"}. How can I help you today?"</em>
                </div>
              </Section>

              <Section title="Test Your Chatbot" subtitle="Preview how Vela responds to visitors">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <a
                    href={`/test-chat?business_id=${businessId}`}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 18px", borderRadius: 8,
                      background: "linear-gradient(135deg, #f97316, #ea580c)",
                      color: "#fff", fontSize: 13, fontWeight: 600,
                      textDecoration: "none", cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
                    }}
                  >
                    💬 Open Test Chat
                  </a>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Opens a test page where you can chat with Vela using your FAQ data
                  </span>
                </div>
              </Section>

              <Section title="Widget Embed Code" subtitle="Add this one line to any website to enable your live chat widget">
                <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "14px 16px", fontFamily: "'Geist Mono', monospace", fontSize: "12px", color: "var(--accent)", lineHeight: 1.7, wordBreak: "break-all" }}>
                  {`<script src="https://app.frontdeskreply.com/widget.js" data-business-id="${businessId}" data-agent-name="${profile.name || 'Assistant'}" data-color="#E8714A"></script>`}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Paste this before the closing <code style={{ color: "var(--text-secondary)" }}>&lt;/body&gt;</code> tag on your website. The chat widget will appear automatically.
                </div>
              </Section>

              <Section title="How Your Chatbot Works" subtitle="Your AI chatbot handles all visitor conversations automatically">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { icon: "💬", label: "Instant AI Responses", sub: "Visitors get replies in 2-3 seconds, 24/7 — no manual approval needed" },
                    { icon: "📚", label: "FAQ-Powered Answers", sub: "Your chatbot uses the FAQ Knowledge Base above to answer questions accurately" },
                    { icon: "📥", label: "Lead Capture", sub: "Every visitor provides their name, email, and optionally phone before chatting" },
                    { icon: "🔄", label: "Continuous Learning", sub: "Add new FAQs based on common questions you see in Analytics to improve accuracy" },
                    { icon: "📱", label: "Phone Fallback", sub: "When the AI isn't confident, it directs visitors to call your business number" },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontSize: "18px", flexShrink: 0 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{item.label}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <div style={{ background: "var(--bg-card)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "12px", padding: "16px 18px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "18px" }}>💡</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)", marginBottom: "3px" }}>Pro tip: Keep your FAQs updated</div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Check the <a href="/analytics" style={{ color: "var(--accent)", textDecoration: "none" }}>Analytics</a> page to see what visitors are asking most. If a common question isn't in your FAQ list, add it to improve your chatbot's accuracy.
                  </div>
                </div>
              </div>

              {/* Voice AI Section */}
              <Section title="Vela Voice AI" subtitle={voiceEnabled ? "Your AI receptionist is live and answering calls" : "Pro plan feature — Vela answers phone calls using your FAQs"}>
                {currentPlan !== "pro" ? (
                  /* Not Pro — show upgrade prompt */
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <span style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}>📞</span>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Vela Voice AI — Pro Plan Feature</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                      Vela can answer phone calls using the same FAQs and personality as your chat widget. Callers get instant AI-powered answers 24/7.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                      Upgrade to Pro — $199/mo
                    </a>
                  </div>
                ) : voiceEnabled ? (
                  /* Pro + Voice enabled — show active status */
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 18px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px" }}>
                      <span style={{ fontSize: "28px" }}>📞</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--green)" }}>Voice AI Active</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Vela is answering calls at this number</div>
                      </div>
                      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "10px 16px" }}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Your Vela Number</div>
                        <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent)", letterSpacing: "0.02em" }}>{voicePhone}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {[
                        { icon: "📞", label: "Dedicated Voice Number", sub: `Vela answers all calls to ${voicePhone}` },
                        { icon: "↪️", label: "Call Forwarding", sub: `Forward your main business number to ${voicePhone} when you're unavailable` },
                        { icon: "📝", label: "Call Transcripts", sub: "Every call is transcribed and saved to Past Conversations" },
                        { icon: "📥", label: "Caller Lead Capture", sub: "Callers are automatically added to your Lead Database" },
                        { icon: "⏱️", label: "200 Minutes Included", sub: "Additional minutes are $0.20/min. Calls auto-end after 5 minutes." },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: "16px", flexShrink: 0 }}>{item.icon}</span>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{item.label}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{item.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Pro but Voice not enabled — show Enable button */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "24px" }}>
                    <span style={{ fontSize: "40px" }}>📞</span>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>Enable Vela Voice AI</div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "400px" }}>
                        Vela will answer phone calls using your FAQs. A dedicated phone number will be assigned automatically. 200 minutes/month included in your Pro plan.
                      </div>
                    </div>
                    {provisionError && (
                      <div style={{ padding: "10px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "13px", color: "#ef4444" }}>
                        {provisionError}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        setProvisioning(true);
                        setProvisionError("");
                        try {
                          const res = await fetch(`${API}/voice/provision?business_id=${businessId}`, { method: "POST" });
                          const data = await res.json();
                          if (data.phone_number) {
                            setVoiceEnabled(true);
                            setVoicePhone(data.phone_number);
                          } else {
                            setProvisionError(data.detail || data.message || "Provisioning failed. Please try again.");
                          }
                        } catch (e) {
                          setProvisionError("Network error. Please try again.");
                        } finally {
                          setProvisioning(false);
                        }
                      }}
                      disabled={provisioning}
                      style={{
                        padding: "14px 32px", borderRadius: "10px", fontSize: "15px", fontWeight: "700",
                        background: provisioning ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #f97316, #ea580c)",
                        color: "#fff", border: "none", cursor: provisioning ? "wait" : "pointer",
                        boxShadow: provisioning ? "none" : "0 4px 12px rgba(249,115,22,0.3)",
                        transition: "all 0.2s",
                      }}
                    >
                      {provisioning ? "Setting up your AI receptionist..." : "Enable Voice AI"}
                    </button>
                    {provisioning && (
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                        This takes about 10 seconds — creating your AI agent and assigning a phone number...
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* WhatsApp Integration — Enterprise Only */}
              <Section title="WhatsApp Integration" subtitle={currentPlan === "enterprise" ? "Vela answers WhatsApp messages using your FAQs" : "Enterprise plan feature — Vela responds to WhatsApp messages automatically"}>
                {currentPlan === "enterprise" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "10px" }}>
                      <span style={{ fontSize: "24px" }}>💬</span>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "#25D366" }}>WhatsApp Ready</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Configure your Twilio WhatsApp number to connect Vela.</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                      <strong style={{ color: "var(--text-secondary)" }}>Setup steps:</strong>
                      <br />1. In Twilio Console, enable WhatsApp on your Twilio number
                      <br />2. Complete Meta Business Verification (required by WhatsApp)
                      <br />3. Set the WhatsApp webhook URL to: <code style={{ color: "var(--accent)", fontSize: "11px" }}>https://api.frontdeskreply.com/api/v1/whatsapp/inbound</code>
                      <br />4. Customers message your number on WhatsApp → Vela responds instantly
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {[
                        { icon: "💬", label: "Same Vela AI", sub: "Uses your FAQs — same answers as chat and voice" },
                        { icon: "📥", label: "Lead Capture", sub: "WhatsApp contacts saved to your Lead Database" },
                        { icon: "📝", label: "Conversation History", sub: "All WhatsApp conversations saved to Past Conversations" },
                        { icon: "🌍", label: "Multi-Language", sub: "Vela responds in whatever language the customer writes" },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: "14px", flexShrink: 0 }}>{item.icon}</span>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-primary)" }}>{item.label}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <span style={{ fontSize: "28px", display: "block", marginBottom: "10px" }}>💬</span>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>WhatsApp Integration — Enterprise Plan Feature</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                      Vela can respond to WhatsApp messages using the same FAQs and personality. Customers message your number on WhatsApp and get instant AI answers.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                      Upgrade to Enterprise — $299/mo
                    </a>
                  </div>
                )}
              </Section>

              {/* Appointment Booking — Pro Only */}
              <Section title="Appointment Booking" subtitle={["pro","enterprise"].includes(currentPlan) ? "Connect your scheduling tool so Vela can book appointments" : "Pro plan feature — let Vela schedule appointments for your customers"}>
                {["pro","enterprise"].includes(currentPlan) ? (
                  <BookingSettings businessId={businessId} apiUrl={API} />
                ) : (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <span style={{ fontSize: "28px", display: "block", marginBottom: "10px" }}>📅</span>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Appointment Booking — Pro Plan Feature</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                      Connect your Calendly, Acuity, or any scheduling link. Vela will direct customers to book appointments directly during chat and phone conversations.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                      Upgrade to Pro — $199/mo
                    </a>
                  </div>
                )}
              </Section>

              {/* Proactive Chat Triggers — Growth+ */}
              <Section title="Proactive Chat" subtitle={["growth","pro","enterprise"].includes(currentPlan) ? "Auto-engage visitors after they spend time on your site" : "Growth plan feature — automatically start conversations with website visitors"}>
                {["growth","pro","enterprise"].includes(currentPlan) ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "13.5px", fontWeight: "500", color: "var(--text-primary)" }}>Auto-open chat after</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Vela will pop up with a greeting after this delay. Set to 0 to disable.</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <input type="range" min="0" max="60" step="5" value={proactiveDelay}
                          onChange={e => setProactiveDelay(parseInt(e.target.value))}
                          style={{ width: "120px", accentColor: "var(--accent)" }} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: proactiveDelay > 0 ? "var(--accent)" : "var(--text-muted)", minWidth: "45px" }}>
                          {proactiveDelay > 0 ? `${proactiveDelay}s` : "Off"}
                        </span>
                      </div>
                    </div>
                    <button onClick={async () => {
                      setProactiveSaving(true);
                      try {
                        await fetch(`${API}/settings/widget-proactive?business_id=${businessId}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ auto_open_delay: proactiveDelay }),
                        });
                      } finally { setProactiveSaving(false); }
                    }} disabled={proactiveSaving} style={{
                      background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none",
                      borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: "600",
                      color: "#fff", cursor: "pointer", alignSelf: "flex-start",
                      opacity: proactiveSaving ? 0.7 : 1,
                    }}>
                      {proactiveSaving ? "Saving..." : "Save Proactive Settings"}
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <span style={{ fontSize: "28px", display: "block", marginBottom: "10px" }}>💬</span>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Proactive Chat — Growth Plan Feature</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                      Automatically engage website visitors with a greeting after they spend time on your site. Increase conversations without waiting for them to click.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                      Upgrade to Growth — $149/mo
                    </a>
                  </div>
                )}
              </Section>

              {/* Widget Branding — Pro Only */}
              <Section title="Widget Branding" subtitle={["pro","enterprise"].includes(currentPlan) ? "Customize how your chatbot looks on your website" : "Pro plan feature — remove FrontdeskReply branding and customize your chatbot"}>
                {["pro","enterprise"].includes(currentPlan) ? (
                  <WidgetBranding businessId={businessId} apiUrl={API} />
                ) : (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <span style={{ fontSize: "28px", display: "block", marginBottom: "10px" }}>🎨</span>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Custom Branding — Pro Plan Feature</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                      Remove the "Powered by FrontdeskReply" badge, rename your chatbot, customize colors, and personalize the greeting message.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                      Upgrade to Pro — $199/mo
                    </a>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === "notifications" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Section title="Engagement Email Notifications" subtitle="Get an email summary after each customer interaction">
                <NotifRow
                  label="Email me after each chat conversation"
                  sub="Receive a branded email with the full chat transcript after every website chat"
                  enabled={notifPrefs.notify_on_chat}
                  onChange={async (val) => {
                    setNotifPrefs({ ...notifPrefs, notify_on_chat: val });
                    setNotifSaving(true);
                    try {
                      await fetch(`${API}/settings/notifications?business_id=${businessId}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notify_on_chat: val }),
                      });
                    } finally { setNotifSaving(false); }
                  }}
                />
                <NotifRow
                  label="Email me after each phone call"
                  sub="Receive a recap email with caller info and call transcript after every voice call"
                  enabled={notifPrefs.notify_on_call}
                  locked={!["pro", "enterprise"].includes(currentPlan)}
                  lockedMessage="Upgrade to Pro to enable call notifications"
                  onChange={async (val) => {
                    setNotifPrefs({ ...notifPrefs, notify_on_call: val });
                    setNotifSaving(true);
                    try {
                      await fetch(`${API}/settings/notifications?business_id=${businessId}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notify_on_call: val }),
                      });
                    } finally { setNotifSaving(false); }
                  }}
                />
                <NotifRow
                  label="Email me after each text message"
                  sub="Receive a summary email with the SMS exchange after every text conversation"
                  enabled={notifPrefs.notify_on_sms}
                  locked={!["pro", "enterprise"].includes(currentPlan)}
                  lockedMessage="Upgrade to Pro to enable SMS notifications"
                  onChange={async (val) => {
                    setNotifPrefs({ ...notifPrefs, notify_on_sms: val });
                    setNotifSaving(true);
                    try {
                      await fetch(`${API}/settings/notifications?business_id=${businessId}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notify_on_sms: val }),
                      });
                    } finally { setNotifSaving(false); }
                  }}
                />
              </Section>

              <Section title="Weekly Email Reports" subtitle="Automated weekly performance digest sent every Monday">
                <NotifRow
                  label="Send me a weekly email report every Monday"
                  sub="Receive a digest with your week's chat and call stats, new leads, and top questions asked"
                  enabled={notifPrefs.weekly_report_enabled}
                  locked={!["pro", "enterprise"].includes(currentPlan)}
                  lockedMessage="Upgrade to Pro to enable weekly reports"
                  onChange={async (val) => {
                    setNotifPrefs({ ...notifPrefs, weekly_report_enabled: val });
                    setNotifSaving(true);
                    try {
                      await fetch(`${API}/settings/notifications?business_id=${businessId}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ weekly_report_enabled: val }),
                      });
                    } finally { setNotifSaving(false); }
                  }}
                />
              </Section>

              {notifSaving && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>Saving...</div>
              )}
            </div>
          )}

          {/* ── EMAIL AUTO-REPLY TAB ── */}
          {tab === "email" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {!["growth", "pro", "enterprise"].includes(currentPlan) ? (
                <Section title="Email Auto-Reply" subtitle="Vela responds to customer emails using your FAQ knowledge base">
                  <div style={{ padding: "30px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>✉</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Email Auto-Reply — Growth Plan Feature
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "16px", maxWidth: "400px", margin: "0 auto 16px" }}>
                      Vela automatically replies to inbound customer emails using your FAQ knowledge base — just like your chatbot and phone AI.
                    </div>
                    <a href="/billing" style={{
                      display: "inline-block", padding: "10px 22px", borderRadius: "9px",
                      background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff",
                      fontWeight: "600", fontSize: "13px", textDecoration: "none",
                      boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
                    }}>Upgrade to Growth — $99/mo</a>
                  </div>
                </Section>
              ) : !emailEnabled ? (
                <Section title="Email Auto-Reply" subtitle="Vela responds to customer emails using your FAQ knowledge base">
                  <div style={{ padding: "30px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>✉</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Enable Email Auto-Reply
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "20px", maxWidth: "420px", margin: "0 auto 20px" }}>
                      When a customer emails you, Vela will automatically respond using your FAQ knowledge base — the same answers your chatbot and phone AI use.
                    </div>
                    <button onClick={async () => {
                      setEmailLoading(true);
                      try {
                        const res = await fetch(`${API}/settings/email-enable?business_id=${businessId}`, { method: "POST" });
                        if (res.ok) {
                          const data = await res.json();
                          setEmailEnabled(true);
                          setEmailAddress(data.forwarding_address);
                        }
                      } finally { setEmailLoading(false); }
                    }} disabled={emailLoading} style={{
                      background: "linear-gradient(135deg, #f97316, #ea580c)",
                      border: "none", borderRadius: "9px", padding: "12px 28px",
                      fontSize: "14px", fontWeight: "600", color: "#fff", cursor: emailLoading ? "wait" : "pointer",
                      opacity: emailLoading ? 0.7 : 1, boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
                    }}>
                      {emailLoading ? "Enabling..." : "Enable Email Auto-Reply"}
                    </button>
                  </div>
                </Section>
              ) : (
                <>
                  <Section title="Email Auto-Reply" subtitle="Vela is responding to customer emails using your FAQs">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "10px", marginBottom: "16px" }}>
                      <span style={{ color: "var(--green)", fontSize: "14px" }}>&#9679;</span>
                      <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--green)" }}>Email Auto-Reply Active</span>
                    </div>

                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "16px 18px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                        Your Forwarding Address
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--accent)", fontFamily: "var(--font-mono, monospace)", wordBreak: "break-all", flex: 1 }}>
                          {emailAddress}
                        </div>
                        <button onClick={() => {
                          navigator.clipboard.writeText(emailAddress);
                          setEmailCopied(true);
                          setTimeout(() => setEmailCopied(false), 2000);
                        }} style={{
                          background: emailCopied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${emailCopied ? "rgba(16,185,129,0.3)" : "var(--border-subtle)"}`,
                          borderRadius: "7px", padding: "6px 14px", fontSize: "12px", fontWeight: "500",
                          color: emailCopied ? "var(--green)" : "var(--text-secondary)", cursor: "pointer",
                        }}>
                          {emailCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </Section>

                  <Section title="Setup Instructions" subtitle="Forward your business email to the address above">
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "16px 18px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>Gmail</div>
                        <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                          <li>Open Gmail Settings (gear icon) &rarr; See all settings</li>
                          <li>Go to <strong>Forwarding and POP/IMAP</strong> tab</li>
                          <li>Click <strong>Add a forwarding address</strong></li>
                          <li>Paste: <strong style={{ color: "var(--accent)" }}>{emailAddress}</strong></li>
                          <li>Confirm the verification email, then select <strong>Forward a copy</strong></li>
                        </ol>
                      </div>
                      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "16px 18px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>Outlook / Microsoft 365</div>
                        <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                          <li>Go to Settings &rarr; Mail &rarr; <strong>Forwarding</strong></li>
                          <li>Check <strong>Enable forwarding</strong></li>
                          <li>Paste: <strong style={{ color: "var(--accent)" }}>{emailAddress}</strong></li>
                          <li>Check <strong>Keep a copy of forwarded messages</strong></li>
                          <li>Click <strong>Save</strong></li>
                        </ol>
                      </div>
                    </div>
                  </Section>

                  <Section title="Test & Manage" subtitle="Verify your setup or disable email auto-reply">
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button onClick={async () => {
                        setEmailLoading(true);
                        try {
                          const res = await fetch(`${API}/settings/email-test?business_id=${businessId}`, { method: "POST" });
                          if (res.ok) { setEmailTestSent(true); setTimeout(() => setEmailTestSent(false), 4000); }
                        } finally { setEmailLoading(false); }
                      }} disabled={emailLoading} style={{
                        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
                        borderRadius: "8px", padding: "9px 18px", fontSize: "12.5px",
                        color: "rgba(129,140,248,1)", fontWeight: "500", cursor: emailLoading ? "wait" : "pointer",
                      }}>
                        {emailTestSent ? "Test Sent! Check your inbox" : emailLoading ? "Sending..." : "Send Test Email"}
                      </button>
                      <button onClick={async () => {
                        setEmailLoading(true);
                        try {
                          const res = await fetch(`${API}/settings/email-disable?business_id=${businessId}`, { method: "POST" });
                          if (res.ok) { setEmailEnabled(false); setEmailAddress(""); }
                        } finally { setEmailLoading(false); }
                      }} disabled={emailLoading} style={{
                        background: "transparent", border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: "8px", padding: "9px 18px", fontSize: "12.5px",
                        color: "rgba(239,68,68,0.7)", fontWeight: "500", cursor: "pointer",
                      }}>
                        Disable Email Auto-Reply
                      </button>
                    </div>
                  </Section>
                </>
              )}

              {/* API Keys — Enterprise Only */}
              {/* Outbound Webhooks — Growth+ */}
              <Section title="Outbound Webhooks (Zapier / Make)" subtitle={["growth","pro","enterprise"].includes(currentPlan) ? "Fire events to external services when calls, chats, and leads happen" : "Growth plan feature — connect to Zapier, Make, or any webhook endpoint"}>
                {["growth","pro","enterprise"].includes(currentPlan) ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>Webhook URL</div>
                      <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="https://hooks.zapier.com/hooks/catch/... or https://hook.us1.make.com/..."
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", fontSize: "13px" }} />
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Events fired: <strong>call.ended</strong>, <strong>chat.ended</strong>, <strong>lead.created</strong>, <strong>email.received</strong>. Each event sends a JSON payload with the event type, timestamp, and relevant data.
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button onClick={async () => {
                        setWebhookSaving(true);
                        try {
                          await fetch(`${API}/settings/webhooks-config?business_id=${businessId}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ webhook_url: webhookUrl }),
                          });
                          setWebhookSaved(true);
                          setTimeout(() => setWebhookSaved(false), 3000);
                        } finally { setWebhookSaving(false); }
                      }} disabled={webhookSaving} style={{
                        background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none",
                        borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: "600",
                        color: "#fff", cursor: "pointer", opacity: webhookSaving ? 0.7 : 1,
                      }}>
                        {webhookSaving ? "Saving..." : "Save Webhook URL"}
                      </button>
                      {webhookSaved && <span style={{ fontSize: "12px", color: "var(--green)" }}>Saved</span>}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <div style={{ fontSize: "28px", marginBottom: "10px" }}>🔗</div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Outbound Webhooks — Growth Plan Feature</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                      Connect FrontDeskReply to Zapier, Make, or any webhook endpoint. Automatically fire events when calls end, chats finish, or new leads are captured.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                      Upgrade to Growth — $149/mo
                    </a>
                  </div>
                )}
              </Section>

              {/* API Keys — Enterprise Only */}
              <Section title="API Keys" subtitle={currentPlan === "enterprise" ? "Generate API keys for programmatic webhook access" : "Enterprise plan feature — authenticate external integrations with API keys"}>
                {currentPlan === "enterprise" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>Key Name</div>
                        <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="My Integration"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", fontSize: "13px" }} />
                      </div>
                      <button onClick={async () => {
                        setApiKeyLoading(true);
                        try {
                          const res = await fetch(`${API}/settings/api-keys?business_id=${businessId}`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newKeyName }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setGeneratedKey(data.key);
                            setApiKeys(prev => [{ id: data.id, key_prefix: data.key_prefix, name: newKeyName, created_at: new Date().toISOString(), active: true }, ...prev]);
                            setNewKeyName("Default");
                          }
                        } finally { setApiKeyLoading(false); }
                      }} disabled={apiKeyLoading} style={{
                        background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: "8px",
                        padding: "9px 18px", fontSize: "13px", fontWeight: "600", color: "#fff", cursor: "pointer",
                        whiteSpace: "nowrap", opacity: apiKeyLoading ? 0.7 : 1,
                      }}>
                        {apiKeyLoading ? "Generating..." : "Generate Key"}
                      </button>
                    </div>

                    {generatedKey && (
                      <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "14px 16px" }}>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--green)", marginBottom: "6px" }}>New API Key Generated — Copy it now (shown only once)</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <code style={{ flex: 1, fontSize: "12px", color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)", wordBreak: "break-all", background: "rgba(0,0,0,0.2)", padding: "8px 10px", borderRadius: "6px" }}>{generatedKey}</code>
                          <button onClick={() => { navigator.clipboard.writeText(generatedKey); }} style={{
                            background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", borderRadius: "6px",
                            padding: "6px 12px", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer",
                          }}>Copy</button>
                        </div>
                      </div>
                    )}

                    {apiKeys.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {apiKeys.filter(k => k.active).map(key => (
                          <div key={key.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{key.name}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)" }}>{key.key_prefix}</div>
                            </div>
                            <button onClick={async () => {
                              await fetch(`${API}/settings/api-keys/${key.id}?business_id=${businessId}`, { method: "DELETE" });
                              setApiKeys(prev => prev.map(k => k.id === key.id ? { ...k, active: false } : k));
                            }} style={{
                              background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px",
                              padding: "5px 12px", fontSize: "11px", color: "rgba(239,68,68,0.6)", cursor: "pointer",
                            }}>Revoke</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <div style={{ fontSize: "28px", marginBottom: "10px" }}>🔑</div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>API Keys — Enterprise Plan Feature</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.6 }}>
                      Generate API keys to authenticate external integrations and programmatic access to your FrontDeskReply webhooks.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                      Upgrade to Enterprise — $299/mo
                    </a>
                  </div>
                )}
              </Section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "20px 22px" }}>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "3px" }}>{title}</div>
        {subtitle && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, fullWidth, textarea }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; fullWidth?: boolean; textarea?: boolean;
}) {
  const style: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
    borderRadius: "8px", padding: "9px 12px", fontSize: "13px",
    color: "var(--text-primary)", outline: "none", fontFamily: "inherit",
    transition: "border-color 0.15s", resize: "vertical",
  };
  return (
    <div style={{ gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: "11.5px", fontWeight: "500", color: "var(--text-muted)", marginBottom: "6px", letterSpacing: "0.02em" }}>
        {label}
      </label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={style} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={style} />
      )}
    </div>
  );
}

function FAQEditor({ faq, onChange, onSave, onCancel, isNew }: {
  faq: FAQ; onChange: (f: FAQ) => void; onSave: () => void; onCancel: () => void; isNew?: boolean;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: "12px", padding: "16px 18px", marginBottom: "10px" }}>
      <div style={{ fontSize: "11.5px", fontWeight: "600", color: "var(--accent)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {isNew ? "New FAQ" : "Edit FAQ"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input value={faq.question} onChange={e => onChange({ ...faq, question: e.target.value })}
          placeholder="Question — e.g. Do you offer free estimates?" style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
        <textarea value={faq.answer} onChange={e => onChange({ ...faq, answer: e.target.value })}
          placeholder="Answer — e.g. Yes, we offer free estimates on all major repairs over $200." rows={3}
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
        <input value={faq.category} onChange={e => onChange({ ...faq, category: e.target.value })}
          placeholder="Category — e.g. pricing, scheduling, services" style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={onSave} style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: "7px", padding: "8px 18px", fontSize: "12.5px", fontWeight: "600", color: "#fff", cursor: "pointer" }}>
          {isNew ? "Add FAQ" : "Save Changes"}
        </button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: "7px", padding: "8px 14px", fontSize: "12.5px", color: "var(--text-secondary)", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function BookingSettings({ businessId, apiUrl }: { businessId: string; apiUrl: string }) {
  const [bookingUrl, setBookingUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/settings/booking?business_id=${businessId}`)
      .then(r => r.json())
      .then(d => { if (d.booking_url) setBookingUrl(d.booking_url); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [businessId, apiUrl]);

  async function saveBooking() {
    setSaving(true);
    try {
      await fetch(`${apiUrl}/settings/booking?business_id=${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_url: bookingUrl }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {bookingUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "10px" }}>
          <span style={{ fontSize: "20px" }}>&#9989;</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--green)" }}>Booking link connected</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Vela will direct customers to book appointments during conversations.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)", borderRadius: "10px" }}>
          <span style={{ fontSize: "20px" }}>&#128197;</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent)" }}>No booking link configured</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Add your Calendly, Acuity, or scheduling page URL below.</div>
          </div>
        </div>
      )}
      <div>
        <label style={{ display: "block", fontSize: "11.5px", fontWeight: "500", color: "var(--text-muted)", marginBottom: "6px" }}>Booking / Scheduling URL</label>
        <input
          type="url"
          value={bookingUrl}
          onChange={e => setBookingUrl(e.target.value)}
          placeholder="https://calendly.com/your-business/appointment"
          style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }}
        />
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
          Works with Calendly, Acuity Scheduling, Square Appointments, or any URL where customers can book.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[
          { icon: "&#128172;", label: "Chat", sub: "Vela shares the booking link when visitors want to schedule" },
          { icon: "&#128222;", label: "Phone", sub: "Vela tells callers she will text them the booking link after the call" },
          { icon: "&#128203;", label: "Lead Tracking", sub: "Booking requests are tracked in your conversation history" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "14px", flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: item.icon }} />
            <div>
              <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-primary)" }}>{item.label}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={saveBooking} disabled={saving} style={{
          background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: "9px",
          padding: "10px 24px", fontSize: "13.5px", fontWeight: "600", color: "#fff", cursor: "pointer",
          opacity: saving ? 0.7 : 1,
        }}>{saving ? "Saving..." : "Save Booking Link"}</button>
        {saved && <span style={{ fontSize: "13px", color: "var(--green)" }}>&#10003; Saved</span>}
      </div>
    </div>
  );
}

function WidgetBranding({ businessId, apiUrl }: { businessId: string; apiUrl: string }) {
  const [chatbotName, setChatbotName] = useState("Vela");
  const [greetingMsg, setGreetingMsg] = useState("");
  const [brandColor, setBrandColor] = useState("#E8714A");
  const [showPowered, setShowPowered] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/settings/widget-branding?business_id=${businessId}`)
      .then(r => r.json())
      .then(d => {
        if (d.chatbot_name) setChatbotName(d.chatbot_name);
        if (d.greeting_message) setGreetingMsg(d.greeting_message);
        if (d.brand_color) setBrandColor(d.brand_color);
        if (d.show_powered_by !== undefined) setShowPowered(d.show_powered_by);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [businessId, apiUrl]);

  async function saveBranding() {
    setSaving(true);
    try {
      await fetch(`${apiUrl}/settings/widget-branding?business_id=${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbot_name: chatbotName, greeting_message: greetingMsg, brand_color: brandColor, show_powered_by: showPowered }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={{ display: "block", fontSize: "11.5px", fontWeight: "500", color: "var(--text-muted)", marginBottom: "6px" }}>Chatbot Name</label>
          <input type="text" value={chatbotName} onChange={e => setChatbotName(e.target.value)} placeholder="Vela" style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Displayed in the chat header and greeting</div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11.5px", fontWeight: "500", color: "var(--text-muted)", marginBottom: "6px" }}>Brand Color</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} style={{ width: "40px", height: "36px", border: "1px solid var(--border-subtle)", borderRadius: "6px", cursor: "pointer", background: "none" }} />
            <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} style={{ flex: 1, padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", outline: "none", fontFamily: "monospace" }} />
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Chat bubble, header, and send button color</div>
        </div>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "11.5px", fontWeight: "500", color: "var(--text-muted)", marginBottom: "6px" }}>Custom Greeting Message</label>
        <input type="text" value={greetingMsg} onChange={e => setGreetingMsg(e.target.value)} placeholder={`Hi! I'm ${chatbotName} from your business. How can I help?`} style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Leave blank for default greeting</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>Show &ldquo;Powered by FrontdeskReply&rdquo; badge</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Toggle off to white-label the widget</div>
        </div>
        <button onClick={() => setShowPowered(!showPowered)} style={{
          width: "42px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
          background: showPowered ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}>
          <div style={{
            width: "18px", height: "18px", borderRadius: "50%",
            background: showPowered ? "var(--green)" : "var(--text-muted)",
            position: "absolute", top: "3px",
            left: showPowered ? "21px" : "3px", transition: "left 0.2s",
          }} />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={saveBranding} disabled={saving} style={{
          background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: "9px",
          padding: "10px 24px", fontSize: "13.5px", fontWeight: "600", color: "#fff", cursor: "pointer",
          opacity: saving ? 0.7 : 1,
        }}>{saving ? "Saving..." : "Save Branding"}</button>
        {saved && <span style={{ fontSize: "13px", color: "var(--green)" }}>&#10003; Saved</span>}
      </div>
    </div>
  );
}

function NotifRow({ label, sub, enabled, onChange, locked, lockedMessage }: {
  label: string; sub: string; enabled: boolean;
  onChange?: (val: boolean) => void; locked?: boolean; lockedMessage?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", opacity: locked ? 0.55 : 1 }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</div>
        {locked && lockedMessage && (
          <div style={{ fontSize: "11px", color: "rgba(251,191,36,0.85)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>🔒</span> {lockedMessage}
          </div>
        )}
      </div>
      <button onClick={() => { if (!locked && onChange) onChange(!enabled); }} style={{
        width: "38px", height: "22px", borderRadius: "11px", border: "none",
        cursor: locked ? "not-allowed" : "pointer",
        background: enabled ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          width: "16px", height: "16px", borderRadius: "50%",
          background: enabled ? "var(--green)" : "var(--text-muted)",
          position: "absolute", top: "3px",
          left: enabled ? "19px" : "3px", transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}
