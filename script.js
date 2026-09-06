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

    // Essential medicine coordination — a public-health availability view,
    // not a pharmacy or ordering system.
    medicines: [
      { name: "Paracetamol", category: "Analgesic", facility: "Rampura PHC", status: "Available" },
      { name: "ORS", category: "Rehydration", facility: "Rampura PHC", status: "Available" },
      { name: "Insulin", category: "Endocrine", facility: "City General Hospital", status: "Available" },
      { name: "Amoxicillin", category: "Antibiotic", facility: "Sundarpur PHC", status: "Low Stock" },
      { name: "Iron & Folic Acid", category: "Antenatal", facility: "Rampura PHC", status: "Available" },
      { name: "Amlodipine", category: "Cardiovascular", facility: "District Hospital", status: "Available" },
      { name: "Metformin", category: "Endocrine", facility: "City General Hospital", status: "Low Stock" },
      { name: "Anti-rabies vaccine", category: "Vaccine", facility: "Sundarpur PHC", status: "Unavailable" }
    ],

    // ---- ASHA / Community Health Worker data ----------------------------
    ashaPatients: [
      {
        id: "AP-1001", name: "Lakshmi Devi", age: 62, gender: "Female", phone: "9876500001",
        village: "Demo Village", emergencyContact: "Ramesh Devi (Son) · 9876500002",
        bloodGroup: "O Positive", allergies: "None known", conditions: "Hypertension, Type 2 Diabetes", medicines: "Amlodipine 5mg, Metformin 500mg",
        vitals: { bp: "158/96", pulse: 88, temp: 98.6, spo2: 96, resp: 19, weight: 58, sugar: 210 },
        symptoms: "Weakness, Dizziness", riskCategory: "Elderly", lastVisit: "2026-01-18", registeredBy: "Nurse Kulkarni",
        visits: [
          { date: "2026-01-05", vitals: { bp: "142/88", pulse: 82, temp: 98.4, spo2: 97, resp: 18, weight: 58, sugar: 180 }, notes: "Routine hypertension and blood glucose check.", recordedBy: "Nurse Kulkarni" },
          { date: "2026-01-18", vitals: { bp: "158/96", pulse: 88, temp: 98.6, spo2: 96, resp: 19, weight: 58, sugar: 210 }, notes: "Reports acute weakness and dizziness. Significantly elevated blood pressure and glucose.", recordedBy: "Nurse Kulkarni" }
        ]
      },
      {
        id: "AP-1002", name: "Bhura Singh", age: 68, gender: "Male", phone: "9876500003",
        village: "Rampura", emergencyContact: "Meena Singh · 9876500004",
        bloodGroup: "B Positive", allergies: "Penicillin", conditions: "Hypertension, Type 2 Diabetes", medicines: "Metformin, Amlodipine",
        vitals: { bp: "148/94", pulse: 92, temp: 98.2, spo2: 95, resp: 20, weight: 71, sugar: 190 },
        symptoms: "Dizziness, elevated blood pressure", riskCategory: "Elderly", lastVisit: "2026-01-15", registeredBy: "Nurse Kulkarni",
        visits: [
          { date: "2025-11-05", vitals: { bp: "138/88", pulse: 86, temp: 98.1, spo2: 96, resp: 18, weight: 72, sugar: 165 }, notes: "Routine hypertension follow-up", recordedBy: "Nurse Kulkarni" },
          { date: "2026-01-15", vitals: { bp: "148/94", pulse: 92, temp: 98.2, spo2: 95, resp: 20, weight: 71, sugar: 190 }, notes: "Dizziness, elevated blood pressure", recordedBy: "Nurse Kulkarni" }
        ]
      },
      {
        id: "AP-1003", name: "Kiran Patel", age: 6, gender: "Female", phone: "9876500005",
        village: "Sundarpur", emergencyContact: "Dipak Patel · 9876500006",
        bloodGroup: "A Positive", allergies: "None known", conditions: "None", medicines: "None",
        vitals: { bp: "96/60", pulse: 104, temp: 99.1, spo2: 97, resp: 22, weight: 19, sugar: 95 },
        symptoms: "Mild fever, cough", riskCategory: "Children", lastVisit: "2026-01-10", registeredBy: "Nurse Kulkarni",
        visits: [
          { date: "2026-01-10", vitals: { bp: "96/60", pulse: 104, temp: 99.1, spo2: 97, resp: 22, weight: 19, sugar: 95 }, notes: "Mild fever, cough", recordedBy: "Nurse Kulkarni" }
        ]
      }
    ],

    referrals: [
      {
        id: "LFR-00100", patientId: "AP-1002", patientName: "Bhura Singh",
        urgency: "HIGH", facility: "City General Hospital",
        reason: "Elevated blood pressure with dizziness — needs same-day evaluation.",
        status: "SENT", createdBy: "Nurse Kulkarni", time: Date.now() - 1000 * 60 * 40
      }
    ],

    followUps: [
      {
        id: "FU-9001", patientId: "AP-1001", patientName: "Lakshmi Devi",
        reason: "Hypertension & Diabetes Follow-Up", dueLabel: "Today",
        status: "Due", createdFrom: null
      }
    ],

    // Records an ASHA worker saved while offline, waiting to sync — see
    // the "Low-Connectivity Ready" section of the Health Worker dashboard.
    pendingSyncQueue: [],

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
     1b. PERSISTENCE — browser localStorage + cross-tab live sync
     ------------------------------------------------------------------------
     There is no server here, so this is NOT a real backend or a real
     database: it only shares data between tabs of THIS SAME browser, on
     THIS SAME computer. It cannot sync between two different phones/
     laptops — that genuinely requires a server, which is outside what
     three static files can do.

     What it DOES give you, honestly:
     - data survives a page refresh (previously everything reset)
     - open Lifora in two tabs (e.g. Ambulance in one, Hospital in
       another) and actions in one tab appear in the other automatically,
       via the browser's built-in "storage" event — no polling, no server.
     ======================================================================== */

  const STORAGE_KEY = "lifora_shared_state_sih2026_v2";

  // The one demo patient whose QR code the Patient portal generates, and
  // that the Hospital's camera scanner looks for. Keeping this as a single
  // constant (rather than duplicating the string) is what lets the two
  // screens agree on what a "successful scan" means.
  const DEMO_QR_PATIENT_ID = "LF-2231-9048";
  const DEMO_QR_PATIENT_NAME = "Aarav Rao";
  const DEMO_QR_PAYLOAD = "LIFORA-HEALTHID:" + DEMO_QR_PATIENT_ID;

  function saveDB() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      // Storage can fail (private browsing, quota, etc.) — the app still
      // works for the current tab, it just won't persist/sync. Fail quiet.
    }
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.patients) || !Array.isArray(parsed.ashaPatients)) return false;
      Object.assign(db, parsed);
      db.escalated = new Set(); // Set doesn't survive JSON; not relied on elsewhere.
      return true;
    } catch (e) {
      return false;
    }
  }

  function rerenderActiveView() {
    const section = document.querySelector(".portal-section.active");
    if (!section) return;
    const view = section.querySelector(".view.active");
    if (view) runRenderer(view.id.replace("view-", ""));
  }

  /* ========================================================================
     1c. LOGIN — Phone / Email OTP simulation
     ------------------------------------------------------------------------
     This is a prototype login flow, not real authentication: no SMS or
     email is actually sent, and there's no server checking a password
     against a database (there's no database that isn't this browser).
     It reproduces the OTP login *experience* for a demo, using one fixed
     demo phone number and one fixed demo email, each paired with a fixed
     demo OTP show directly in the UI so anyone can try it.
     ======================================================================== */

  const LOGIN_STORAGE_KEY = "lifora_login_v1";

  const DEMO_LOGIN = {
    phone: { value: "9265470008", otp: "140706", name: "Aarav Rao" },
    email: { value: "bs12054@gmail.com", otp: "041005", name: "Aarav Rao" }
  };

  let loginMethod = "phone";
  let pendingLoginTarget = "";

  function getLoginState() {
    try {
      return JSON.parse(localStorage.getItem(LOGIN_STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function setLoginState(state) {
    try { localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    updateSignInButton();
  }

  function clearLoginState() {
    try { localStorage.removeItem(LOGIN_STORAGE_KEY); } catch (e) {}
    updateSignInButton();
  }

  function updateSignInButton() {
    const btn = $("#signInBtn");
    if (!btn) return;
    const state = getLoginState();
    if (state) {
      btn.textContent = "✓ Signed in";
      btn.classList.add("is-signed-in");
      btn.title = `Signed in as ${state.name} (via ${state.method === "phone" ? "phone" : "email"}) — click to sign out`;
    } else {
      btn.textContent = "Sign In";
      btn.classList.remove("is-signed-in");
      btn.title = "";
    }
  }

  function resetLoginStep() {
    $("#loginStepEntry").style.display = "block";
    $("#loginStepOtp").style.display = "none";
    $("#loginError").textContent = "";
  }

  // Reveals the whole app and hides the auth gate. There is no "open the
  // gate" counterpart with its own function — the gate is the default
  // state (body starts with class="pre-auth" in the HTML), so nothing
  // needs to explicitly show it on load; it's only ever hidden.
  function revealApp() {
    document.body.classList.remove("pre-auth");
  }

  function showAuthGate() {
    document.body.classList.add("pre-auth");
    resetLoginStep();
    $("#loginPhoneInput").value = "";
    $("#loginEmailInput").value = "";
  }

  function wireLogin() {
    const signInBtn = $("#signInBtn");
    if (signInBtn) {
      signInBtn.addEventListener("click", () => {
        clearLoginState();
        toast("Signed out");
        showAuthGate();
      });
    }

    const quickDemoBtn = $("#quickDemoSignInBtn");
    if (quickDemoBtn) {
      quickDemoBtn.addEventListener("click", () => {
        setLoginState({ method: "demo", target: "9265470008", name: "Aarav Rao", time: Date.now() });
        logAudit("Demo sign in", "Aarav Rao", "Aarav Rao", "login");
        toast("Signed in as Aarav Rao (Demo mode)");
        revealApp();
      });
    }

    $all(".login-method-switch .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        $all(".login-method-switch .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        loginMethod = chip.dataset.method;
        $("#loginPhoneField").style.display = loginMethod === "phone" ? "block" : "none";
        $("#loginEmailField").style.display = loginMethod === "email" ? "block" : "none";
        resetLoginStep();
      });
    });

    $("#sendOtpBtn").addEventListener("click", () => {
      const err = $("#loginError");
      err.textContent = "";
      if (loginMethod === "phone") {
        const val = $("#loginPhoneInput").value.trim();
        if (!/^\d{10}$/.test(val)) { err.textContent = "Enter a valid 10-digit phone number."; return; }
        pendingLoginTarget = val;
        $("#otpSentTo").textContent = `OTP sent to +91 ${val} (simulated)`;
      } else {
        const val = $("#loginEmailInput").value.trim();
        if (!/^\S+@\S+\.\S+$/.test(val)) { err.textContent = "Enter a valid email address."; return; }
        pendingLoginTarget = val;
        $("#otpSentTo").textContent = `OTP sent to ${val} (simulated)`;
      }
      const demo = loginMethod === "phone" ? DEMO_LOGIN.phone : DEMO_LOGIN.email;
      $("#otpHint").innerHTML = `Demo OTP: <span class="mono">${demo.otp}</span>`;
      $("#loginOtpInput").value = "";
      $("#loginStepEntry").style.display = "none";
      $("#loginStepOtp").style.display = "block";
      $("#loginOtpInput").focus();
      toast("OTP sent (simulated)");
    });

    $("#changeLoginMethodBtn").addEventListener("click", resetLoginStep);

    $("#verifyOtpBtn").addEventListener("click", () => {
      const err = $("#loginError");
      err.textContent = "";
      const entered = $("#loginOtpInput").value.trim();
      const demo = loginMethod === "phone" ? DEMO_LOGIN.phone : DEMO_LOGIN.email;
      const targetMatches = loginMethod === "phone"
        ? pendingLoginTarget === demo.value
        : pendingLoginTarget.toLowerCase() === demo.value.toLowerCase();

      if (!targetMatches) {
        err.textContent = `This demo only recognizes the demo ${loginMethod === "phone" ? "number" : "email"} shown above.`;
        return;
      }
      if (entered !== demo.otp) {
        err.textContent = "Incorrect OTP — please try again.";
        return;
      }

      setLoginState({ method: loginMethod, target: pendingLoginTarget, name: demo.name, time: Date.now() });
      logAudit("Patient signed in", demo.name, demo.name, "login");
      toast(`Signed in as ${demo.name} via ${loginMethod === "phone" ? "phone OTP" : "email OTP"}`);
      revealApp();
    });

    // Enter key submits the current step, since there's no way to click
    // "away" from a mandatory gate — keyboard-only sign-in must work.
    $("#loginPhoneInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#sendOtpBtn").click(); });
    $("#loginEmailInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#sendOtpBtn").click(); });
    $("#loginOtpInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#verifyOtpBtn").click(); });
  }

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
    saveDB();
  }

  function pushNotification(title, meta) {
    db.notifications.unshift({ title, meta, time: Date.now() });
    if (db.notifications.length > 50) db.notifications.length = 50;
    if (viewIsActive("h-notifications")) renderNotifList();
    saveDB();
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
    asha: { name: "Nurse Kulkarni", tag: "Community Health Worker", initials: "NK" },
    hospital: { name: "Dr. S. Bhatt", tag: "Emergency Dept.", initials: "SB" },
    ambulance: { name: "R. Sen", tag: "Ambulance crew", initials: "RS" },
    resource: { name: "K. Verma", tag: "Blood Bank", initials: "KV" },
    admin: { name: "Hospital Admin", tag: "Administrator", initials: "HA" }
  };

  function getCurrentPortalId() {
    const activeSection = document.querySelector(".portal-section.active");
    if (!activeSection) return "public";
    return activeSection.id.replace("portal-", "");
  }

  function navigateTo(portalId, viewId) {
    const targetPortal = portalId || getCurrentPortalId() || "public";
    const section = document.getElementById("portal-" + targetPortal);
    if (!section) return;

    if (targetPortal !== "hospital" || viewId !== "h-scanner") {
      stopScannerCamera();
    }

    // 1. Activate target portal section only
    $all(".portal-section").forEach(s => s.classList.toggle("active", s.id === "portal-" + targetPortal));
    $all(".portal-switcher .pill").forEach(p => p.classList.toggle("active", p.dataset.portalLink === targetPortal));

    // 2. Update role chip in topbar
    const role = ROLE_MAP[targetPortal] || ROLE_MAP.public;
    const roleNameEl = $("#currentRoleName");
    const roleTagEl = $("#currentRoleTag");
    const avatarEl = $(".avatar");
    if (roleNameEl) roleNameEl.textContent = role.name;
    if (roleTagEl) roleTagEl.textContent = role.tag;
    if (avatarEl) avatarEl.textContent = role.initials;

    // 3. Determine view to display
    let targetViewId = viewId;
    if (!targetViewId) {
      const curActive = section.querySelector(".view.active");
      if (curActive) {
        targetViewId = curActive.id.replace("view-", "");
      } else {
        const firstNav = section.querySelector(".portal-nav a[data-view]");
        if (firstNav) {
          targetViewId = firstNav.dataset.view;
        } else {
          const firstView = section.querySelector(".view");
          if (firstView) targetViewId = firstView.id.replace("view-", "");
        }
      }
    }

    const targetViewEl = document.getElementById("view-" + targetViewId);
    // 4. Ensure strictly ONE view is active in this portal
    $all(".view", section).forEach(v => {
      v.classList.toggle("active", targetViewEl ? v === targetViewEl : false);
    });

    // If target view wasn't found or was invalid, activate the first available view in the section
    if (!section.querySelector(".view.active")) {
      const fallbackView = section.querySelector(".view");
      if (fallbackView) {
        fallbackView.classList.add("active");
        targetViewId = fallbackView.id.replace("view-", "");
      }
    }

    // 5. Update sidebar navigation active item
    $all(".portal-nav a[data-view]", section).forEach(a => {
      a.classList.toggle("active", a.dataset.view === targetViewId);
    });

    // 6. Execute active view renderer safely
    if (targetViewId) {
      runRenderer(targetViewId);
    }

    // 7. Reset scroll to top
    window.scrollTo({ top: 0, behavior: "auto" });
    const content = section.querySelector(".content");
    if (content) content.scrollTo({ top: 0, behavior: "auto" });
  }

  function switchPortal(portalId, viewId) {
    navigateTo(portalId, viewId);
  }

  function showView(section, viewId) {
    const portalId = section && section.dataset && section.dataset.portal ? section.dataset.portal : getCurrentPortalId();
    navigateTo(portalId, viewId);
  }

  const viewRenderers = {
    "p-vault": renderVaultGrid,
    "p-reports": renderReportsGrid,
    "p-access": renderPatientAccessTable,
    "p-qr": renderPatientQRCode,
    "h-dashboard": renderHospitalDashboard,
    "h-queue": renderFullQueueTable,
    "h-management": renderManagementTable,
    "h-beds": renderBedWards,
    "h-records": renderStaffRecordsGrid,
    "h-notifications": renderNotifList,
    "r-availability": renderBloodGrid,
    "r-medicines": renderMedicineTable,
    "ad-analytics": renderAnalytics,
    "ad-audit": renderAdminAuditTable,
    "h-triage": renderTriageApplyToOptions,
    "h-referrals": renderHospitalReferrals,
    "asha-dashboard": renderAshaDashboard,
    "asha-register": resetAshaWizard,
    "asha-patients": renderAshaPatientsTable,
    "asha-patient-profile": renderAshaPatientProfile,
    "asha-urgency": renderAshaUrgencyPatientSelect,
    "asha-referrals": renderAshaReferralsView,
    "asha-followups": renderAshaFollowups
  };

  function runRenderer(viewId) {
    if (viewRenderers[viewId]) viewRenderers[viewId]();
  }

  function wireNavigation() {
    document.addEventListener("click", (e) => {
      // 1. Portal switcher links/pills
      const portalLink = e.target.closest("[data-portal-link]");
      if (portalLink) {
        e.preventDefault();
        navigateTo(portalLink.dataset.portalLink, portalLink.dataset.defaultView || null);
        return;
      }

      // 2. Sidebar view links
      const navLink = e.target.closest(".portal-nav a[data-view]");
      if (navLink) {
        e.preventDefault();
        const section = navLink.closest(".portal-section");
        const portalId = section ? section.dataset.portal : getCurrentPortalId();
        navigateTo(portalId, navLink.dataset.view);
        return;
      }

      // 3. View jump buttons anywhere in the app
      const jumpBtn = e.target.closest("[data-view-jump]");
      if (jumpBtn) {
        e.preventDefault();
        const targetView = jumpBtn.dataset.viewJump;
        const targetPortal = jumpBtn.dataset.portalJump || (jumpBtn.closest(".portal-section") ? jumpBtn.closest(".portal-section").dataset.portal : getCurrentPortalId());
        navigateTo(targetPortal, targetView);
        return;
      }
    });

    const sidebarToggle = $("#sidebarToggle");
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", () => {
        document.getElementById("app").classList.toggle("sidebar-collapsed");
      });
    }
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
    if (!isNaN(hr) && hr > 0) {
      if (hr > 130 || hr < 45) { score += 2; reasons.push(`Heart rate ${hr} bpm outside safe range (+2)`); }
      else if (hr > 110) { score += 1; reasons.push(`Heart rate ${hr} bpm elevated (+1)`); }
    }

    const spo2 = parseInt(input.spo2, 10);
    if (!isNaN(spo2) && spo2 > 0) {
      if (spo2 < 90) { score += 3; reasons.push(`SpO₂ ${spo2}% critically low (+3)`); }
      else if (spo2 < 94) { score += 1; reasons.push(`SpO₂ ${spo2}% below normal (+1)`); }
    }

    if (input.bp) {
      const parts = String(input.bp).split("/");
      const sys = parseInt(parts[0], 10);
      const dia = parseInt(parts[1], 10);
      if (!isNaN(sys) && !isNaN(dia)) {
        if (sys >= 160 || dia >= 100) {
          score += 2;
          reasons.push(`Blood pressure severely elevated (${input.bp} mmHg) (+2)`);
        } else if (sys >= 140 || dia >= 90) {
          score += 1;
          reasons.push(`Blood pressure elevated (${input.bp} mmHg) (+1)`);
        }
      }
    }

    const sugar = parseInt(input.sugar, 10);
    if (!isNaN(sugar) && sugar > 0) {
      if (sugar >= 250 || sugar <= 60) {
        score += 2;
        reasons.push(`Blood glucose outside safe range (${sugar} mg/dL) (+2)`);
      } else if (sugar >= 180 || sugar <= 70) {
        score += 1;
        reasons.push(`Elevated blood glucose (${sugar} mg/dL) (+1)`);
      }
    }

    const age = parseInt(input.age, 10);
    if (!isNaN(age) && age > 0) {
      if (age < 5 || age >= 60) { score += 1; reasons.push(`Age ${age} — higher-risk / vulnerable age group (+1)`); }
    }

    const text = `${input.symptoms || ""} ${input.history || ""}`.toLowerCase();
    const criticalKeywords = ["chest pain", "bleeding", "breathless", "breathing difficulty", "unconscious", "unresponsive", "severe", "trauma", "accident", "stroke", "seizure", "internal bleeding", "cardiac", "pregnancy", "dizziness", "weakness", "hypertension", "diabetes"];
    let kwHits = 0;
    criticalKeywords.forEach(k => { if (text.includes(k)) kwHits++; });
    if (kwHits > 0) { score += Math.min(kwHits, 3); reasons.push(`Symptom/condition indicators detected (${criticalKeywords.filter(k => text.includes(k)).slice(0, 3).join(", ")}) (+${Math.min(kwHits, 3)})`); }

    let priority = "GREEN";
    let urgencyLabel = "Routine";
    let suggestedNextStep = "Continue routine community follow-up and basic preventive care.";

    if (score >= 6) {
      priority = "RED";
      urgencyLabel = "Urgent";
      suggestedNextStep = "Immediate emergency referral to equipped healthcare facility with diagnostic support.";
    } else if (score >= 4) {
      priority = "ORANGE";
      urgencyLabel = "Priority";
      suggestedNextStep = "Prompt referral to Community Health Centre / Hospital for medical evaluation and stabilization.";
    } else if (score >= 2) {
      priority = "YELLOW";
      urgencyLabel = "Priority";
      suggestedNextStep = "Schedule clinical assessment at primary health centre within 24–48 hours.";
    }

    if (reasons.length === 0) reasons.push("No high-risk indicators entered — stable profile.");

    return {
      priority,
      score,
      urgencyLabel,
      suggestedNextStep,
      disclaimer: "This assessment provides decision support and does not replace professional clinical judgement.",
      reasons
    };
  }

  let lastTriageSuggestion = null;

  // Keeps the "Apply this triage to" dropdown in sync with whoever is
  // actually active right now, so a triage result can be applied to a
  // real registered patient instead of always spawning a new one.
  function renderTriageApplyToOptions() {
    const sel = $("#tApplyTo");
    if (!sel) return;
    const previousValue = sel.value;
    const active = db.patients.filter(p => !TERMINAL_STATUSES.includes(p.status));
    sel.innerHTML =
      `<option value="__new__">Register as a new patient</option>` +
      active.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)} — currently ${esc(p.priority)})</option>`).join("");
    if ([...sel.options].some(o => o.value === previousValue)) sel.value = previousValue;
  }

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
      <label style="display:flex;flex-direction:column;gap:6px;font-size:19px;font-weight:600;color:var(--ink-2);margin-top:8px;">
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
    const applyToSel = $("#tApplyTo");
    const applyToId = applyToSel ? applyToSel.value : "__new__";
    let patient;
    let isExisting = false;

    if (applyToId && applyToId !== "__new__") {
      patient = db.patients.find(p => p.id === applyToId);
      isExisting = !!patient;
    }

    if (isExisting) {
      // Apply the result to the patient actually selected — this is what
      // keeps Register → Emergency Snapshot → AI Triage as one continuous
      // patient instead of spawning an unrelated new record.
      patient.priority = priority;
      patient.waitingMin = 0;
    } else {
      nextPatientSeq++;
      patient = {
        id: "LF-" + nextPatientSeq,
        name: "New Triage Patient #" + nextPatientSeq,
        arrival: "Walk-in",
        priority,
        waitingMin: 0,
        dept: "Emergency",
        status: "Waiting"
      };
      db.patients.unshift(patient);
    }

    const verb = action === "confirmed" ? "Triage confirmed" : action === "modified" ? "Triage modified" : "Triage overridden";
    logAudit(verb, "N. Kulkarni", patient.name, "triage");
    pushNotification(`${verb} — ${priority}`, reason ? `${patient.name} · ${reason}` : `${patient.name} · ${isExisting ? "priority updated in" : "added to"} the live queue`);
    toast(`${verb}: ${patient.name} ${isExisting ? "updated to" : "added to the queue as"} ${priority}`);

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

  // Renders a real, scannable QR code on the Patient portal's QR Health ID
  // page. Falls back to the old CSS placeholder pattern if the QR library
  // failed to load (e.g. no internet when the page opened).
  function renderPatientQRCode() {
    const el = $("#qrVisual");
    if (!el) return;
    if (typeof QRCode === "undefined") {
      el.classList.remove("filled");
      el.innerHTML = "";
      return; // CSS ::after "LIFORA" placeholder pattern shows through
    }
    el.innerHTML = "";
    const canvas = document.createElement("canvas");
    el.appendChild(canvas);
    QRCode.toCanvas(canvas, DEMO_QR_PAYLOAD, { width: 206, margin: 1, color: { dark: "#102a2f", light: "#ffffff" } }, (err) => {
      if (err) { el.classList.remove("filled"); el.innerHTML = ""; return; }
      el.classList.add("filled");
    });
  }

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

  // ---- Hospital-side camera scanner --------------------------------------
  // Real camera access + real QR decoding via jsQR. Degrades gracefully:
  // if getUserMedia/jsQR aren't available (no camera, permission denied,
  // no internet to fetch the library), the "simulate scan instead" button
  // reproduces the old demo behavior so a live demo never dead-ends.

  let scannerStream = null;
  let scannerRAF = null;

  function stopScannerCamera() {
    if (scannerRAF) { cancelAnimationFrame(scannerRAF); scannerRAF = null; }
    if (scannerStream) { scannerStream.getTracks().forEach(t => t.stop()); scannerStream = null; }
    const visual = $("#scannerVisual");
    const video = $("#scannerVideo");
    if (visual) visual.classList.remove("camera-active");
    if (video) { video.pause(); video.srcObject = null; }
  }

  function handleScannedPayload(text) {
    stopScannerCamera();
    const requestCard = $("#consentRequestCard");
    const resultEl = $("#consentResult");
    requestCard.style.display = "block";

    if (text && text.includes(DEMO_QR_PATIENT_ID)) {
      resultEl.innerHTML = `
        <p style="color:var(--primary-700);font-weight:700;margin-bottom:10px;">✅ QR recognized — ${DEMO_QR_PATIENT_NAME} (${DEMO_QR_PATIENT_ID})</p>
        <p class="section-note" style="margin-bottom:10px;">Access request sent to the patient…</p>
        <button class="btn btn-primary btn-sm" data-view-jump="h-snapshot">Open Emergency Snapshot</button>`;
      wireNavigation_singleJump(resultEl);
      logAudit("QR access granted", "Emergency Staff", DEMO_QR_PATIENT_NAME, "qr");
      toast("QR recognized — " + DEMO_QR_PATIENT_NAME);
    } else {
      resultEl.innerHTML = `<p class="section-note">⚠️ QR code scanned, but it doesn't match a known Lifora Health ID. Ask the patient to open their QR Health ID page and try again.</p>`;
      toast("Unrecognized QR code");
    }
    $("#scannerStatus").textContent = "";
  }

  function scanCameraFrame() {
    const video = $("#scannerVideo");
    const canvas = $("#scannerCanvas");
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scannerRAF = requestAnimationFrame(scanCameraFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = (typeof jsQR === "function") ? jsQR(imageData.data, imageData.width, imageData.height) : null;
    if (code && code.data) {
      handleScannedPayload(code.data);
      return; // stop the loop — a result was found
    }
    scannerRAF = requestAnimationFrame(scanCameraFrame);
  }

  async function startScannerCamera() {
    const statusEl = $("#scannerStatus");
    if (typeof jsQR !== "function") {
      statusEl.textContent = "QR-reading library didn't load (no internet?) — use 'Simulate scan instead' below.";
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      statusEl.textContent = "This browser can't access the camera — use 'Simulate scan instead' below.";
      return;
    }
    try {
      statusEl.textContent = "Requesting camera access…";
      scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = $("#scannerVideo");
      video.srcObject = scannerStream;
      await video.play();
      $("#scannerVisual").classList.add("camera-active");
      statusEl.textContent = "Point the camera at the patient's QR Health ID…";
      scannerRAF = requestAnimationFrame(scanCameraFrame);
    } catch (err) {
      statusEl.textContent = "Camera access denied or unavailable — use 'Simulate scan instead' below.";
    }
  }

  function simulateStaffScan() {
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
  }

  function wireStaffScanner() {
    const startBtn = $("#staffScanBtn");
    const fallbackBtn = $("#staffScanFallbackBtn");
    if (startBtn) startBtn.addEventListener("click", startScannerCamera);
    if (fallbackBtn) fallbackBtn.addEventListener("click", () => { stopScannerCamera(); simulateStaffScan(); });
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
     9b. STATIC FORMS — Contact, Medical Profile, System Settings
     These previously had onsubmit="return false" and no JS behind them at
     all, so clicking Send/Save did nothing. They're still frontend-only
     (no server to actually send an email or persist a profile edit to),
     but they now give real confirmation feedback, and System Settings
     actually updates the live escalation thresholds used by the queue.
     ======================================================================== */

  function wireStaticForms() {
    const contactForm = $("#contactForm");
    if (contactForm) {
      contactForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("#contactName").value.trim();
        $("#contactStatus").innerHTML = `✅ Thanks${name ? ", " + esc(name) : ""} — your message has been sent. The Lifora team will get back to you shortly.`;
        toast("Message sent");
        contactForm.reset();
      });
    }

    const profileForm = $("#profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        logAudit("Medical profile updated", "Aarav Rao", "Aarav Rao", "profile");
        $("#profileStatus").textContent = "✅ Profile changes saved.";
        toast("Profile updated");
      });
    }

    const settingsForm = $("#settingsForm");
    if (settingsForm) {
      settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const red = parseInt($("#settingsRedThreshold").value, 10);
        const orange = parseInt($("#settingsOrangeThreshold").value, 10);
        if (!isNaN(red) && red > 0) ESCALATION_THRESHOLD.RED = red;
        if (!isNaN(orange) && orange > 0) ESCALATION_THRESHOLD.ORANGE = orange;
        logAudit("Escalation thresholds updated", "Hospital Admin", `RED ${ESCALATION_THRESHOLD.RED}m / ORANGE ${ESCALATION_THRESHOLD.ORANGE}m`, "settings");
        $("#settingsStatus").innerHTML = `✅ Saved — RED now escalates at ${ESCALATION_THRESHOLD.RED} min, ORANGE at ${ESCALATION_THRESHOLD.ORANGE} min. This applies immediately to the live queue.`;
        toast("Settings saved — escalation thresholds updated");
        if (viewIsActive("h-dashboard")) renderHospitalDashboard();
      });
    }
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
        ${doc.notes ? `<p style="font-size:18px;margin:0 0 6px;">${esc(doc.notes)}</p>` : ""}
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

  function medicineBadgeClass(status) {
    return { Available: "badge-mint", "Low Stock": "badge-yellow", Unavailable: "badge-muted" }[status] || "badge-muted";
  }

  let medicineFilter = "all";

  function renderMedicineTable() {
    const tbody = $("#medicineTable tbody");
    if (!tbody) return;
    const list = medicineFilter === "all" ? db.medicines : db.medicines.filter(m => m.status === medicineFilter);
    tbody.innerHTML = list.length ? list.map(m => `
      <tr>
        <td><strong>${esc(m.name)}</strong></td>
        <td>${esc(m.category)}</td>
        <td>${esc(m.facility)}</td>
        <td><span class="badge ${medicineBadgeClass(m.status)}">${esc(m.status)}</span></td>
      </tr>`).join("") : `<tr class="empty-row"><td colspan="4">No medicines match this filter.</td></tr>`;
  }

  function wireMedicineFilters() {
    $all("#medicineFilters .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        $all("#medicineFilters .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        medicineFilter = chip.dataset.status;
        renderMedicineTable();
      });
    });
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
    saveDB(); // keeps waiting-time ticks in sync across open tabs too
  }

  /* ========================================================================
     ASHA / COMMUNITY HEALTH WORKER + REFERRAL PIPELINE
     ------------------------------------------------------------------------
     This reuses the exact same triage engine (computeTriageSuggestion) that
     Hospital's AI Triage uses — just relabeled to the LOW/MODERATE/HIGH/
     CRITICAL scale, so "one engine, two front doors" is literally true in
     the code, not just in the pitch. Accepting a referral on the Hospital
     side creates a REAL entry in the same Live Patient Queue used
     elsewhere — referrals aren't a disconnected list.
     ======================================================================== */

  let nextAshaPatientSeq = 1004; // seed data used AP-1001..1003
  let nextReferralSeq = 100;     // seed data used LFR-00100
  let nextFollowUpSeq = 9001;    // seed data used FU-9001

  function nextAshaPatientId() { nextAshaPatientSeq++; return "AP-" + nextAshaPatientSeq; }
  function nextReferralId() { nextReferralSeq++; return "LFR-" + String(nextReferralSeq).padStart(5, "0"); }
  function nextFollowUpId() { nextFollowUpSeq++; return "FU-" + nextFollowUpSeq; }

  const URGENCY_LABEL = { RED: "CRITICAL", ORANGE: "HIGH", YELLOW: "MODERATE", GREEN: "LOW" };

  const FACILITIES = [
    { name: "Rampura PHC", type: "PHC", distanceKm: 3, emergency: false, specialists: false, diagnostics: false },
    { name: "Sundarpur PHC", type: "PHC", distanceKm: 6, emergency: false, specialists: false, diagnostics: true },
    { name: "City General Hospital", type: "Hospital", distanceKm: 14, emergency: true, specialists: true, diagnostics: true },
    { name: "District Hospital", type: "Hospital", distanceKm: 18, emergency: true, specialists: true, diagnostics: true }
  ];

  // Not just "nearest" — for HIGH/CRITICAL cases this narrows to facilities
  // that can actually handle an emergency before picking the closest one.
  function recommendFacility(urgencyPriority) {
    let candidates = FACILITIES.slice();
    if (urgencyPriority === "RED" || urgencyPriority === "ORANGE") {
      const emergencyCapable = candidates.filter(f => f.emergency);
      if (emergencyCapable.length) candidates = emergencyCapable;
    }
    candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    return candidates[0];
  }

  function referralBadgeClass(status) {
    return {
      SENT: "badge-blue", ACCEPTED: "badge-mint", "EN ROUTE": "badge-yellow",
      RECEIVED: "badge-orange", TREATMENT: "badge-orange", COMPLETED: "badge-muted"
    }[status] || "badge-muted";
  }

  function ashaPatientOptionsHtml(selectedId) {
    return db.ashaPatients.map(p => `<option value="${esc(p.id)}" ${p.id === selectedId ? "selected" : ""}>${esc(p.name)} (${esc(p.id)}) — ${esc(p.village)}</option>`).join("");
  }

  function guessRiskCategory(ageStr, gender, symptomsList) {
    const age = parseInt(ageStr, 10) || 0;
    if (symptomsList.some(s => /pregnancy/i.test(s))) return "Maternal";
    if (age > 0 && age <= 12) return "Children";
    if (age >= 60) return "Elderly";
    return "Other";
  }

  function generateAshaPatientSummary(p) {
    let s = `${p.age}-year-old ${(p.gender || "").toLowerCase()} patient from ${p.village}`;
    if (p.conditions && p.conditions !== "None") s += ` with ${p.conditions.toLowerCase()}`;
    if (p.symptoms) s += `, currently presenting with ${p.symptoms.toLowerCase()}`;
    s += `. Latest vitals: BP ${p.vitals.bp}, pulse ${p.vitals.pulse} bpm${p.vitals.sugar ? ", blood glucose " + p.vitals.sugar + " mg/dL" : ""}, SpO₂ ${p.vitals.spo2}%.`;
    if (p.allergies && p.allergies !== "None known") s += ` Known allergy: ${p.allergies}.`;
    if (p.medicines && p.medicines !== "None") s += ` Current medicines: ${p.medicines}.`;
    return s;
  }

  /* ---- Dashboard --------------------------------------------------------- */

  function renderAshaDashboard() {
    const el = $("#ashaKpis");
    if (!el) return;
    const today = todayStr();
    const registeredToday = db.ashaPatients.filter(p => p.lastVisit === today).length;
    const highRisk = db.ashaPatients.filter(p => p.riskCategory && p.riskCategory !== "Other").length;
    const pendingReferrals = db.referrals.filter(r => r.status !== "COMPLETED").length;
    const followUpsDue = db.followUps.filter(f => f.status === "Due").length;
    el.innerHTML = `
      <div class="tsum-card tsum-total"><span>Registered today</span><strong>${registeredToday}</strong></div>
      <div class="tsum-card tsum-total"><span>Total patients</span><strong>${db.ashaPatients.length}</strong></div>
      <div class="tsum-card tsum-orange"><span>High-risk patients</span><strong>${highRisk}</strong></div>
      <div class="tsum-card tsum-yellow"><span>Pending referrals</span><strong>${pendingReferrals}</strong></div>
      <div class="tsum-card tsum-red"><span>Follow-ups due</span><strong>${followUpsDue}</strong></div>
    `;
    const previewEl = $("#ashaFollowupsPreview");
    if (previewEl) {
      const due = db.followUps.filter(f => f.status === "Due");
      previewEl.innerHTML = due.length
        ? due.map(f => `<div class="escalation-item" style="background:var(--teal-100);color:var(--teal-800);"><span>${esc(f.patientName)} — ${esc(f.reason)}</span><span>${esc(f.dueLabel)}</span></div>`).join("")
        : `<p class="escalation-empty">No follow-ups due right now.</p>`;
    }
    updateAshaOfflineStatus();
  }

  /* ---- Register Patient — 4-step wizard ---------------------------------- */

  let ashaSelectedSymptoms = new Set();

  function showAshaStep(n) {
    [1, 2, 3, 4].forEach(i => $(`#ashaStep${i}`).classList.toggle("active", i === n));
    $("#ashaRegTitle").textContent = `Step ${n} of 4 — ${["", "Patient Details", "Health Details", "Record Vitals", "Patient Symptoms"][n]}`;
  }

  function resetAshaWizard() {
    ashaSelectedSymptoms = new Set();
    $all("#ashaSymptomChips .chip").forEach(c => c.classList.remove("active"));
    const regView = $("#view-asha-register");
    if (regView) {
      $all("input, select, textarea", regView).forEach(el => {
        if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
      });
    }
    const errEl = $("#ashaStep1Error");
    if (errEl) errEl.textContent = "";
    showAshaStep(1);
  }

  function wireAshaRegister() {
    $("#ashaStep1Next").addEventListener("click", () => {
      const name = $("#ashaName").value.trim();
      const age = $("#ashaAge").value.trim();
      if (!name || !age) { $("#ashaStep1Error").textContent = "Please enter at least the patient's name and age."; return; }
      $("#ashaStep1Error").textContent = "";
      showAshaStep(2);
    });
    $("#ashaStep2Back").addEventListener("click", () => showAshaStep(1));
    $("#ashaStep2Next").addEventListener("click", () => showAshaStep(3));
    $("#ashaStep3Back").addEventListener("click", () => showAshaStep(2));
    $("#ashaStep3Next").addEventListener("click", () => showAshaStep(4));
    $("#ashaStep4Back").addEventListener("click", () => showAshaStep(3));

    $all("#ashaSymptomChips .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        chip.classList.toggle("active");
        const s = chip.dataset.symptom;
        if (chip.classList.contains("active")) ashaSelectedSymptoms.add(s);
        else ashaSelectedSymptoms.delete(s);
      });
    });

    $("#ashaFinishRegister").addEventListener("click", () => {
      const symptomsList = [...ashaSelectedSymptoms];
      const other = $("#ashaSymptomOther").value.trim();
      if (other) symptomsList.push(other);

      const sugarInput = $("#ashaSugar");
      const sugarVal = sugarInput ? parseInt(sugarInput.value, 10) : 0;
      const vitals = {
        bp: $("#ashaBP").value.trim() || "—",
        pulse: parseInt($("#ashaPulse").value, 10) || 0,
        temp: parseFloat($("#ashaTemp").value) || 0,
        sugar: (!isNaN(sugarVal) && sugarVal > 0) ? sugarVal : 0,
        spo2: parseInt($("#ashaSpo2").value, 10) || 0,
        resp: parseInt($("#ashaResp").value, 10) || 0,
        weight: parseFloat($("#ashaWeight").value) || 0
      };
      const symptomsText = symptomsList.join(", ");

      const patient = {
        id: nextAshaPatientId(),
        name: $("#ashaName").value.trim() || "Unnamed patient",
        age: parseInt($("#ashaAge").value, 10) || 0,
        gender: $("#ashaGender").value,
        phone: $("#ashaPhone").value.trim(),
        village: $("#ashaVillage").value.trim(),
        emergencyContact: $("#ashaEmergencyContact").value.trim(),
        bloodGroup: $("#ashaBloodGroup").value,
        allergies: $("#ashaAllergies").value.trim() || "None known",
        conditions: $("#ashaConditions").value.trim() || "None",
        medicines: $("#ashaMedicines").value.trim() || "None",
        vitals: vitals,
        symptoms: symptomsText,
        riskCategory: guessRiskCategory($("#ashaAge").value, $("#ashaGender").value, symptomsList),
        lastVisit: todayStr(),
        registeredBy: "Nurse Kulkarni",
        visits: [{ date: todayStr(), vitals: vitals, notes: symptomsText || "Initial registration visit", recordedBy: "Nurse Kulkarni" }]
      };

      if (ashaOfflineMode) {
        // No connection right now (simulated) — save on-device and queue
        // instead of registering immediately. Nothing is lost; it commits
        // for real once "Sync Saved Records" runs.
        db.pendingSyncQueue.push(patient);
        saveDB();
        toast(`Offline — ${patient.name} saved locally`);
        logAudit("Patient saved offline (pending sync)", "Nurse Kulkarni", patient.name, "offline");
        resetAshaWizard();
        showView($("#portal-asha"), "asha-dashboard");
      } else {
        commitAshaPatientRegistration(patient);
        pendingAshaSelectedPatientId = patient.id;
        resetAshaWizard();
        showView($("#portal-asha"), "asha-urgency");
      }
    });
  }

  function commitAshaPatientRegistration(patient) {
    db.ashaPatients.unshift(patient);
    saveDB();
    logAudit("Patient registered", "Nurse Kulkarni", patient.name, "registration");
    pushNotification("New patient registered", `${patient.name} · ${patient.village}`);
    toast(`${patient.name} registered`);
  }

  /* ---- Low-connectivity / offline demo ------------------------------------
     Honest scope: this simulates the workflow (queue locally, sync later)
     using the same localStorage the rest of the app already relies on.
     It is NOT a real offline-first implementation — that needs IndexedDB,
     a service worker and background sync, which the homepage's roadmap
     section is explicit about not claiming to have built yet. */

  let ashaOfflineMode = false;

  function wireAshaOffline() {
    const toggleBtn = $("#ashaOfflineToggle");
    const syncBtn = $("#ashaSyncNowBtn");
    if (!toggleBtn) return;

    toggleBtn.addEventListener("click", () => {
      ashaOfflineMode = !ashaOfflineMode;
      toggleBtn.textContent = ashaOfflineMode ? "🔌 Simulate Online Mode" : "📡 Simulate Offline Mode";
      $(".offline-demo-card").classList.toggle("is-offline", ashaOfflineMode);
      if (ashaOfflineMode) {
        toast("Offline mode — new registrations will be saved locally");
      } else if (db.pendingSyncQueue.length) {
        toast("Connection restored");
        syncAshaPendingRecords();
      }
      updateAshaOfflineStatus();
    });

    if (syncBtn) syncBtn.addEventListener("click", syncAshaPendingRecords);
  }

  function updateAshaOfflineStatus() {
    const statusEl = $("#ashaOfflineStatus");
    const panel = $("#ashaSyncPanel");
    if (!statusEl) return;
    const count = db.pendingSyncQueue.length;
    if (ashaOfflineMode) {
      statusEl.innerHTML = count
        ? `📴 Offline — ${count} record${count === 1 ? "" : "s"} pending synchronization.`
        : `📴 Offline mode is on. Records registered now will be saved on this device.`;
    } else {
      statusEl.innerHTML = count
        ? `${count} record${count === 1 ? "" : "s"} saved while offline, not yet synchronized.`
        : `✓ Connected — all records are synchronized.`;
    }
    if (panel) panel.style.display = count ? "block" : "none";
  }

  function syncAshaPendingRecords() {
    const queue = db.pendingSyncQueue.slice();
    if (!queue.length) { toast("Nothing to sync"); return; }
    toast(`Syncing ${queue.length} record${queue.length === 1 ? "" : "s"}…`);
    queue.forEach(p => commitAshaPatientRegistration(p));
    db.pendingSyncQueue = [];
    saveDB();
    toast("✓ All records synchronized successfully");
    updateAshaOfflineStatus();
    if (viewIsActive("asha-patients")) renderAshaPatientsTable();
    if (viewIsActive("asha-dashboard")) renderAshaDashboard();
  }

  /* ---- Patients list + risk filter --------------------------------------- */

  let ashaPatientsFilter = "all";
  let pendingAshaSelectedPatientId = null;
  let pendingAshaReferralPatientId = null;
  let pendingAshaProfilePatientId = null;

  function nextFollowUpForPatient(patientId) {
    return db.followUps.find(f => f.patientId === patientId && f.status === "Due") || null;
  }

  function renderAshaPatientsTable() {
    const tbody = $("#ashaPatientsTable tbody");
    if (!tbody) return;
    let list = db.ashaPatients.slice();
    if (ashaPatientsFilter === "High") {
      list = list.filter(p => ["Maternal", "Children", "Elderly"].includes(p.riskCategory) || (p.conditions && p.conditions !== "None"));
    } else if (ashaPatientsFilter !== "all") {
      list = list.filter(p => p.riskCategory === ashaPatientsFilter);
    }
    tbody.innerHTML = list.length ? list.map(p => {
      const dueFollowUp = nextFollowUpForPatient(p.id);
      return `
      <tr>
        <td><button type="button" class="btn-link-cell asha-patient-profile-link" data-pid="${esc(p.id)}"><strong>${esc(p.name)}</strong></button></td>
        <td>${p.age} / ${esc(p.gender)}</td>
        <td>${esc(p.village)}</td>
        <td><span class="badge ${(!p.riskCategory || p.riskCategory === "Other") ? "badge-muted" : "badge-orange"}">${esc(p.riskCategory || "Other")}</span></td>
        <td>${esc(p.lastVisit)}</td>
        <td>${dueFollowUp ? `<span class="badge badge-yellow">${esc(dueFollowUp.dueLabel)}</span>` : "—"}</td>
        <td>${esc(p.registeredBy || "Nurse Kulkarni")}</td>
        <td><button class="btn btn-ghost btn-sm asha-patient-select-btn" data-pid="${esc(p.id)}">Check Urgency</button></td>
      </tr>`;
    }).join("") : `<tr class="empty-row"><td colspan="8">No patients match this filter.</td></tr>`;

    $all(".asha-patient-select-btn", tbody).forEach(btn => {
      btn.addEventListener("click", () => {
        pendingAshaSelectedPatientId = btn.dataset.pid;
        showView($("#portal-asha"), "asha-urgency");
      });
    });
    $all(".asha-patient-profile-link", tbody).forEach(btn => {
      btn.addEventListener("click", () => {
        pendingAshaProfilePatientId = btn.dataset.pid;
        showView($("#portal-asha"), "asha-patient-profile");
      });
    });
  }

  function wireAshaPatientFilters() {
    $all("#ashaRiskFilters .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        $all("#ashaRiskFilters .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        ashaPatientsFilter = chip.dataset.risk;
        renderAshaPatientsTable();
      });
    });
  }

  /* ---- Patient Profile (detail drill-down) -------------------------------- */

  let currentAshaProfilePatientId = null;

  function renderAshaPatientProfile() {
    const targetId = pendingAshaProfilePatientId || currentAshaProfilePatientId || (db.ashaPatients[0] && db.ashaPatients[0].id);
    const patient = db.ashaPatients.find(p => p.id === targetId) || db.ashaPatients[0];
    pendingAshaProfilePatientId = null;
    if (!patient) return;
    currentAshaProfilePatientId = patient.id;

    $("#ashaProfileEyebrow").textContent = patient.riskCategory && patient.riskCategory !== "Other" ? patient.riskCategory + " · Patient Profile" : "Patient Profile";
    $("#ashaProfileName").textContent = patient.name;

    $("#ashaProfileOverview").innerHTML = `
      <h3>Overview</h3>
      <div class="snapshot-mini-grid">
        <div><span>Age / Gender</span><strong>${patient.age} / ${esc(patient.gender)}</strong></div>
        <div><span>Village</span><strong>${esc(patient.village) || "—"}</strong></div>
        <div><span>Phone</span><strong>${esc(patient.phone) || "—"}</strong></div>
        <div><span>Emergency contact</span><strong>${esc(patient.emergencyContact) || "—"}</strong></div>
        <div><span>Blood group</span><strong>${esc(patient.bloodGroup)}</strong></div>
        <div><span>Risk level</span><strong><span class="badge ${(!patient.riskCategory || patient.riskCategory === "Other") ? "badge-muted" : "badge-orange"}">${esc(patient.riskCategory || "Other")}</span></strong></div>
      </div>`;

    $("#ashaProfileVitals").innerHTML = `
      <div><span>Blood pressure</span><strong>${esc(patient.vitals.bp)}</strong></div>
      <div><span>Pulse</span><strong>${patient.vitals.pulse} bpm</strong></div>
      <div><span>Blood sugar</span><strong>${patient.vitals.sugar ? patient.vitals.sugar + " mg/dL" : "—"}</strong></div>
      <div><span>Temperature</span><strong>${patient.vitals.temp}°F</strong></div>
      <div><span>SpO₂</span><strong>${patient.vitals.spo2}%</strong></div>
      <div><span>Weight</span><strong>${patient.vitals.weight} kg</strong></div>`;

    $("#ashaProfileHealth").innerHTML = `
      <div class="id-card-row"><span>Conditions</span><strong>${esc(patient.conditions)}</strong></div>
      <div class="id-card-row"><span>Allergies</span><strong>${esc(patient.allergies)}</strong></div>
      <div class="id-card-row"><span>Current medicines</span><strong>${esc(patient.medicines)}</strong></div>
      <div class="id-card-row"><span>Latest symptoms</span><strong>${esc(patient.symptoms) || "None recorded"}</strong></div>`;

    const visits = (patient.visits || []).slice().reverse();
    $("#ashaProfileVisitHistory").innerHTML = visits.length ? visits.map(v => `
      <li>
        <span class="mono">${esc(v.date)}</span>
        <div>
          <h4>BP ${esc(v.vitals.bp)} · Pulse ${v.vitals.pulse} bpm${v.vitals.sugar ? " · Sugar " + v.vitals.sugar + " mg/dL" : ""} · SpO₂ ${v.vitals.spo2}%</h4>
          <p>${esc(v.notes) || "No notes recorded"} — ${esc(v.recordedBy)}</p>
        </div>
      </li>`).join("") : `<li><span class="mono">—</span><div><p>No visits recorded yet.</p></div></li>`;

    const referrals = db.referrals.filter(r => r.patientId === patient.id);
    $("#ashaProfileReferralsTable tbody").innerHTML = referrals.length ? referrals.map(r => `
      <tr>
        <td class="mono">${esc(r.id)}</td>
        <td>${esc(r.facility)}</td>
        <td><span class="badge ${badgeClassForPriority(r.urgency)}">${esc(URGENCY_LABEL[r.urgency] || r.urgency)}</span></td>
        <td><span class="badge ${referralBadgeClass(r.status)}">${esc(r.status)}</span></td>
      </tr>`).join("") : `<tr class="empty-row"><td colspan="4">No referrals for this patient yet.</td></tr>`;

    const followUps = db.followUps.filter(f => f.patientId === patient.id);
    $("#ashaProfileFollowups").innerHTML = followUps.length ? followUps.map(f => `
      <div class="escalation-item ${f.status === "Due" ? "" : "escalation-item-done"}">
        <span>${esc(f.reason)}</span><span>${f.status === "Due" ? esc(f.dueLabel) : "Completed"}</span>
      </div>`).join("") : `<p class="escalation-empty">No follow-ups scheduled for this patient.</p>`;

    $("#ashaScheduleFollowupForm").style.display = "none";
  }

  function wireAshaPatientProfile() {
    $("#ashaProfileRecordVitals").addEventListener("click", () => openVisitModal(currentAshaProfilePatientId, "Record Vitals"));
    $("#ashaProfileRecordVisit").addEventListener("click", () => openVisitModal(currentAshaProfilePatientId, "Record New Visit"));

    $("#ashaProfileCheckUrgency").addEventListener("click", () => {
      pendingAshaSelectedPatientId = currentAshaProfilePatientId;
      showView($("#portal-asha"), "asha-urgency");
    });
    $("#ashaProfileCreateReferral").addEventListener("click", () => {
      pendingAshaReferralPatientId = currentAshaProfilePatientId;
      showView($("#portal-asha"), "asha-referrals");
    });

    $("#ashaProfileScheduleFollowup").addEventListener("click", () => {
      const form = $("#ashaScheduleFollowupForm");
      form.style.display = form.style.display === "none" ? "block" : "none";
    });

    $("#ashaFollowupForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const patient = db.ashaPatients.find(p => p.id === currentAshaProfilePatientId);
      if (!patient) return;
      const reason = $("#ashaFollowupReason").value.trim() || "Follow-up visit";
      const due = $("#ashaFollowupDue").value.trim() || "Due soon";
      db.followUps.unshift({
        id: nextFollowUpId(), patientId: patient.id, patientName: patient.name,
        reason, dueLabel: due, status: "Due", createdFrom: null
      });
      logAudit("Follow-up scheduled", "Nurse Kulkarni", patient.name, "followup");
      saveDB();
      toast(`Follow-up scheduled for ${patient.name}`);
      $("#ashaFollowupForm").reset();
      $("#ashaScheduleFollowupForm").style.display = "none";
      renderAshaPatientProfile();
      renderAshaPatientsTable();
      if (viewIsActive("asha-dashboard")) renderAshaDashboard();
      if (viewIsActive("asha-followups")) renderAshaFollowups();
    });
  }

  /* ---- Record Visit modal — shared by "Record Vitals" and "Record New Visit" -- */

  let visitModalPatientId = null;

  function openVisitModal(patientId, title) {
    const patient = db.ashaPatients.find(p => p.id === patientId);
    if (!patient) return;
    visitModalPatientId = patientId;
    $("#visitModalTitle").textContent = title || "Record New Visit";
    $("#visitBP").value = patient.vitals.bp && patient.vitals.bp !== "—" ? patient.vitals.bp : "";
    $("#visitPulse").value = patient.vitals.pulse || "";
    $("#visitTemp").value = patient.vitals.temp || "";
    const sugarEl = $("#visitSugar");
    if (sugarEl) sugarEl.value = patient.vitals.sugar || "";
    $("#visitSpo2").value = patient.vitals.spo2 || "";
    $("#visitResp").value = patient.vitals.resp || "";
    $("#visitWeight").value = patient.vitals.weight || "";
    $("#visitNotes").value = "";
    $("#visitModalOverlay").classList.add("open");
  }

  function wireVisitModal() {
    $("#closeVisitModal").addEventListener("click", () => $("#visitModalOverlay").classList.remove("open"));
    $("#visitModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "visitModalOverlay") $("#visitModalOverlay").classList.remove("open");
    });

    $("#visitForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const patient = db.ashaPatients.find(p => p.id === visitModalPatientId);
      if (!patient) return;
      const sugarInput = $("#visitSugar");
      const sugarVal = sugarInput ? parseInt(sugarInput.value, 10) : 0;
      const vitals = {
        bp: $("#visitBP").value.trim() || patient.vitals.bp,
        pulse: parseInt($("#visitPulse").value, 10) || patient.vitals.pulse,
        temp: parseFloat($("#visitTemp").value) || patient.vitals.temp,
        sugar: (!isNaN(sugarVal) && sugarVal > 0) ? sugarVal : (patient.vitals.sugar || 0),
        spo2: parseInt($("#visitSpo2").value, 10) || patient.vitals.spo2,
        resp: parseInt($("#visitResp").value, 10) || patient.vitals.resp,
        weight: parseFloat($("#visitWeight").value) || patient.vitals.weight
      };
      const notes = $("#visitNotes").value.trim();
      if (!patient.visits) patient.visits = [];
      patient.visits.push({ date: todayStr(), vitals, notes, recordedBy: "Nurse Kulkarni" });
      patient.vitals = vitals;
      patient.symptoms = notes || patient.symptoms;
      patient.lastVisit = todayStr();

      saveDB();
      logAudit("Visit recorded", "Nurse Kulkarni", patient.name, "visit");
      toast(`Visit recorded for ${patient.name}`);
      $("#visitModalOverlay").classList.remove("open");

      if (viewIsActive("asha-patient-profile")) renderAshaPatientProfile();
      if (viewIsActive("asha-patients")) renderAshaPatientsTable();
      if (viewIsActive("asha-dashboard")) renderAshaDashboard();
    });
  }

  /* ---- Check Urgency (reuses computeTriageSuggestion) -------------------- */

  let lastAshaUrgencyResult = null;

  function updateAshaUrgencySummary() {
    const sel = $("#ashaUrgencyPatientSelect");
    const summaryEl = $("#ashaUrgencySummary");
    if (!sel || !summaryEl) return;
    const patient = db.ashaPatients.find(p => p.id === sel.value);
    if (!patient) { summaryEl.textContent = ""; return; }
    summaryEl.innerHTML = `
      <strong>${esc(patient.name)}</strong>, ${patient.age} / ${esc(patient.gender)} · ${esc(patient.village)}<br>
      Vitals: BP ${esc(patient.vitals.bp)} · Pulse ${patient.vitals.pulse} bpm · Sugar ${patient.vitals.sugar ? patient.vitals.sugar + " mg/dL" : "—"} · SpO₂ ${patient.vitals.spo2}% · Temp ${patient.vitals.temp}°F<br>
      Symptoms: ${esc(patient.symptoms) || "None recorded"}${patient.conditions && patient.conditions !== "None" ? " · Known Conditions: " + esc(patient.conditions) : ""}`;
  }

  function renderAshaUrgencyPatientSelect() {
    const sel = $("#ashaUrgencyPatientSelect");
    if (!sel) return;
    const selectedId = pendingAshaSelectedPatientId || sel.value || (db.ashaPatients[0] && db.ashaPatients[0].id);
    sel.innerHTML = ashaPatientOptionsHtml(selectedId);
    pendingAshaSelectedPatientId = null;
    updateAshaUrgencySummary();
    const resultEl = $("#ashaUrgencyResult");
    resultEl.textContent = 'Select a patient and click "Run Priority Assessment."';
    resultEl.classList.add("triage-suggestion-empty");
    $("#ashaUrgencyActions").style.display = "none";
    const oldPanel = $("#ashaPatientSummaryPanel");
    if (oldPanel) oldPanel.remove();
  }

  function wireAshaUrgency() {
    const sel = $("#ashaUrgencyPatientSelect");
    if (sel) sel.addEventListener("change", updateAshaUrgencySummary);

    $("#ashaRunUrgency").addEventListener("click", () => {
      const patient = db.ashaPatients.find(p => p.id === $("#ashaUrgencyPatientSelect").value);
      if (!patient) return;
      const input = {
        symptoms: patient.symptoms,
        consciousness: (patient.symptoms || "").toLowerCase().includes("unconscious") ? "Unresponsive" : "Alert",
        hr: patient.vitals.pulse,
        bp: patient.vitals.bp,
        sugar: patient.vitals.sugar || 0,
        spo2: patient.vitals.spo2,
        age: patient.age,
        history: patient.conditions
      };
      const result = computeTriageSuggestion(input);
      lastAshaUrgencyResult = { patient, result };
      const label = result.urgencyLabel || URGENCY_LABEL[result.priority];
      const resultEl = $("#ashaUrgencyResult");
      resultEl.classList.remove("triage-suggestion-empty");
      resultEl.innerHTML = `
        <div class="triage-result">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span class="priority-tag ${badgeClassForPriority(result.priority)}">${priorityDot(result.priority)} ${label.toUpperCase()} (${result.priority})</span>
            <small style="font-weight:700;color:var(--ink-2);">Score: ${result.score}/10</small>
          </div>
          <div style="margin:10px 0 12px;padding:10px;background:var(--surface-2);border-left:3px solid var(--teal-700);border-radius:6px;">
            <strong style="color:var(--teal-950);font-size:13px;">Suggested Next Step:</strong>
            <p style="margin:4px 0 0;font-size:14px;color:var(--ink);">${esc(result.suggestedNextStep)}</p>
          </div>
          <div class="triage-reasoning">
            <strong>Clinical Decision Support Factors:</strong><br>
            ${result.reasons.map(r => "• " + esc(r)).join("<br>")}
          </div>
          <p style="font-size:12px;color:var(--muted);margin-top:10px;font-style:italic;">"${result.disclaimer}"</p>
        </div>`;
      $("#ashaUrgencyActions").style.display = "flex";
      const oldPanel = $("#ashaPatientSummaryPanel");
      if (oldPanel) oldPanel.remove();
      logAudit("Priority assessment completed", "Nurse Kulkarni", patient.name, "triage");
      toast(`${patient.name}: ${label} Priority`);
    });

    $("#ashaFindCareBtn").addEventListener("click", () => {
      if (!lastAshaUrgencyResult) return;
      pendingAshaReferralPatientId = lastAshaUrgencyResult.patient.id;
      showView($("#portal-asha"), "asha-referrals");
    });

    $("#ashaViewSummaryBtn").addEventListener("click", () => {
      if (!lastAshaUrgencyResult) return;
      const existing = $("#ashaPatientSummaryPanel");
      if (existing) { existing.remove(); return; }
      const panel = document.createElement("div");
      panel.id = "ashaPatientSummaryPanel";
      panel.className = "ai-summary";
      panel.style.marginTop = "12px";
      panel.innerHTML = `<strong>Clinical Decision Support Summary · verify before medical decision</strong>${esc(generateAshaPatientSummary(lastAshaUrgencyResult.patient))}`;
      $("#ashaUrgencyActions").after(panel);
    });
  }

  /* ---- Find Appropriate Care + Referrals --------------------------------- */

  function updateAshaFacilityRecommendation() {
    const sel = $("#ashaReferralPatientSelect");
    const el = $("#ashaFacilityRecommendation");
    if (!sel || !el) return;
    const patient = db.ashaPatients.find(p => p.id === sel.value);
    if (!patient) { el.textContent = "Select a patient to see a recommended facility."; return; }

    const input = {
      symptoms: patient.symptoms, consciousness: "Alert",
      hr: patient.vitals.pulse, bp: patient.vitals.bp,
      sugar: patient.vitals.sugar || 0,
      spo2: patient.vitals.spo2,
      age: patient.age, history: patient.conditions
    };
    const result = computeTriageSuggestion(input);
    const facility = recommendFacility(result.priority);
    const label = result.urgencyLabel || URGENCY_LABEL[result.priority];
    const caps = [facility.emergency && "Emergency Care", facility.specialists && "Specialist Services", facility.diagnostics && "Diagnostics"].filter(Boolean).join(", ") || "General care";

    el.innerHTML = `
      <div class="snapshot-row"><span>Patient</span><strong>${esc(patient.name)}</strong></div>
      <div class="snapshot-row"><span>Urgency</span><strong><span class="badge ${badgeClassForPriority(result.priority)}">${label}</span></strong></div>
      <div class="snapshot-row"><span>Recommended facility</span><strong>${esc(facility.name)}</strong></div>
      <div class="snapshot-row"><span>Distance</span><strong>${facility.distanceKm} km</strong></div>
      <div class="snapshot-row"><span>Capabilities</span><strong>${esc(caps)}</strong></div>
      <div class="quick-actions" style="margin-top:14px;">
        <button class="btn btn-primary btn-sm" id="ashaStartReferralBtn">Start Referral</button>
      </div>`;

    $("#ashaStartReferralBtn").addEventListener("click", () => createAshaReferral(patient, facility, result.priority));
  }

  function createAshaReferral(patient, facility, urgencyPriority) {
    const referral = {
      id: nextReferralId(),
      patientId: patient.id,
      patientName: patient.name,
      urgency: urgencyPriority,
      facility: facility.name,
      reason: patient.symptoms || "Referred for further evaluation",
      status: "SENT",
      createdBy: "Nurse Kulkarni",
      time: Date.now()
    };
    db.referrals.unshift(referral);
    saveDB();
    logAudit("Referral sent", "Nurse Kulkarni", patient.name, "referral");
    pushNotification(`🚨 New referral — ${referral.id}`, `${patient.name} · ${facility.name} · ${URGENCY_LABEL[urgencyPriority] || urgencyPriority}`);
    toast(`Referral ${referral.id} sent to ${facility.name}`);
    if (viewIsActive("asha-referrals")) renderAshaReferralsTable();
    if (viewIsActive("asha-dashboard")) renderAshaDashboard();
    if (viewIsActive("h-referrals")) renderHospitalReferrals();
    if (viewIsActive("h-dashboard")) renderHospitalDashboard();
  }

  function renderAshaReferralsTable() {
    const tbody = $("#ashaReferralsTable tbody");
    if (!tbody) return;
    tbody.innerHTML = db.referrals.length ? db.referrals.map(r => `
      <tr>
        <td class="mono">${esc(r.id)}</td>
        <td>${esc(r.patientName)}</td>
        <td>${esc(r.facility)}</td>
        <td><span class="badge ${badgeClassForPriority(r.urgency)}">${esc(URGENCY_LABEL[r.urgency] || r.urgency)}</span></td>
        <td><span class="badge ${referralBadgeClass(r.status)}">${esc(r.status)}</span></td>
      </tr>`).join("") : `<tr class="empty-row"><td colspan="5">No referrals sent yet.</td></tr>`;
  }

  function renderAshaReferralsView() {
    const sel = $("#ashaReferralPatientSelect");
    if (sel) {
      const selectedId = pendingAshaReferralPatientId || sel.value || (db.ashaPatients[0] && db.ashaPatients[0].id);
      sel.innerHTML = ashaPatientOptionsHtml(selectedId);
      pendingAshaReferralPatientId = null;
      updateAshaFacilityRecommendation();
    }
    renderAshaReferralsTable();
  }

  function wireAshaReferrals() {
    const sel = $("#ashaReferralPatientSelect");
    if (sel) sel.addEventListener("change", updateAshaFacilityRecommendation);
  }

  /* ---- Follow-ups --------------------------------------------------------- */

  function renderAshaFollowups() {
    const el = $("#ashaFollowupsList");
    if (!el) return;
    const due = db.followUps.filter(f => f.status === "Due");
    const completed = db.followUps.filter(f => f.status === "Completed");
    el.innerHTML = `
      <h3 style="margin:0 0 12px;">Follow-Ups Due Today</h3>
      ${due.length ? due.map(f => `
        <div class="card" style="margin-bottom:12px;">
          <div class="split-head" style="margin-bottom:10px;">
            <div><strong>${esc(f.patientName)}</strong><p class="section-note" style="margin:2px 0 0;">Reason: ${esc(f.reason)}</p></div>
            <span class="badge badge-yellow">${esc(f.dueLabel)}</span>
          </div>
          <div class="quick-actions">
            <button class="btn btn-secondary btn-sm asha-followup-contact" data-fid="${esc(f.id)}">Contact Patient</button>
            <button class="btn btn-ghost btn-sm asha-followup-record" data-fid="${esc(f.id)}">Record Follow-Up</button>
            <button class="btn btn-primary btn-sm asha-followup-complete" data-fid="${esc(f.id)}">Mark Completed</button>
          </div>
        </div>`).join("") : `<p class="escalation-empty">No follow-ups due right now.</p>`}
      ${completed.length ? `<h3 style="margin:20px 0 12px;">Completed</h3>` + completed.map(f => `
        <div class="card" style="margin-bottom:10px;opacity:.7;">
          <strong>${esc(f.patientName)}</strong> — ${esc(f.reason)} <span class="badge badge-mint" style="margin-left:8px;">Completed</span>
        </div>`).join("") : ""}
    `;

    $all(".asha-followup-contact", el).forEach(btn => btn.addEventListener("click", () => {
      const f = db.followUps.find(x => x.id === btn.dataset.fid);
      toast(f ? `Calling ${f.patientName} (simulated)…` : "Calling patient (simulated)…");
    }));
    $all(".asha-followup-record", el).forEach(btn => btn.addEventListener("click", () => {
      const f = db.followUps.find(x => x.id === btn.dataset.fid);
      if (!f) return;
      logAudit("Follow-up recorded", "Nurse Kulkarni", f.patientName, "followup");
      toast(`Follow-up notes recorded for ${f.patientName}`);
    }));
    $all(".asha-followup-complete", el).forEach(btn => btn.addEventListener("click", () => {
      const f = db.followUps.find(x => x.id === btn.dataset.fid);
      if (!f) return;
      f.status = "Completed";
      saveDB();
      logAudit("Follow-up completed", "Nurse Kulkarni", f.patientName, "followup");
      toast(`✅ Follow-up completed for ${f.patientName}`);
      renderAshaFollowups();
      if (viewIsActive("asha-dashboard")) renderAshaDashboard();
    }));
  }

  /* ---- Emergency SOS -------------------------------------------------------
     Runs the whole chain in one click: assess → find emergency facility →
     create emergency referral, using the exact same functions as the
     manual flow above. */

  function wireAshaEmergency() {
    $all("#ashaEmergencyOptions [data-emergency]").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.emergency;
        $("#ashaEmergencyStatus").innerHTML = `<span class="mono">Assessing emergency…</span>`;

        const patient = {
          id: nextAshaPatientId(),
          name: "Emergency Patient — " + type,
          age: 40, gender: "Unknown", phone: "", village: "Unknown", emergencyContact: "",
          bloodGroup: "Unknown", allergies: "Unknown", conditions: "Unknown", medicines: "Unknown",
          vitals: { bp: "—", pulse: 0, temp: 0, spo2: 0, resp: 0, weight: 0 },
          symptoms: type, riskCategory: "Other", lastVisit: todayStr(), registeredBy: "Nurse Kulkarni"
        };
        db.ashaPatients.unshift(patient);

        const facility = recommendFacility("RED");
        createAshaReferral(patient, facility, "RED");

        logAudit("Emergency SOS raised", "Nurse Kulkarni", patient.name, "emergency");
        $("#ashaEmergencyStatus").innerHTML = `
          ✅ Emergency assessed as <strong>CRITICAL</strong>.<br>
          ✅ Nearest emergency facility: <strong>${esc(facility.name)}</strong> (${facility.distanceKm} km).<br>
          ✅ Emergency referral <span class="mono">${esc(db.referrals[0].id)}</span> sent.<br>
          ✅ Patient's emergency contact would be notified here (see Patient Portal's Emergency Assistance for that flow).`;
        toast("Emergency referral sent — " + facility.name);
        if (viewIsActive("asha-dashboard")) renderAshaDashboard();
      });
    });
  }

  /* ---- Hospital side: Incoming Referrals ---------------------------------- */

  function referralNextAction(status) {
    return {
      SENT: { action: "accept", label: "Accept Referral" },
      ACCEPTED: { action: "enroute", label: "Mark Patient En Route" },
      "EN ROUTE": { action: "received", label: "Mark Patient Received" },
      RECEIVED: { action: "treatment", label: "Start Treatment" },
      TREATMENT: { action: "complete", label: "Mark Completed" },
      COMPLETED: null
    }[status] || null;
  }

  const REFERRAL_STAGES = ["SENT", "ACCEPTED", "EN ROUTE", "RECEIVED", "TREATMENT", "COMPLETED"];
  const REFERRAL_STAGE_LABEL = {
    SENT: "Referral Sent", ACCEPTED: "Facility Accepted", "EN ROUTE": "Patient En Route",
    RECEIVED: "Patient Arrived", TREATMENT: "Treatment", COMPLETED: "Completed"
  };

  // The "no patient should disappear between facilities" visual — every
  // referral shows its real current stage, not just a single status word.
  function referralPipelineHtml(currentStatus) {
    const currentIndex = REFERRAL_STAGES.indexOf(currentStatus);
    return `<div class="referral-pipeline">${REFERRAL_STAGES.map((stage, i) => {
      const icon = i < currentIndex ? "✓" : i === currentIndex ? "●" : "○";
      const stateClass = i < currentIndex ? "done" : i === currentIndex ? "current" : "pending";
      return `<div class="referral-pipeline-step ${stateClass}"><span class="referral-pipeline-icon">${icon}</span><span>${esc(REFERRAL_STAGE_LABEL[stage])}</span></div>`;
    }).join("")}</div>`;
  }

  function renderHospitalReferrals() {
    const el = $("#hospitalReferralsList");
    if (!el) return;
    if (!db.referrals.length) {
      el.innerHTML = `<p class="doc-empty">No incoming referrals right now.</p>`;
      return;
    }
    el.innerHTML = db.referrals.map(r => {
      const label = URGENCY_LABEL[r.urgency] || r.urgency;
      const nextAction = referralNextAction(r.status);
      const showAcceptEmergency = r.status === "SENT" && (r.urgency === "RED" || r.urgency === "ORANGE");
      return `
      <div class="card" style="margin-bottom:14px;">
        <div class="split-head" style="margin-bottom:10px;">
          <div>
            <strong>${esc(r.patientName)}</strong>
            <p class="section-note" style="margin:2px 0 0;">${esc(r.id)} · from ${esc(r.createdBy)} · ${esc(r.reason)}</p>
          </div>
          <span class="badge ${badgeClassForPriority(r.urgency)}">${esc(label)}</span>
        </div>
        <div class="snapshot-mini-grid" style="margin-bottom:12px;">
          <div><span>Facility</span><strong>${esc(r.facility)}</strong></div>
          <div><span>Status</span><strong><span class="badge ${referralBadgeClass(r.status)}">${esc(r.status)}</span></strong></div>
          <div><span>Sent</span><strong>${timeAgo(r.time)}</strong></div>
        </div>
        ${referralPipelineHtml(r.status)}
        <div class="quick-actions" style="margin-top:12px;">
          ${nextAction ? `<button class="btn ${showAcceptEmergency ? "btn-emergency" : "btn-primary"} btn-sm hospital-referral-action" data-rid="${esc(r.id)}" data-action="${showAcceptEmergency ? "acceptEmergency" : nextAction.action}">${showAcceptEmergency ? "Accept Emergency" : nextAction.label}</button>` : ""}
          ${showAcceptEmergency ? `<button class="btn btn-ghost btn-sm hospital-referral-action" data-rid="${esc(r.id)}" data-action="accept">Accept (Non-emergency)</button>` : ""}
        </div>
      </div>`;
    }).join("");

    $all(".hospital-referral-action", el).forEach(btn => {
      btn.addEventListener("click", () => handleReferralAction(btn.dataset.rid, btn.dataset.action));
    });
  }

  function handleReferralAction(referralId, action) {
    const referral = db.referrals.find(r => r.id === referralId);
    if (!referral) return;

    if (action === "accept" || action === "acceptEmergency") {
      referral.status = "ACCEPTED";
      // Create (or reuse) a REAL entry in the existing Live Patient Queue —
      // this is what makes an accepted referral part of the hospital's
      // actual workflow, not a disconnected list.
      const queueId = "REF-" + referral.id;
      let queuePatient = db.patients.find(p => p.id === queueId);
      if (!queuePatient) {
        queuePatient = {
          id: queueId, name: referral.patientName, arrival: "Referred",
          priority: referral.urgency, waitingMin: 0,
          dept: action === "acceptEmergency" ? "Emergency" : "General Medicine",
          status: "Waiting"
        };
        db.patients.unshift(queuePatient);
      }
      logAudit(action === "acceptEmergency" ? "Referral accepted as emergency" : "Referral accepted", "Dr. S. Bhatt", referral.patientName, "referral");
      pushNotification("Referral accepted", `${referral.id} · ${referral.patientName} — now in the live queue`);
      toast(`${referral.patientName} accepted — added to the live queue`);
    } else if (action === "enroute") {
      referral.status = "EN ROUTE";
      logAudit("Referral status updated — patient en route", "Dr. S. Bhatt", referral.patientName, "referral");
      toast(`${referral.patientName}: patient en route`);
    } else if (action === "received") {
      referral.status = "RECEIVED";
      const qp = db.patients.find(p => p.id === "REF-" + referral.id);
      if (qp) qp.status = "Under Assessment";
      logAudit("Patient received", "Dr. S. Bhatt", referral.patientName, "referral");
      toast(`${referral.patientName}: patient received`);
    } else if (action === "treatment") {
      referral.status = "TREATMENT";
      const qp = db.patients.find(p => p.id === "REF-" + referral.id);
      if (qp) qp.status = "Treatment";
      logAudit("Treatment started", "Dr. S. Bhatt", referral.patientName, "referral");
      toast(`${referral.patientName}: treatment started`);
    } else if (action === "complete") {
      referral.status = "COMPLETED";
      const qp = db.patients.find(p => p.id === "REF-" + referral.id);
      if (qp) qp.status = "Discharged";
      const followUp = {
        id: nextFollowUpId(), patientId: referral.patientId, patientName: referral.patientName,
        reason: "Post-referral follow-up: Glycemic & BP monitoring", dueLabel: "Due in 7 days", status: "Due", createdFrom: referral.id
      };
      db.followUps.unshift(followUp);
      logAudit("Referral completed", "Dr. S. Bhatt", referral.patientName, "referral");
      pushNotification("Follow-up due", `${referral.patientName} · Post-treatment follow-up`);
      toast(`${referral.patientName}: treatment completed — follow-up created`);
    }

    saveDB();
    renderHospitalReferrals();
    if (viewIsActive("h-dashboard")) renderHospitalDashboard();
    if (viewIsActive("h-queue")) renderFullQueueTable();
    if (viewIsActive("h-management")) renderManagementTable();
    if (viewIsActive("asha-referrals")) renderAshaReferralsTable();
    if (viewIsActive("asha-dashboard")) renderAshaDashboard();
    if (viewIsActive("asha-followups")) renderAshaFollowups();
  }

  function wireAsha() {
    wireAshaRegister();
    wireAshaPatientFilters();
    wireAshaPatientProfile();
    wireAshaUrgency();
    wireAshaReferrals();
    wireAshaEmergency();
    wireAshaOffline();
  }

  /* ========================================================================
     20. INIT
     ======================================================================== */

  // Reflects the browser's real navigator.onLine state — an honest signal,
  // not a decorative one. It doesn't imply the app has full offline sync;
  // that's what the Health Worker portal's offline demo explicitly scopes.
  function updateNetworkStatusUI(isOnline) {
    const pill = $("#networkStatus");
    const label = $("#networkStatusLabel");
    if (!pill || !label) return;
    pill.classList.toggle("offline", !isOnline);
    label.textContent = isOnline ? "Connected" : "Offline Mode";
  }

  function wireNetworkStatus() {
    updateNetworkStatusUI(navigator.onLine);
    window.addEventListener("online", () => {
      updateNetworkStatusUI(true);
      toast("Connection restored");
      if (db.pendingSyncQueue.length) syncAshaPendingRecords();
    });
    window.addEventListener("offline", () => {
      updateNetworkStatusUI(false);
      toast("You're offline — changes will be saved locally");
    });
  }

  function wireResetData() {
    const btn = $("#resetDataBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      toast("Demo data reset — reloading…");
      setTimeout(() => window.location.reload(), 400);
    });
  }

  function init() {
    const hadSavedState = loadDB();
    if (!hadSavedState) saveDB(); // this tab becomes the shared baseline for any other tab opened after it

    // The auth gate is the default state (body starts with class="pre-auth"
    // in the HTML). If this browser already has a valid login saved —
    // returning visitor, or another tab just signed in — reveal the app
    // immediately instead of making them log in again every load.
    if (getLoginState()) revealApp();

    wireNavigation();
    wireQueueFilters();
    wireMedicineFilters();
    wireTriage();
    wireIdentification();
    wirePatientQR();
    wireStaffScanner();
    wireRegistration();
    wireVaultFilters();
    wireUploadModal();
    wireVisitModal();
    wireAlertContacts();
    wireAmbulance();
    wireEmergencyMode();
    wireStaticForms();
    wireResetData();
    wireNetworkStatus();
    wireLogin();
    wireAsha();
    updateSignInButton();

    const heroGetStartedBtn = $("#heroGetStartedBtn");
    if (heroGetStartedBtn) {
      heroGetStartedBtn.addEventListener("click", () => {
        const el = $("#workflowSection");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    // Cross-tab live sync: another tab of this same browser changed the
    // shared state (e.g. Ambulance tab sent pre-arrival info) — pick it up
    // and silently refresh whatever's currently on screen.
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) { loadDB(); rerenderActiveView(); }
      if (e.key === LOGIN_STORAGE_KEY) {
        updateSignInButton();
        // Someone signed in/out in another tab — this tab's gate follows.
        if (getLoginState()) revealApp(); else showAuthGate();
      }
    });

    // Camera cleanup if the tab is closed/hidden mid-scan.
    window.addEventListener("beforeunload", stopScannerCamera);

    // Render the views that are active by default on first paint.
    renderHospitalDashboard();
    renderVaultGrid();
    renderAshaDashboard();

    setInterval(tickLiveQueue, 5000);

    toast(hadSavedState
      ? "Welcome back — restored your saved Lifora session"
      : "Welcome to Lifora — this is a live prototype with simulated data");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
