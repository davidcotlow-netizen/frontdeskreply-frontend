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

type Tab = "profile" | "faqs" | "automation" | "notifications";

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
  const [newFaq, setNewFaq] = useState<FAQ | null>(null);
  const [autoRespond, setAutoRespond] = useState(false);
  const [savingAutoRespond, setSavingAutoRespond] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("starter");

  // Import feature state
  const [importData, setImportData] = useState<any>(null);
  const [importPreview, setImportPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    Promise.all([
      fetch(`${API}/settings/profile?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/settings/faqs?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/settings/auto-respond?business_id=${businessId}`).then(r => r.json()),
      fetch(`${API}/billing/plan?business_id=${businessId}`).then(r => r.json()),
    ]).then(([p, f, ar, plan]) => {
      if (p && !p.detail) setProfile({ ...profile, ...p });
      if (f?.faqs) setFaqs(f.faqs);
      if (ar) setAutoRespond(ar.auto_respond_enabled || false);
      if (plan) setCurrentPlan(plan.plan_tier || "starter");
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

  async function toggleAutoRespond() {
    setSavingAutoRespond(true);
    const newVal = !autoRespond;
    try {
      await fetch(`${API}/settings/auto-respond?business_id=${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_respond_enabled: newVal }),
      });
      setAutoRespond(newVal);
    } finally {
      setSavingAutoRespond(false);
    }
  }

  async function saveFaq(faq: FAQ) {
    if (faq.id) {
      await fetch(`${API}/settings/faqs/${faq.id}?business_id=${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(faq),
      });
      setFaqs(faqs.map(f => f.id === faq.id ? faq : f));
    } else {
      const res = await fetch(`${API}/settings/faqs?business_id=${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(faq),
      });
      const data = await res.json();
      setFaqs([...faqs, data.faq]);
      setNewFaq(null);
    }
    setEditingFaqId(null);
  }

  async function deleteFaq(faqId: string) {
    await fetch(`${API}/settings/faqs/${faqId}?business_id=${businessId}`, { method: "DELETE" });
    setFaqs(faqs.filter(f => f.id !== faqId));
  }

  async function toggleFaq(faq: FAQ) {
    const updated = { ...faq, active: !faq.active };
    await fetch(`${API}/settings/faqs/${faq.id}?business_id=${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setFaqs(faqs.map(f => f.id === faq.id ? updated : f));
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
        const results = await Promise.all(
          importData.faqs
            .filter((f: any) => f.question)
            .map((f: any) =>
              fetch(`${API}/settings/faqs?business_id=${businessId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  question: f.question,
                  answer: f.answer || "",
                  category: "general",
                  active: true,
                }),
              }).then(r => r.json())
            )
        );
        const newFaqs = results.map((r: any) => r.faq).filter(Boolean);
        setFaqs(prev => [...prev, ...newFaqs]);
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
    { id: "automation", label: "Automation", icon: "⚡" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
  ];

  return (
    <div style={{ padding: "32px 36px", maxWidth: "860px" }}>

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

              <Section title="Business Info" subtitle="Basic details Claude uses when drafting replies">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <Field label="Business Name" value={profile.name} onChange={v => setProfile({ ...profile, name: v })} placeholder="Arctic Air HVAC" />
                  <Field label="Phone Number" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v })} placeholder="(346) 410-6022" />
                  <Field label="City / Service Area" value={profile.city} onChange={v => setProfile({ ...profile, city: v })} placeholder="Houston, TX" />
                  <Field label="Service Areas" value={profile.service_areas} onChange={v => setProfile({ ...profile, service_areas: v })} placeholder="Houston, Katy, Sugar Land" />
                </div>
              </Section>

              <Section title="Reply-To Email" subtitle="When a customer replies to an email from FrontdeskReply, their reply is routed here">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <Field
                    label="Owner / Reply-To Email"
                    value={profile.owner_email}
                    onChange={v => setProfile({ ...profile, owner_email: v })}
                    placeholder="you@yourbusiness.com"
                  />
                  <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "2px" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6, padding: "8px 12px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: "8px" }}>
                      💡 Customer follow-up replies go directly to this inbox. Full two-way conversation threading coming in v2.0.
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Hours & Availability" subtitle="Claude includes these when scheduling questions come in">
                <Field label="Business Hours" value={profile.hours} onChange={v => setProfile({ ...profile, hours: v })} placeholder="Mon–Fri 8am–6pm, Sat 9am–3pm" fullWidth />
              </Section>

              <Section title="Emergency Policy" subtitle="How Claude handles after-hours emergencies">
                <Field label="Emergency Policy" value={profile.emergency_policy} onChange={v => setProfile({ ...profile, emergency_policy: v })} placeholder="Call (346) 410-6022 for after-hours emergencies. On-call tech available 24/7." fullWidth textarea />
                <Field label="Emergency Contact Phone" value={profile.emergency_contact_phone} onChange={v => setProfile({ ...profile, emergency_contact_phone: v })} placeholder="+17135550100" fullWidth />
              </Section>

              <Section title="AI Response Tone" subtitle="How Claude sounds when writing replies for your business">
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
                      Import from setup file
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Upload a completed client onboarding form to bulk-import FAQs and profile info
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

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {faqs.length} FAQ{faqs.length !== 1 ? "s" : ""} · Claude uses these to auto-answer common questions
                </p>
                <button onClick={() => setNewFaq({ question: "", answer: "", category: "general", active: true })} style={{
                  background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                  borderRadius: "8px", padding: "7px 14px", fontSize: "12.5px",
                  color: "var(--accent)", fontWeight: "500", cursor: "pointer",
                }}>
                  + Add FAQ
                </button>
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
                              <button onClick={() => deleteFaq(faq.id!)} style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", padding: "5px 10px", fontSize: "11.5px", color: "rgba(239,68,68,0.6)", cursor: "pointer" }}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AUTOMATION TAB ── */}
          {tab === "automation" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {currentPlan === "starter" && (
                <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "12px", padding: "16px 18px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "20px" }}>🔒</span>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--accent)", marginBottom: "3px" }}>Available on Growth & Pro plans</div>
                    <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Starter plan always requires manual approval in the queue. Upgrade to Growth or Pro to enable automatic responses.
                    </div>
                    <a href="/billing" style={{ display: "inline-block", marginTop: "10px", fontSize: "12.5px", fontWeight: "600", color: "var(--accent)", textDecoration: "none" }}>Upgrade your plan →</a>
                  </div>
                </div>
              )}

              <div style={{ background: "var(--bg-card)", border: autoRespond ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-subtle)", borderRadius: "14px", padding: "20px 22px", opacity: currentPlan === "starter" ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Auto-Respond Without Approval
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "12px" }}>
                      When enabled, FrontdeskReply will automatically send replies for low-risk messages like FAQs without requiring you to click Approve. You will still see all sent messages in your dashboard.
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: autoRespond ? "var(--green)" : "var(--text-muted)", transition: "background 0.2s" }} />
                      <span style={{ fontSize: "12.5px", color: autoRespond ? "var(--green)" : "var(--text-muted)", fontWeight: "500" }}>
                        {autoRespond ? "Auto-respond is ON — AI replies go out automatically" : "Auto-respond is OFF — all messages wait for your approval"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => currentPlan !== "starter" && toggleAutoRespond()}
                    disabled={currentPlan === "starter" || savingAutoRespond}
                    style={{
                      width: "52px", height: "30px", borderRadius: "15px", border: "none",
                      cursor: currentPlan === "starter" ? "not-allowed" : "pointer",
                      background: autoRespond ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: "22px", height: "22px", borderRadius: "50%",
                      background: autoRespond ? "var(--green)" : "var(--text-muted)",
                      position: "absolute", top: "4px",
                      left: autoRespond ? "26px" : "4px",
                      transition: "left 0.2s, background 0.2s",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }} />
                  </button>
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "20px 22px" }}>
                <div style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>What gets auto-sent vs held for review</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>These rules are hardcoded and cannot be changed — they protect your business.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { label: "FAQ answers", sub: "High-confidence replies to common questions", auto: true },
                    { label: "General inquiries", sub: "Low-risk informational requests", auto: true },
                    { label: "Booking & quote requests", sub: "Held so you can confirm availability and pricing", auto: false },
                    { label: "Complaints", sub: "Always held — requires human judgment and tone", auto: false },
                    { label: "Billing & payment questions", sub: "Always held — financial sensitivity", auto: false },
                    { label: "Requests to speak to owner", sub: "Always held — explicit human request", auto: false },
                    { label: "Emergencies", sub: "Always escalated immediately with SMS alert to you", auto: false },
                    { label: "Low confidence messages", sub: "AI is unsure — always held for human review", auto: false },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{item.label}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>{item.sub}</div>
                      </div>
                      <span style={{
                        flexShrink: 0, marginLeft: "16px", marginTop: "2px",
                        fontSize: "11px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase",
                        padding: "3px 8px", borderRadius: "5px",
                        background: item.auto ? "rgba(16,185,129,0.1)" : "rgba(249,115,22,0.08)",
                        color: item.auto ? "var(--green)" : "var(--accent)",
                        border: item.auto ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(249,115,22,0.2)",
                      }}>
                        {item.auto ? "Auto-sends" : "Held for review"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === "notifications" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Section title="Emergency Alerts" subtitle="How you get notified when Claude detects an emergency message">
                <NotifRow label="SMS Alert" sub="Text message to your emergency contact phone" enabled={true} />
                <NotifRow label="Dashboard Alert" sub="Visual alert in the approval queue" enabled={true} />
              </Section>
              <Section title="Queue Activity" subtitle="Notifications for new messages and queue updates">
                <NotifRow label="New Lead Notification" sub="Alert when a new message arrives" enabled={true} />
                <NotifRow label="Daily Summary" sub="End-of-day recap of leads and response stats" enabled={false} />
              </Section>
              <div style={{ background: "var(--bg-card)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "12px", padding: "16px 18px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "18px" }}>ℹ️</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)", marginBottom: "3px" }}>Full notification controls coming soon</div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Email digests, Slack integration, and custom alert rules are on the roadmap.</div>
                </div>
              </div>
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

function NotifRow({ label, sub, enabled }: { label: string; sub: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</div>
      </div>
      <button onClick={() => setOn(!on)} style={{
        width: "38px", height: "22px", borderRadius: "11px", border: "none", cursor: "pointer",
        background: on ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          width: "16px", height: "16px", borderRadius: "50%",
          background: on ? "var(--green)" : "var(--text-muted)",
          position: "absolute", top: "3px",
          left: on ? "19px" : "3px", transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}
