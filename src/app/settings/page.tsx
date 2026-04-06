// ─────────────────────────────────────────────────────────────
// PATCH 1: Add these new state variables after your existing ones
// (around line 35, after const [currentPlan, setCurrentPlan]...)
// ─────────────────────────────────────────────────────────────

  const [importData, setImportData] = useState<any>(null);
  const [importPreview, setImportPreview] = useState(false);
  const [importing, setImporting] = useState(false);

// ─────────────────────────────────────────────────────────────
// PATCH 2: Add these two functions before your return() statement
// ─────────────────────────────────────────────────────────────

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
      // Apply profile fields
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
      // Apply AI settings
      if (importData.ai_settings) {
        const ai = importData.ai_settings;
        setProfile(prev => ({
          ...prev,
          tone: ai.tone?.toLowerCase().replace(/[^a-z ]/g, "") || prev.tone,
        }));
      }
      // Import FAQs — POST each one
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
        const newFaqs = results.map(r => r.faq).filter(Boolean);
        setFaqs(prev => [...prev, ...newFaqs]);
      }
      setImportPreview(false);
      setImportData(null);
      setTab("faqs");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setImporting(false);
    }
  }

// ─────────────────────────────────────────────────────────────
// PATCH 3: Replace your entire FAQs tab block with this
// Find: {tab === "faqs" && (
// Replace through the closing )}
// ─────────────────────────────────────────────────────────────

          {tab === "faqs" && (
            <div className="fade-in">

              {/* ── Import Zone ── */}
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
                /* ── Import Preview ── */
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
                        {importData?.faqs?.length || 0} FAQs · {importData?.business?.industry || ""} ·{" "}
                        {importData?.exported_at ? new Date(importData.exported_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>

                  {/* FAQ preview list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto", marginBottom: "16px" }}>
                    {(importData?.faqs || []).slice(0, 8).map((f: any, i: number) => (
                      <div key={i} style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)",
                        borderRadius: "8px", padding: "10px 12px",
                      }}>
                        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)", marginBottom: "3px" }}>
                          {f.question}
                        </div>
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
                      fontWeight: "600", color: "#fff", cursor: "pointer",
                      opacity: importing ? 0.7 : 1,
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

              {/* ── Existing FAQ list header ── */}
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
