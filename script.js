/* ==========================================================================
   LIFORA — Application logic
   Everything here runs against an in-memory mock "database" (plain JS
   objects/arrays). No network calls are made — this is a self-contained
   front-end prototype: every screen reads and writes the same shared state,
   so an action in one portal (e.g. a nurse confirming a triage priority)
   is reflected immediately in every other screen that depends on it
   (the live queue, the dashboard summary, the audit log, notifications).
   ========================================================================== */

(function () {
  "use strict";

  /* ========================================================================
     1. MOCK DATABASE
     ======================================================================== */

  const STATUSES = ["Waiting", "Under Assessment", "Treatment", "Admitted", "ICU", "Discharged", "LAMA/DAMA", "Transferred", "Deceased"];
  const TERMINAL_STATUSES = ["Discharged", "LAMA/DAMA", "Transferred", "Deceased"];
  const PRIORITY_WEIGHT = { RED: 4, ORANGE: 3, YELLOW: 2, GREEN: 1 };
  const PRIORITY_LABEL = { RED: "🔴 RED — Immediate", ORANGE: "🟠 ORANGE — Very Urgent", YELLOW: "🟡 YELLOW — Urgent", GREEN: "🟢 GREEN — Less Urgent" };
  const ESCALATION_THRESHOLD = { RED: 10, ORANGE: 20 };
  const DEPTS = ["Emergency", "Trauma", "Cardiology", "General Medicine", "Pediatrics"];

  let nextPatientSeq = 9200;
  let nextDocSeq = 3000;

  const db = {
    patients: [
      { id: "LF-8841", name: "Aarav Rao", arrival: "Ambulance", priority: "RED", waitingMin: 3, dept: "Emergency", status: "Under Assessment" },
      { id: "UNK-0472", name: "Unknown-Male-40", arrival: "Ambulance", priority: "RED", waitingMin: 8, dept: "Trauma", status: "Waiting" },
      { id: "LF-1190", name: "Priya Nair", arrival: "Walk-in", priority: "ORANGE", waitingMin: 14, dept: "Cardiology", status: "Waiting" },
      { id: "LF-3387", name: "Devraj Singh", arrival: "Walk-in", priority: "YELLOW", waitingMin: 40, dept: "General Medicine", status: "Waiting" },
      { id: "LF-9021", name: "Fatima Sheikh", arrival: "Referred", priority: "YELLOW", waitingMin: 22, dept: "General Medicine", status: "Under Assessment" },
      { id: "LF-5510", name: "Karan Mehta", arrival: "Walk-in", priority: "GREEN", waitingMin: 25, dept: "General Medicine", status: "Waiting" },
      { id: "LF-6602", name: "Sara Thomas", arrival: "Walk-in", priority: "GREEN", waitingMin: 12, dept: "Pediatrics", status: "Waiting" }
    ],

    documents: [
      { id: "DOC-1001", type: "Lab Reports", date: "2026-01-14", doctor: "Dr. S. Bhatt, City Hospital", fileName: "HbA1c_report_jan2026.pdf", notes: "Routine diabetes review", aiSummary: "HbA1c within target range. No acute abnormalities flagged. Continue current management plan and confirm with your physician." },
      { id: "DOC-1002", type: "Prescriptions", date: "2026-01-14", doctor: "Dr. S. Bhatt, City Hospital", fileName: "insulin_lantus_rx.pdf", notes: "", aiSummary: "Active prescription for Insulin (Lantus), 10 units nightly. Cross-checked against current medication list." },
      { id: "DOC-1003", type: "Imaging", date: "2021-08-02", doctor: "Sunrise Clinic", fileName: "left_wrist_xray.pdf", notes: "Post-fracture follow-up", aiSummary: "Imaging shows a healed distal radius fracture with no signs of malunion. Findings appear consistent with prior clinical notes." },
      { id: "DOC-1004", type: "Discharge Summaries", date: "2019-11-20", doctor: "City Hospital — General Surgery", fileName: "appendectomy_discharge.pdf", notes: "", aiSummary: "Uncomplicated laparoscopic appendectomy. Discharged in stable condition with standard post-operative guidance." },
      { id: "DOC-1005", type: "Vaccination", date: "2025-06-10", doctor: "City Hospital", fileName: "vaccination_record_2025.pdf", notes: "", aiSummary: "Vaccination record up to date, no missed doses identified for the standard adult schedule reviewed." },
      { id: "DOC-1006", type: "Diagnosis", date: "2016-04-03", doctor: "Dr. S. Bhatt, City Hospital", fileName: "t1d_diagnosis_note.pdf", notes: "Initial diagnosis", aiSummary: "Diagnosis note indicates newly identified Type 1 Diabetes with insulin therapy initiated." }
    ],

    auditLog: [
      { action: "Medical document viewed", user: "Dr. S. Bhatt", patient: "Aarav Rao", type: "access", time: Date.now() - 1000 * 60 * 40 },
      { action: "QR access granted", user: "City Hospital ER", patient: "Aarav Rao", type: "qr", time: Date.now() - 1000 * 60 * 60 * 3 },
      { action: "Triage modified", user: "N. Kulkarni", patient: "Priya Nair", type: "triage", time: Date.now() - 1000 * 60 * 60 * 5 }
    ],

    notifications: [
      { title: "🚑 Critical patient arriving — ETA 7 minutes", meta: "Ambulance · Road traffic accident, suspected internal bleeding", time: Date.now() - 1000 * 60 * 2 },
      { title: "Triage confirmed — RED", meta: "Aarav Rao · LF-8841 · Emergency", time: Date.now() - 1000 * 60 * 6 },
      { title: "Emergency contact notified", meta: "Meera Rao (Spouse) · SMS + Call", time: Date.now() - 1000 * 60 * 9 }
    ],

    wards: [
      { name: "Emergency", total: 12, occupied: 8, reserved: 1 },
      { name: "ICU", total: 10, occupied: 8, reserved: 1 },
      { name: "General", total: 40, occupied: 27, reserved: 2 }
    ],

    blood: [
      { group: "O Negative", units: 6, max: 10 },
      { group: "O Positive", units: 9, max: 12 },
      { group: "A Positive", units: 7, max: 10 },
      { group: "A Negative", units: 2, max: 8 },
      { group: "B Positive", units: 5, max: 10 },
      { group: "B Negative", units: 1, max: 8 },
      { group: "AB Positive", units: 4, max: 8 },
      { group: "AB Negative", units: 1, max: 6 }
    ],

    escalated: new Set(),

    consentSettings: { bloodAllergies: true, medications: true, conditions: true, fullVault: false, contacts: true }
  };

  // Bed objects are generated once from the ward summary above.
  db.wards.forEach(w => {
    w.beds = [];
    for (let i = 1; i <= w.total; i++) {
      let status = "available";
      if (i <= w.occupied) status = "occupied";
      else if (i <= w.occupied + w.reserved) status = "reserved";
      w.beds.push({ n: i, status });
    }
  });

  /* ========================================================================
     2. UTILITIES
     ======================================================================== */

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $all = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + " min ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + " hr ago";
    return Math.floor(hrs / 24) + " d ago";
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowClock() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function logAudit(action, user, patient, type) {
    db.auditLog.unshift({ action, user, patient, type, time: Date.now() });
    if (db.auditLog.length > 80) db.auditLog.length = 80;
    if (viewIsActive("p-access")) renderPatientAccessTable();
    if (viewIsActive("ad-audit")) renderAdminAuditTable();
  }

  function pushNotification(title, meta) {
    db.notifications.unshift({ title, meta, time: Date.now() });
    if (db.notifications.length > 50) db.notifications.length = 50;
    if (viewIsActive("h-notifications")) renderNotifList();
  }

  function viewIsActive(viewId) {
    const el = document.getElementById("view-" + viewId);
    return !!(el && el.classList.contains("active"));
  }

  function activePatients() {
    return db.patients.filter(p => !TERMINAL_STATUSES.includes(p.status));
  }

  function badgeClassForPriority(p) {
    return { RED: "badge-red", ORANGE: "badge-orange", YELLOW: "badge-yellow", GREEN: "badge-green" }[p] || "badge-muted";
  }

  function priorityDot(p) {
    return { RED: "🔴", ORANGE: "🟠", YELLOW: "🟡", GREEN: "🟢" }[p] || "⚪";
  }

  function aiActionFor(p) {
    return {
      RED: "Immediate physician assessment",
      ORANGE: "Rapid assessment within 15 min",
      YELLOW: "Assessment within 60 min",
      GREEN: "Stable — can safely wait"
    }[p.priority] || "Assess when available";
  }

  /* ========================================================================
     3. NAVIGATION — portal switching + generic sidebar view switching
     ======================================================================== */

  const ROLE_MAP = {
    public: { name: "Guest", tag: "Public site", initials: "GU" },
    patient: { name: "Aarav Rao", tag: "Patient", initials: "AR" },
    hospital: { name: "Dr. S. Bhatt", tag: "Emergency Dept.", initials: "SB" },
    ambulance: { name: "R. Sen", tag: "Ambulance crew", initials: "RS" },
    resource: { name: "K. Verma", tag: "Blood Bank", initials: "KV" },
    admin: { name: "Hospital Admin", tag: "Administrator", initials: "HA" }
  };

  function switchPortal(portalId) {
    $all(".portal-section").forEach(s => s.classList.toggle("active", s.id === "portal-" + portalId));
    $all(".pill").forEach(p => p.classList.toggle("active", p.dataset.portalLink === portalId));
    const role = ROLE_MAP[portalId] || ROLE_MAP.public;
    $("#currentRoleName").textContent = role.name;
    $("#currentRoleTag").textContent = role.tag;
    const avatar = $(".avatar");
    if (avatar) avatar.textContent = role.initials;
    window.scrollTo({ top: 0, behavior: "auto" });

    // Re-render whichever sub-view is currently showing in that portal so
    // it reflects the latest shared state.
    const section = document.getElementById("portal-" + portalId);
    if (section) {
      const activeView = section.querySelector(".view.active");
      if (activeView) runRenderer(activeView.id.replace("view-", ""));
    }
  }

  function showView(section, viewId) {
    if (!section) return;
    $all(".view", section).forEach(v => v.classList.toggle("active", v.id === "view-" + viewId));
    $all(".portal-nav a[data-view]", section).forEach(a => a.classList.toggle("active", a.dataset.view === viewId));
    runRenderer(viewId);
  }

  const viewRenderers = {
    "p-vault": renderVaultGrid,
    "p-reports": renderReportsGrid,
    "p-access": renderPatientAccessTable,
    "h-dashboard": renderHospitalDashboard,
    "h-queue": renderFullQueueTable,
    "h-management": renderManagementTable,
    "h-beds": renderBedWards,
    "h-records": renderStaffRecordsGrid,
    "h-notifications": renderNotifList,
    "r-availability": renderBloodGrid,
    "ad-analytics": renderAnalytics,
    "ad-audit": renderAdminAuditTable
  };

  function runRenderer(viewId) {
    if (viewRenderers[viewId]) viewRenderers[viewId]();
  }

  function wireNavigation() {
    $all(".portal-nav a[data-view]").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        showView(a.closest(".portal-section"), a.dataset.view);
      });
    });

    $all("[data-view-jump]").forEach(btn => {
      btn.addEventListener("click", () => {
        const section = btn.closest(".portal-section");
        showView(section, btn.dataset.viewJump);
      });
    });

    $all("[data-portal-link]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        switchPortal(el.dataset.portalLink);
      });
    });

    $("#sidebarToggle").addEventListener("click", () => {
      document.getElementById("app").classList.toggle("sidebar-collapsed");
    });
  }

  /* ========================================================================
     4. HOSPITAL DASHBOARD + LIVE QUEUE
     ======================================================================== */

  function sortedActive(filterPriority, filterDept) {
    let list = activePatients();
    if (filterPriority && filterPriority !== "all") list = list.filter(p => p.priority === filterPriority);
    if (filterDept && filterDept !== "all") list = list.filter(p => p.dept === filterDept);
    return list.sort((a, b) => (PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]) || (b.waitingMin - a.waitingMin));
  }

  function renderTriageSummary() {
    const el = $("#triageSummary");
    if (!el) return;
    const list = activePatients();
    const counts = { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 };
    list.forEach(p => { if (counts[p.priority] != null) counts[p.priority]++; });
    el.innerHTML = `
      <div class="tsum-card tsum-red"><span>🔴 Red — Immediate</span><strong>${counts.RED}</strong></div>
      <div class="tsum-card tsum-orange"><span>🟠 Orange — Very Urgent</span><strong>${counts.ORANGE}</strong></div>
      <div class="tsum-card tsum-yellow"><span>🟡 Yellow — Urgent</span><strong>${counts.YELLOW}</strong></div>
      <div class="tsum-card tsum-green"><span>🟢 Green — Less Urgent</span><strong>${counts.GREEN}</strong></div>
      <div class="tsum-card tsum-total"><span>Active patients</span><strong>${list.length}</strong></div>
    `;
  }

  function queueRowHtml(p) {
    return `
      <tr>
        <td class="mono">${esc(p.id)}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.arrival)}</td>
        <td><span class="badge ${badgeClassForPriority(p.priority)}">${priorityDot(p.priority)} ${esc(p.priority)}</span></td>
        <td>${p.waitingMin} min</td>
        <td>${esc(p.dept)}</td>
        <td>${esc(p.status)}</td>
        <td>${esc(aiActionFor(p))}</td>
      </tr>`;
  }

  function renderDashQueuePreview() {
    const el = $("#dashQueuePreview");
    if (!el) return;
    const list = sortedActive("all", "all").slice(0, 5);
    el.innerHTML = `
      <thead><tr><th>Patient ID</th><th>Name</th><th>Arrival</th><th>Priority</th><th>Waiting</th><th>Dept</th><th>Status</th><th>AI Action</th></tr></thead>
      <tbody>${list.map(queueRowHtml).join("") || `<tr class="empty-row"><td colspan="8">No active patients right now.</td></tr>`}</tbody>`;
  }

  function renderEscalationList() {
    const el = $("#escalationList");
    if (!el) return;
    const escalating = activePatients().filter(p => ESCALATION_THRESHOLD[p.priority] && p.waitingMin >= ESCALATION_THRESHOLD[p.priority]);
    el.innerHTML = escalating.length
      ? escalating.map(p => `<div class="escalation-item"><span>⚠️ ${esc(p.name)} — ${esc(p.priority)}, waiting ${p.waitingMin} min</span><span>${esc(p.dept)}</span></div>`).join("")
      : `<p class="escalation-empty">No escalations right now — all priority patients are within threshold.</p>`;
  }

  function renderHospitalDashboard() {
    renderTriageSummary();
    renderDashQueuePreview();
    renderEscalationList();
  }

  function renderFullQueueTable() {
    const tbody = $("#fullQueueTable tbody");
    if (!tbody) return;
    const activeChip = $("#queueFilters .chip.active");
    const priority = activeChip ? activeChip.dataset.priority : "all";
    const dept = $("#deptFilter") ? $("#deptFilter").value : "all";
    const list = sortedActive(priority, dept);
    tbody.innerHTML = list.map(queueRowHtml).join("") || `<tr class="empty-row"><td colspan="8">No patients match this filter.</td></tr>`;
  }

  function wireQueueFilters() {
    $all("#queueFilters .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        $all("#queueFilters .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        renderFullQueueTable();
      });
    });
    const deptSel = $("#deptFilter");
    if (deptSel) deptSel.addEventListener("change", renderFullQueueTable);
  }

  /* ========================================================================
     5. PATIENT MANAGEMENT (status changes)
     ======================================================================== */

  function renderManagementTable() {
    const tbody = $("#managementTable tbody");
    if (!tbody) return;
    tbody.innerHTML = db.patients.map(p => `
      <tr data-pid="${esc(p.id)}">
        <td><strong>${esc(p.name)}</strong><br><span class="mono section-note">${esc(p.id)}</span></td>
        <td><span class="badge ${TERMINAL_STATUSES.includes(p.status) ? "badge-muted" : "badge-mint"}">${esc(p.status)}</span></td>
        <td>
          <select class="mgmt-status-select">
            ${STATUSES.map(s => `<option value="${s}" ${s === p.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </td>
      </tr>`).join("");

    $all(".mgmt-status-select", tbody).forEach(sel => {
      sel.addEventListener("change", (e) => {
        const row = e.target.closest("tr");
        const pid = row.dataset.pid;
        const patient = db.patients.find(p => p.id === pid);
        if (!patient) return;
        const oldStatus = patient.status;
        patient.status = e.target.value;
        logAudit("Patient status changed", "N. Kulkarni", patient.name, "status");
        pushNotification(`Status updated — ${patient.name}`, `${oldStatus} → ${patient.status}`);
        toast(`${patient.name} marked as ${patient.status}`);
        renderManagementTable();
        renderHospitalDashboard();
        if (viewIsActive("h-queue")) renderFullQueueTable();
      });
    });
  }

  /* ========================================================================
     6. AI-ASSISTED TRIAGE
     ======================================================================== */

  function computeTriageSuggestion(input) {
    let score = 0;
    const reasons = [];

    const consciousnessScore = { "Alert": 0, "Responds to voice": 2, "Responds to pain": 3, "Unresponsive": 4 }[input.consciousness] || 0;
    if (consciousnessScore > 0) { score += consciousnessScore; reasons.push(`Consciousness level "${input.consciousness}" (+${consciousnessScore})`); }

    const hr = parseInt(input.hr, 10);
    if (!isNaN(hr)) {
      if (hr > 130 || hr < 45) { score += 2; reasons.push(`Heart rate ${hr} bpm outside safe range (+2)`); }
      else if (hr > 110) { score += 1; reasons.push(`Heart rate ${hr} bpm elevated (+1)`); }
    }

    const spo2 = parseInt(input.spo2, 10);
    if (!isNaN(spo2)) {
      if (spo2 < 90) { score += 3; reasons.push(`SpO₂ ${spo2}% critically low (+3)`); }
      else if (spo2 < 94) { score += 1; reasons.push(`SpO₂ ${spo2}% below normal (+1)`); }
    }

    const age = parseInt(input.age, 10);
    if (!isNaN(age) && (age < 5 || age > 70)) { score += 1; reasons.push(`Age ${age} — higher-risk age group (+1)`); }

    const text = `${input.symptoms || ""} ${input.history || ""}`.toLowerCase();
    const criticalKeywords = ["chest pain", "bleeding", "breathless", "unconscious", "unresponsive", "severe", "trauma", "accident", "stroke", "seizure", "internal bleeding", "cardiac"];
    let kwHits = 0;
    criticalKeywords.forEach(k => { if (text.includes(k)) kwHits++; });
    if (kwHits > 0) { score += Math.min(kwHits, 3); reasons.push(`Symptom/history flags "${criticalKeywords.filter(k => text.includes(k)).join(", ")}" (+${Math.min(kwHits, 3)})`); }

    let priority = "GREEN";
    if (score >= 6) priority = "RED";
    else if (score >= 4) priority = "ORANGE";
    else if (score >= 2) priority = "YELLOW";

    if (reasons.length === 0) reasons.push("No high-risk indicators entered — defaulting to the least urgent category.");

    return { priority, score, reasons };
  }

  let lastTriageSuggestion = null;

  function wireTriage() {
    const runBtn = $("#runTriageAI");
    if (!runBtn) return;

    runBtn.addEventListener("click", () => {
      const input = {
        symptoms: $("#tSymptoms").value,
        consciousness: $("#tConsciousness").value,
        hr: $("#tHR").value,
        bp: $("#tBP").value,
        spo2: $("#tSpo2").value,
        age: $("#tAge").value,
        history: $("#tHistory").value
      };
      const result = computeTriageSuggestion(input);
      lastTriageSuggestion = { ...result, input };

      $("#triageSuggestion").innerHTML = `
        <div class="triage-result">
          <span class="priority-tag ${badgeClassForPriority(result.priority)}">${priorityDot(result.priority)} ${PRIORITY_LABEL[result.priority]}</span>
          <div class="triage-reasoning"><strong>Why:</strong><br>${result.reasons.map(r => "• " + esc(r)).join("<br>")}</div>
        </div>`;
      $("#triageSuggestion").classList.remove("triage-suggestion-empty");
      $("#triageControls").style.display = "flex";
      // Remove any leftover modify/override sub-panel from a previous run
      const existingPanel = $("#triageSubPanel");
      if (existingPanel) existingPanel.remove();
    });

    $("#triageConfirm").addEventListener("click", () => finalizeTriage(lastTriageSuggestion.priority, "confirmed"));
    $("#triageModify").addEventListener("click", () => openTriageSubPanel("modify"));
    $("#triageOverride").addEventListener("click", () => openTriageSubPanel("override"));
  }

  function openTriageSubPanel(mode) {
    const existing = $("#triageSubPanel");
    if (existing) existing.remove();
    const panel = document.createElement("div");
    panel.id = "triageSubPanel";
    panel.className = "triage-final";
    panel.style.textAlign = "left";
    panel.innerHTML = `
      <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--ink-2);margin-top:8px;">
        ${mode === "modify" ? "Select the corrected priority" : "Override reason"}
        ${mode === "modify"
          ? `<select id="triageSubSelect" style="border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);">
              ${["RED", "ORANGE", "YELLOW", "GREEN"].map(p => `<option value="${p}">${p}</option>`).join("")}
            </select>`
          : `<input id="triageSubReason" type="text" placeholder="e.g. Clinical judgement — patient decompensating" style="border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);">`
        }
      </label>
      <button class="btn btn-primary btn-sm" id="triageSubSave" style="margin-top:10px;">${mode === "modify" ? "Save modified priority" : "Save override"}</button>
    `;
    $("#triageSuggestion").after(panel);

    $("#triageSubSave").addEventListener("click", () => {
      if (mode === "modify") {
        const chosen = $("#triageSubSelect").value;
        finalizeTriage(chosen, "modified");
      } else {
        const reason = $("#triageSubReason").value.trim() || "Clinical judgement override";
        finalizeTriage(lastTriageSuggestion.priority, "overridden", reason);
      }
    });
  }

  function finalizeTriage(priority, action, reason) {
    const input = lastTriageSuggestion ? lastTriageSuggestion.input : {};
    const name = (input.symptoms ? "New Triage Patient" : "New Triage Patient");
    nextPatientSeq++;
    const patient = {
      id: "LF-" + nextPatientSeq,
      name: name + " #" + nextPatientSeq,
      arrival: "Walk-in",
      priority,
      waitingMin: 0,
      dept: "Emergency",
      status: "Waiting"
    };
    db.patients.unshift(patient);

    const verb = action === "confirmed" ? "Triage confirmed" : action === "modified" ? "Triage modified" : "Triage overridden";
    logAudit(verb, "N. Kulkarni", patient.name, "triage");
    pushNotification(`${verb} — ${priority}`, reason ? `${patient.name} · ${reason}` : `${patient.name} · added to live queue`);
    toast(`${verb}: ${patient.name} added to the queue as ${priority}`);

    const sub = $("#triageSubPanel");
    if (sub) sub.remove();
    $("#triageSuggestion").innerHTML += `<p class="triage-final">✅ ${esc(verb)} — ${esc(patient.name)} added to the live queue.</p>`;
    $("#triageControls").style.display = "none";

    renderHospitalDashboard();
    if (viewIsActive("h-queue")) renderFullQueueTable();
    if (viewIsActive("h-management")) renderManagementTable();
  }

  /* ========================================================================
     7. PATIENT IDENTIFICATION (biometric simulation)
     ======================================================================== */

  function wireIdentification() {
    const startBtn = $("#startBiometric");
    if (!startBtn) return;
    startBtn.addEventListener("click", () => {
      $("#idStep1").classList.remove("active");
      $("#idStep2").classList.add("active");
      $("#scanBar").style.width = "0%";
      requestAnimationFrame(() => { $("#scanBar").style.width = "100%"; });
      setTimeout(() => {
        $("#idStep2").classList.remove("active");
        $("#idStep3").classList.add("active");
        logAudit("Identity verified via biometric match", "R. Sen", "Aarav Rao", "access");
        toast("Identity verified — match found");
      }, 1500);
    });
  }

  /* ========================================================================
     8. QR — patient side (share) + staff side (scanner)
     ======================================================================== */

  function wirePatientQR() {
    const btn = $("#simulateScanBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const card = btn.closest(".qr-card");
      let panel = $("#qrConsentPanel");
      if (panel) panel.remove();
      btn.disabled = true;
      btn.textContent = "Requesting…";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Simulate hospital scan";
        panel = document.createElement("div");
        panel.id = "qrConsentPanel";
        panel.className = "card";
        panel.style.marginTop = "14px";
        panel.style.textAlign = "left";
        panel.innerHTML = `
          <h3 style="margin-bottom:6px;">Access request</h3>
          <p class="section-note" style="margin-bottom:14px;">City Hospital ER is requesting access to your health information.</p>
          <div class="quick-actions">
            <button class="btn btn-primary btn-sm" id="qrAllowBtn">Allow</button>
            <button class="btn btn-ghost btn-sm" id="qrDenyBtn">Deny</button>
          </div>`;
        card.after(panel);
        $("#qrAllowBtn").addEventListener("click", () => {
          logAudit("QR access granted", "City Hospital ER", "Aarav Rao", "qr");
          pushNotification("QR access granted", "City Hospital ER · Blood group, allergies, medications, conditions");
          toast("Access granted to City Hospital ER");
          panel.remove();
        });
        $("#qrDenyBtn").addEventListener("click", () => {
          logAudit("QR access denied", "City Hospital ER", "Aarav Rao", "qr");
          toast("Access denied");
          panel.remove();
        });
      }, 900);
    });
  }

  function wireStaffScanner() {
    const btn = $("#staffScanBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const requestCard = $("#consentRequestCard");
      const resultEl = $("#consentResult");
      requestCard.style.display = "block";
      resultEl.innerHTML = `<p class="section-note">Waiting for patient approval…</p>`;
      setTimeout(() => {
        resultEl.innerHTML = `
          <p style="color:var(--primary-700);font-weight:700;margin-bottom:10px;">✅ Access granted — Emergency Snapshot unlocked</p>
          <button class="btn btn-primary btn-sm" data-view-jump="h-snapshot">Open Emergency Snapshot</button>`;
        wireNavigation_singleJump(resultEl);
        logAudit("QR access granted", "Emergency Staff", "Aarav Rao", "qr");
        toast("Patient approved access request");
      }, 1400);
    });
  }

  // Newly-injected [data-view-jump] buttons (added after initial page load)
  // need their own listener bound, since the global wireNavigation() only
  // runs once at startup.
  function wireNavigation_singleJump(container) {
    $all("[data-view-jump]", container).forEach(btn => {
      btn.addEventListener("click", () => {
        const section = btn.closest(".portal-section");
        showView(section, btn.dataset.viewJump);
      });
    });
  }

  /* ========================================================================
     9. EMERGENCY REGISTRATION
     ======================================================================== */

  function wireRegistration() {
    const form = $("#registrationForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const isUnknown = $("#regIdentityStatus").value.includes("Unknown");
      nextPatientSeq++;
      const rawName = $("#regName").value.trim();
      const id = isUnknown ? "UNK-" + nextPatientSeq : "LF-" + nextPatientSeq;
      const name = rawName || (isUnknown ? `Unknown-Patient-${nextPatientSeq}` : `New Patient #${nextPatientSeq}`);

      const patient = {
        id, name,
        arrival: $("#regArrivalMode").value,
        priority: "YELLOW",
        waitingMin: 0,
        dept: $("#regDept").value,
        status: "Waiting"
      };
      db.patients.unshift(patient);

      logAudit("Patient record created", "R. Sen", patient.name, "registration");
      pushNotification("New emergency registration", `${patient.name} · ${patient.dept} · ${$("#regComplaint").value || "No complaint noted"}`);
      toast(`${patient.name} registered — temporary ID ${id}`);

      $("#registrationStatus").innerHTML = `✅ <strong>${esc(patient.name)}</strong> registered with ID <span class="mono">${esc(id)}</span>. Pending triage — the AI Triage screen can now assess this patient.`;
      form.reset();
      renderHospitalDashboard();
      if (viewIsActive("h-queue")) renderFullQueueTable();
      if (viewIsActive("h-management")) renderManagementTable();
    });
  }

  /* ========================================================================
     10. BED / WARD MANAGEMENT
     ======================================================================== */

  function bedCounts(ward) {
    const occ = ward.beds.filter(b => b.status === "occupied").length;
    const res = ward.beds.filter(b => b.status === "reserved").length;
    const avail = ward.beds.filter(b => b.status === "available").length;
    return { occ, res, avail };
  }

  function renderBedWards() {
    const el = $("#bedWards");
    if (!el) return;
    el.innerHTML = db.wards.map(ward => {
      const c = bedCounts(ward);
      return `
        <div class="ward-block" data-ward="${esc(ward.name)}">
          <h3>${esc(ward.name)} Ward</h3>
          <p class="section-note">${ward.total} beds · ${c.avail} available · ${c.occ} occupied · ${c.res} reserved — click a bed to update it</p>
          <div class="bed-grid">
            ${ward.beds.map(b => `<button class="bed bed-${b.status}" data-bed="${b.n}" title="Bed ${b.n} — ${b.status}">${b.n}</button>`).join("")}
          </div>
        </div>`;
    }).join("");

    $all(".bed", el).forEach(btn => {
      btn.addEventListener("click", () => {
        const wardName = btn.closest(".ward-block").dataset.ward;
        const ward = db.wards.find(w => w.name === wardName);
        const bed = ward.beds.find(b => b.n === parseInt(btn.dataset.bed, 10));
        const order = ["available", "occupied", "reserved"];
        bed.status = order[(order.indexOf(bed.status) + 1) % order.length];
        logAudit("Bed status updated", "Hospital Admin", `${wardName} · Bed ${bed.n}`, "beds");
        toast(`${wardName} bed ${bed.n} marked ${bed.status}`);
        renderBedWards();
      });
    });
  }

  /* ========================================================================
     11. MEDICAL VAULT / REPORTS / STAFF RECORDS
     ======================================================================== */

  let vaultFilter = "all";

  function docCardHtml(doc, opts) {
    opts = opts || {};
    return `
      <div class="doc-card">
        <div class="doc-card-top">
          <div>
            <h4>${esc(doc.fileName)}</h4>
            <div class="doc-meta">${esc(doc.type)} · ${esc(doc.date)}${doc.doctor ? " · " + esc(doc.doctor) : ""}</div>
          </div>
          <span class="badge badge-mint">${esc(doc.type)}</span>
        </div>
        ${doc.notes ? `<p style="font-size:12.8px;margin:0 0 6px;">${esc(doc.notes)}</p>` : ""}
        <div class="ai-summary"><strong>AI-generated summary · decision support</strong>${esc(doc.aiSummary)}</div>
        ${opts.authorizedView ? `<div class="doc-card-actions"><span class="badge badge-blue">Authorized access logged</span></div>` : ""}
      </div>`;
  }

  function renderVaultGrid() {
    const el = $("#vaultGrid");
    if (!el) return;
    const list = vaultFilter === "all" ? db.documents : db.documents.filter(d => d.type === vaultFilter);
    el.innerHTML = list.length ? list.map(d => docCardHtml(d)).join("") : `<p class="doc-empty">No documents in this category yet. Use "+ Upload document" to add one.</p>`;
  }

  function renderReportsGrid() {
    const el = $("#reportsGrid");
    if (!el) return;
    const list = db.documents.filter(d => d.type === "Lab Reports" || d.type === "Imaging");
    el.innerHTML = list.length ? list.map(d => docCardHtml(d)).join("") : `<p class="doc-empty">No lab or imaging reports uploaded yet.</p>`;
  }

  let staffRecordsLogged = false;
  function renderStaffRecordsGrid() {
    const el = $("#staffRecordsGrid");
    if (!el) return;
    el.innerHTML = db.documents.map(d => docCardHtml(d, { authorizedView: true })).join("");
    if (!staffRecordsLogged) {
      logAudit("Medical record accessed", "Dr. S. Bhatt", "Aarav Rao", "access");
      staffRecordsLogged = true;
    }
  }

  function wireVaultFilters() {
    $all("#vaultFilters .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        $all("#vaultFilters .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        vaultFilter = chip.dataset.cat;
        renderVaultGrid();
      });
    });
  }

  const AI_SUMMARY_TEMPLATES = {
    "Lab Reports": "No critical abnormalities flagged in this upload. Values appear broadly within reference range — please confirm interpretation with your physician.",
    "Prescriptions": "Prescription details recorded and cross-checked against your current medication list for potential duplicates.",
    "Imaging": "Imaging document stored. No automated interpretation performed — a radiologist's original report should be treated as authoritative.",
    "Discharge Summaries": "Discharge summary recorded. Key follow-up instructions should be reviewed with your care team.",
    "Vaccination": "Vaccination record added. No missed doses identified for the standard schedule reviewed.",
    "Diagnosis": "Diagnosis document stored and linked to your medical history timeline.",
    "Other": "Document stored in your Medical Vault. No structured summary could be generated automatically for this category."
  };

  function wireUploadModal() {
    const openBtn = $("#openUploadModal");
    const overlay = $("#uploadModalOverlay");
    const closeBtn = $("#closeUploadModal");
    const form = $("#uploadForm");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
      $("#uploadDate").value = todayStr();
      overlay.classList.add("open");
    });
    closeBtn.addEventListener("click", () => overlay.classList.remove("open"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const type = $("#uploadType").value;
      nextDocSeq++;
      const doc = {
        id: "DOC-" + nextDocSeq,
        type,
        date: $("#uploadDate").value || todayStr(),
        doctor: $("#uploadDoctor").value.trim(),
        fileName: $("#uploadFileName").value.trim() || `document_${nextDocSeq}.pdf`,
        notes: $("#uploadNotes").value.trim(),
        aiSummary: AI_SUMMARY_TEMPLATES[type] || AI_SUMMARY_TEMPLATES.Other
      };
      db.documents.unshift(doc);
      logAudit("Medical document uploaded", "Aarav Rao", "Aarav Rao", "upload");
      toast("Document uploaded — AI summary generated");
      overlay.classList.remove("open");
      form.reset();
      renderVaultGrid();
      renderReportsGrid();
    });
  }

  /* ========================================================================
     12. EMERGENCY CONTACTS — patient assistance alert
     ======================================================================== */

  function wireAlertContacts() {
    const btn = $("#alertContactsBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Notifying…";
      $("#alertContactsStatus").textContent = "";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Notify my emergency contacts";
        $("#alertContactsStatus").innerHTML = `✅ Meera Rao and Vikram Rao notified via SMS + Call at ${nowClock()}.`;
        logAudit("Emergency contact notified", "Aarav Rao", "Meera Rao, Vikram Rao", "contact");
        pushNotification("Emergency contacts notified", "Meera Rao (Primary), Vikram Rao (Secondary) · SMS + Call");
        toast("Emergency contacts notified");
      }, 1100);
    });
  }

  /* ========================================================================
     13. AMBULANCE PORTAL
     ======================================================================== */

  function wireAmbulance() {
    const form = $("#prearrivalForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const inputs = $all("input", form).map(i => i.value.trim());
        pushNotification("🚑 Pre-arrival information sent", inputs.filter(Boolean).join(" · ") || "Details sent to hospital");
        $("#prearrivalStatus").innerHTML = "✅ Sent to hospital — emergency team will prepare before arrival.";
        toast("Pre-arrival information sent to hospital");
        logAudit("Ambulance pre-arrival info sent", "R. Sen", inputs[0] || "Unknown patient", "ambulance");
        form.reset();
      });
    }
    const handoverBtn = $("#confirmHandoverBtn");
    if (handoverBtn) {
      handoverBtn.addEventListener("click", () => {
        $("#handoverStatus").innerHTML = `✅ Handover confirmed at ${nowClock()}. Patient is now under hospital care.`;
        logAudit("Hospital handover confirmed", "R. Sen", "Incoming patient", "ambulance");
        toast("Handover confirmed");
      });
    }
  }

  /* ========================================================================
     14. RESOURCE PORTAL — blood availability
     ======================================================================== */

  function renderBloodGrid() {
    const el = $("#bloodGrid");
    if (!el) return;
    el.innerHTML = db.blood.map(b => {
      const pct = Math.round((b.units / b.max) * 100);
      const low = b.units / b.max < 0.25;
      return `
        <div class="blood-card ${low ? "blood-low" : ""}">
          <h4>${esc(b.group)}</h4>
          <div class="blood-bar"><div style="width:${pct}%;"></div></div>
          <div class="units">${b.units} of ${b.max} units${low ? " — low stock" : ""}</div>
        </div>`;
    }).join("");
  }

  /* ========================================================================
     15. NOTIFICATIONS
     ======================================================================== */

  function renderNotifList() {
    const el = $("#notifList");
    if (!el) return;
    el.innerHTML = db.notifications.slice(0, 25).map(n => `
      <li class="notif-item">
        <span class="n-dot"></span>
        <div>
          <div>${esc(n.title)}</div>
          <div class="section-note">${esc(n.meta)}</div>
          <time>${timeAgo(n.time)}</time>
        </div>
      </li>`).join("") || `<li class="notif-item">No notifications yet.</li>`;
  }

  /* ========================================================================
     16. AUDIT LOGS (patient access history + admin audit trail)
     ======================================================================== */

  function renderPatientAccessTable() {
    const tbody = $("#patientAccessTable tbody");
    if (!tbody) return;
    const list = db.auditLog.filter(a => ["access", "qr", "upload"].includes(a.type)).slice(0, 20);
    tbody.innerHTML = list.length ? list.map(a => {
      const d = new Date(a.time);
      return `<tr><td>${esc(a.user)}</td><td>${esc(a.action)}</td><td>${d.toLocaleDateString()}</td><td>${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td></tr>`;
    }).join("") : `<tr class="empty-row"><td colspan="4">No access recorded yet.</td></tr>`;
  }

  function renderAdminAuditTable() {
    const tbody = $("#adminAuditTable tbody");
    if (!tbody) return;
    const list = db.auditLog.slice(0, 30);
    tbody.innerHTML = list.length ? list.map(a => {
      const d = new Date(a.time);
      return `<tr><td>${esc(a.action)}</td><td>${esc(a.user)}</td><td>${esc(a.patient)}</td><td>${d.toLocaleDateString()}</td><td>${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td></tr>`;
    }).join("") : `<tr class="empty-row"><td colspan="5">No audit entries yet.</td></tr>`;
  }

  /* ========================================================================
     17. ADMIN ANALYTICS — bar charts + donut, built with plain SVG/DOM
     ======================================================================== */

  function buildBarChart(container, data, colorVar) {
    const max = Math.max(...data.map(d => d.v), 1);
    container.innerHTML = data.map(d => `
      <div class="bar-col">
        <span class="bar-value">${d.v}</span>
        <div class="bar" style="height:${Math.max((d.v / max) * 100, 3)}%;${colorVar ? `background:${colorVar};` : ""}"></div>
        <span class="bar-label">${esc(d.n)}</span>
      </div>`).join("");
  }

  function buildDonut(svgEl, legendEl, data) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const R = 15.915;
    let offset = 0;
    const circles = data.map(d => {
      const pct = (d.value / total) * 100;
      const circle = `<circle cx="21" cy="21" r="${R}" fill="transparent" stroke="${d.color}" stroke-width="6" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${-offset}"></circle>`;
      offset += pct;
      return circle;
    }).join("");
    svgEl.innerHTML = `<circle cx="21" cy="21" r="${R}" fill="transparent" stroke="var(--bg-soft)" stroke-width="6"></circle>${circles}`;
    legendEl.innerHTML = data.map(d => `<li><span class="sw" style="background:${d.color};"></span>${esc(d.label)} — ${d.value}%</li>`).join("");
  }

  function renderAnalytics() {
    const workloadEl = $("#workloadChart");
    if (workloadEl) {
      buildBarChart(workloadEl, [
        { n: "Emergency", v: 48 }, { n: "Trauma", v: 22 }, { n: "Cardiology", v: 15 },
        { n: "Gen. Med", v: 34 }, { n: "Pediatrics", v: 19 }
      ]);
    }
    const peakEl = $("#peakChart");
    if (peakEl) {
      buildBarChart(peakEl, [
        { n: "6am", v: 12 }, { n: "9am", v: 28 }, { n: "12pm", v: 35 }, { n: "3pm", v: 31 },
        { n: "6pm", v: 42 }, { n: "9pm", v: 38 }, { n: "12am", v: 19 }
      ], "var(--mint)");
    }
    const donutEl = $("#outcomeDonut");
    const legendEl = $("#outcomeLegend");
    if (donutEl && legendEl) {
      buildDonut(donutEl, legendEl, [
        { label: "Discharged", value: 58, color: "var(--green)" },
        { label: "Admitted", value: 24, color: "var(--blue)" },
        { label: "Transferred", value: 9, color: "var(--yellow)" },
        { label: "LAMA/DAMA", value: 6, color: "var(--orange)" },
        { label: "Deceased", value: 3, color: "var(--red)" }
      ]);
    }
  }

  /* ========================================================================
     18. EMERGENCY MODE + SIDEBAR
     ======================================================================== */

  function wireEmergencyMode() {
    const btn = $("#emergencyModeBtn");
    const overlay = $("#emergencyOverlay");
    const closeBtn = $("#closeEmergencyMode");
    if (!btn) return;
    btn.addEventListener("click", () => {
      overlay.classList.add("open");
      btn.classList.add("is-live");
    });
    closeBtn.addEventListener("click", () => {
      overlay.classList.remove("open");
      btn.classList.remove("is-live");
    });
  }

  /* ========================================================================
     19. LIVE SIMULATION — waiting times tick upward like a real ED board
     ======================================================================== */

  function tickLiveQueue() {
    let escalationFired = false;
    activePatients().forEach(p => {
      p.waitingMin += 1;
      const threshold = ESCALATION_THRESHOLD[p.priority];
      if (threshold && p.waitingMin === threshold) {
        pushNotification("⚠️ Triage escalation required", `${p.name} · ${p.priority} · waiting ${p.waitingMin} min`);
        logAudit("Escalation alert raised", "System", p.name, "escalation");
        escalationFired = true;
      }
    });

    if (viewIsActive("h-dashboard")) renderHospitalDashboard();
    if (viewIsActive("h-queue")) renderFullQueueTable();
    if (escalationFired) toast("⚠️ A patient has crossed the escalation threshold");
  }

  /* ========================================================================
     20. INIT
     ======================================================================== */

  function init() {
    wireNavigation();
    wireQueueFilters();
    wireTriage();
    wireIdentification();
    wirePatientQR();
    wireStaffScanner();
    wireRegistration();
    wireVaultFilters();
    wireUploadModal();
    wireAlertContacts();
    wireAmbulance();
    wireEmergencyMode();

    // Render the views that are active by default on first paint.
    renderHospitalDashboard();
    renderVaultGrid();

    setInterval(tickLiveQueue, 5000);

    toast("Welcome to Lifora — this is a live prototype with simulated data");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
