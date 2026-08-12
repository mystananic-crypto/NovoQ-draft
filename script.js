/* =========================================
   LIFORA INDIA — CORE SCRIPT
========================================= */
document.addEventListener("DOMContentLoaded", () => {

  const STORAGE_KEY = "lifora_patient_profile_v1";

  const state = {
    hospitalName: "Sanjivani Multispeciality Hospital",
    unitId: "ICU-BAY-04, Ahmedabad",
    contactName: "Sunita Sharma (Spouse)",
    contactPhone: "+91 98765 43210",
    alertSent: false,
    scanInterval: null
  };

  /* ---------- MODAL ELEMENTS ---------- */
  const scannerModal = document.getElementById("scannerModal");
  const qrModal = document.getElementById("qrModal");
  const notifyModal = document.getElementById("notifyModal");
  const fullFormModal = document.getElementById("fullFormModal");

  const scannerSelectionView = document.getElementById("scannerSelectionView");
  const fingerprintScanScreen = document.getElementById("fingerprintScanScreen");
  const irisScanScreen = document.getElementById("irisScanScreen");
  const scanSuccessScreen = document.getElementById("scanSuccessScreen");

  const fingerprintProgressBar = document.getElementById("fingerprintProgressBar");
  const fingerprintPercentText = document.getElementById("fingerprintPercentText");
  const irisProgressBar = document.getElementById("irisProgressBar");
  const irisPercentText = document.getElementById("irisPercentText");

  const notifyFormView = document.getElementById("notifyFormView");
  const notifySuccessView = document.getElementById("notifySuccessView");

  const dashAlertStatus = document.getElementById("dashAlertStatus");
  const dashAlertIndicator = document.getElementById("dashAlertIndicator");
  const dashRoomStatus = document.getElementById("dashRoomStatus");
  const dashRoomIndicator = document.getElementById("dashRoomIndicator");
  const wfStep2 = document.getElementById("wfStep2");
  const wfStep3 = document.getElementById("wfStep3");
  const wfStep4 = document.getElementById("wfStep4");

  function openModal(modal){ if (modal) modal.classList.add("show-modal"); }
  function closeModal(modal){
    if (modal) modal.classList.remove("show-modal");
    if (state.scanInterval){ clearInterval(state.scanInterval); state.scanInterval = null; }
  }

  document.querySelectorAll(".lifora-modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay") || e.target.classList.contains("close-modal")) {
        closeModal(modal);
      }
    });
  });

  /* ---------- MOBILE NAV ---------- */
  const navBurger = document.getElementById("navBurger");
  const navLinksList = document.querySelector(".nav-links");
  if (navBurger) {
    navBurger.addEventListener("click", () => {
      navLinksList.style.display = navLinksList.style.display === "flex" ? "none" : "flex";
      if (navLinksList.style.display === "flex") {
        navLinksList.style.cssText += "flex-direction:column;position:absolute;top:64px;left:0;right:0;background:#101F33;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.08);";
      }
    });
  }

  /* ---------- 3D TILT ON CARDS ---------- */
  document.querySelectorAll(".tilt-card").forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y / rect.height) - 0.5) * -10;
      const rotateY = ((x / rect.width) - 0.5) * 10;
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(900px) rotateX(0) rotateY(0) translateZ(0)";
    });
  });

  /* ---------- ID CARD MOUSE PARALLAX ---------- */
  const idCard3D = document.getElementById("idCard3D");
  const heroVisual = document.querySelector(".hero-visual");
  if (idCard3D && heroVisual) {
    heroVisual.addEventListener("mousemove", (e) => {
      const rect = heroVisual.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) - 0.5;
      const y = ((e.clientY - rect.top) / rect.height) - 0.5;
      idCard3D.style.transform = `rotateY(${-18 + x * 20}deg) rotateX(${8 - y * 16}deg)`;
    });
    heroVisual.addEventListener("mouseleave", () => {
      idCard3D.style.transform = "";
    });
  }

  /* ---------- SCAN TRIGGERS ---------- */
  [document.getElementById("heroScanBtn"), document.getElementById("openCriticalScanBtn"), document.getElementById("dashCriticalBtn")]
    .forEach(btn => btn && btn.addEventListener("click", () => { resetScannerModal(); openModal(scannerModal); }));

  [document.getElementById("openQRScanBtn"), document.getElementById("dashQRBtn")]
    .forEach(btn => btn && btn.addEventListener("click", () => openModal(qrModal)));

  [document.getElementById("openNotifyModalNav"), document.getElementById("openNotifyModalBtn"), document.getElementById("dashSendAlertBtn"), document.getElementById("notifyKinBtn")]
    .forEach(btn => btn && btn.addEventListener("click", () => {
      updateNotificationModalDetails();
      notifyFormView.style.display = "block";
      notifySuccessView.style.display = "none";
      openModal(notifyModal);
    }));

  document.getElementById("closeScannerModal")?.addEventListener("click", () => closeModal(scannerModal));
  document.getElementById("closeQRModal")?.addEventListener("click", () => closeModal(qrModal));
  document.getElementById("closeNotifyModal")?.addEventListener("click", () => closeModal(notifyModal));
  document.getElementById("closeFullFormModal")?.addEventListener("click", () => closeModal(fullFormModal));

  /* ---------- FULL FORM OPEN TRIGGERS ---------- */
  [document.getElementById("heroRegisterBtn"), document.getElementById("openFullFormBtn"), document.getElementById("openEditContactBtn")]
    .forEach(btn => btn && btn.addEventListener("click", (e) => {
      loadFormFromStorage();
      const jumpToContacts = e.currentTarget.id === "openEditContactBtn";
      goToTab(jumpToContacts ? 3 : 0);
      document.getElementById("formSuccessView").style.display = "none";
      document.getElementById("patientInfoForm").style.display = "block";
      openModal(fullFormModal);
    }));

  document.getElementById("finishScanFormBtn")?.addEventListener("click", () => {
    closeModal(scannerModal);
    loadFormFromStorage();
    goToTab(0);
    document.getElementById("formSuccessView").style.display = "none";
    document.getElementById("patientInfoForm").style.display = "block";
    openModal(fullFormModal);
  });

  /* ---------- BIOMETRIC SCAN WORKFLOW ---------- */
  const selectFingerprintBtn = document.getElementById("selectFingerprintBtn");
  const selectIrisBtn = document.getElementById("selectIrisBtn");
  const finishScanBtn = document.getElementById("finishScanBtn");

  selectFingerprintBtn?.addEventListener("click", () => runScanProcess("fingerprint"));
  selectIrisBtn?.addEventListener("click", () => runScanProcess("iris"));
  finishScanBtn?.addEventListener("click", () => {
    closeModal(scannerModal);
    document.getElementById("profile")?.scrollIntoView({ behavior: "smooth" });
  });

  function resetScannerModal(){
    scannerSelectionView.style.display = "block";
    fingerprintScanScreen.style.display = "none";
    irisScanScreen.style.display = "none";
    scanSuccessScreen.style.display = "none";
    fingerprintProgressBar.style.width = "0%";
    irisProgressBar.style.width = "0%";
    fingerprintPercentText.textContent = "0%";
    irisPercentText.textContent = "0%";
  }

  function runScanProcess(type){
    scannerSelectionView.style.display = "none";
    let progress = 0;
    if (type === "fingerprint") {
      fingerprintScanScreen.style.display = "block";
      state.scanInterval = setInterval(() => {
        progress += 4;
        fingerprintProgressBar.style.width = `${progress}%`;
        fingerprintPercentText.textContent = `${progress}%`;
        if (progress >= 100){ clearInterval(state.scanInterval); setTimeout(showScanSuccess, 400); }
      }, 80);
    } else {
      irisScanScreen.style.display = "block";
      state.scanInterval = setInterval(() => {
        progress += 5;
        irisProgressBar.style.width = `${progress}%`;
        irisPercentText.textContent = `${progress}%`;
        if (progress >= 100){ clearInterval(state.scanInterval); setTimeout(showScanSuccess, 400); }
      }, 70);
    }
  }

  function showScanSuccess(){
    fingerprintScanScreen.style.display = "none";
    irisScanScreen.style.display = "none";
    scanSuccessScreen.style.display = "block";
    populateScanSuccessCard();
    [wfStep2, wfStep3].forEach(step => step && step.classList.add("active-workflow"));
  }

  function populateScanSuccessCard(){
    const saved = getSavedProfile();
    const name = saved.pFullName || "Rajesh Kumar Sharma";
    const blood = saved.pBlood || "B+";
    const allergies = saved.pAllergies || "Penicillin, Groundnuts";
    const contact = saved.pPrimaryName ? `${saved.pPrimaryName}${saved.pPrimaryRel ? " (" + saved.pPrimaryRel + ")" : ""}` : "Sunita Sharma (Spouse)";
    document.getElementById("scanRecordName").textContent = name;
    document.getElementById("scanRecordBlood").textContent = bloodLabel(blood);
    document.getElementById("scanRecordAllergies").textContent = allergies;
    document.getElementById("scanRecordContact").textContent = contact;
  }

  function bloodLabel(code){
    const map = {"A+":"A Positive (A+)","A-":"A Negative (A-)","B+":"B Positive (B+)","B-":"B Negative (B-)","AB+":"AB Positive (AB+)","AB-":"AB Negative (AB-)","O+":"O Positive (O+)","O-":"O Negative (O-)"};
    return map[code] || code;
  }

  /* ---------- QR SCAN ---------- */
  const simulateQRScanBtn = document.getElementById("simulateQRScanBtn");
  simulateQRScanBtn?.addEventListener("click", () => {
    simulateQRScanBtn.disabled = true;
    simulateQRScanBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Reading Lifora QR Code...`;
    setTimeout(() => {
      simulateQRScanBtn.disabled = false;
      simulateQRScanBtn.innerHTML = `<i class="fa-solid fa-camera"></i> Simulate Camera Scan`;
      closeModal(qrModal);
      resetScannerModal();
      showScanSuccess();
      openModal(scannerModal);
    }, 1200);
  });

  /* ---------- SOS DISPATCH ---------- */
  const confirmSendAlertBtn = document.getElementById("confirmSendAlertBtn");
  const closeNotifySuccessBtn = document.getElementById("closeNotifySuccessBtn");

  confirmSendAlertBtn?.addEventListener("click", () => {
    confirmSendAlertBtn.disabled = true;
    confirmSendAlertBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting SOS...`;
    setTimeout(() => {
      confirmSendAlertBtn.disabled = false;
      confirmSendAlertBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Confirm & Transmit SOS Alert`;
      notifyFormView.style.display = "none";
      notifySuccessView.style.display = "block";

      state.alertSent = true;
      if (dashAlertStatus){ dashAlertStatus.textContent = "DISPATCHED"; dashAlertStatus.style.color = "#17C98A"; }
      if (dashAlertIndicator){ dashAlertIndicator.classList.remove("waiting"); dashAlertIndicator.classList.add("success-status"); }
      if (dashRoomStatus){ dashRoomStatus.textContent = "BAY ALLOCATED"; dashRoomStatus.style.color = "#17C98A"; }
      if (dashRoomIndicator){ dashRoomIndicator.classList.remove("waiting"); dashRoomIndicator.classList.add("success-status"); }
      [wfStep2, wfStep3, wfStep4].forEach(step => step && step.classList.add("active-workflow"));
    }, 1200);
  });

  closeNotifySuccessBtn?.addEventListener("click", () => closeModal(notifyModal));

  function updateNotificationModalDetails(){
    const modalHospName = document.getElementById("modalHospName");
    const modalContactName = document.getElementById("modalContactName");
    const saved = getSavedProfile();
    const contact = saved.pPrimaryName ? `${saved.pPrimaryName} (+91 ${saved.pPrimaryPhone || "—"})` : `${state.contactName} (${state.contactPhone})`;
    if (modalHospName) modalHospName.textContent = state.hospitalName;
    if (modalContactName) modalContactName.textContent = contact;
  }

  /* ---------- HOSPITAL FACILITY FORM ---------- */
  document.getElementById("hospitalConfigForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.hospitalName = document.getElementById("hospNameInput").value;
    state.unitId = document.getElementById("hospUnitInput").value;
    document.getElementById("contactHospital").textContent = state.hospitalName;
    const btn = e.target.querySelector("button");
    const original = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-check"></i> Station Info Updated`;
    setTimeout(() => btn.innerHTML = original, 1600);
  });

  /* ==========================================================
     FULL PATIENT INFORMATION FORM (Sections A–E) + localStorage
  ========================================================== */
  const TAB_COUNT = 5;
  let currentTab = 0;
  const formTabs = Array.from(document.querySelectorAll(".form-tab"));
  const formPanels = Array.from(document.querySelectorAll(".form-panel"));
  const formBackBtn = document.getElementById("formBackBtn");
  const formNextBtn = document.getElementById("formNextBtn");
  const formSubmitBtn = document.getElementById("formSubmitBtn");
  const formProgressDots = document.getElementById("formProgressDots");

  // Build progress dots
  for (let i = 0; i < TAB_COUNT; i++){
    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("dot-active");
    formProgressDots.appendChild(dot);
  }

  function goToTab(index){
    currentTab = Math.max(0, Math.min(TAB_COUNT - 1, index));
    formTabs.forEach((tab, i) => tab.classList.toggle("active", i === currentTab));
    formPanels.forEach((panel, i) => panel.classList.toggle("active", i === currentTab));
    Array.from(formProgressDots.children).forEach((dot, i) => dot.classList.toggle("dot-active", i === currentTab));
    formBackBtn.disabled = currentTab === 0;
    const isLast = currentTab === TAB_COUNT - 1;
    formNextBtn.style.display = isLast ? "none" : "flex";
    formSubmitBtn.style.display = isLast ? "flex" : "none";
  }

  formTabs.forEach(tab => tab.addEventListener("click", () => goToTab(parseInt(tab.dataset.tab, 10))));
  formNextBtn.addEventListener("click", () => goToTab(currentTab + 1));
  formBackBtn.addEventListener("click", () => goToTab(currentTab - 1));

  // GPS detection (Section E)
  const detectGPSBtn = document.getElementById("detectGPSBtn");
  detectGPSBtn?.addEventListener("click", () => {
    const gpsInput = document.getElementById("pGPS");
    if (!navigator.geolocation){
      gpsInput.value = "Location services unavailable on this device";
      return;
    }
    detectGPSBtn.disabled = true;
    detectGPSBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating...`;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsInput.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        detectGPSBtn.disabled = false;
        detectGPSBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Detect`;
      },
      () => {
        gpsInput.value = "Permission denied — enter address manually";
        detectGPSBtn.disabled = false;
        detectGPSBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Detect`;
      }
    );
  });

  // Aadhaar auto-mask formatting
  const aadhaarInput = document.getElementById("pAadhaar");
  aadhaarInput?.addEventListener("input", () => {
    let digits = aadhaarInput.value.replace(/\D/g, "").slice(0, 12);
    aadhaarInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  });

  const FIELD_IDS = [
    "pFullName","pPOB","pDOBDay","pDOBMonth","pDOBYear","pGender","pStatus","pBlood","pPhone","pCity","pAddress","pPostcode",
    "pConditions","pAllergies","pMeds","pSurgeries",
    "pHeight","pWeight","pDisability","pPregnancy",
    "pPrimaryName","pPrimaryRel","pPrimaryPhone","pSecondaryName","pSecondaryRel","pSecondaryPhone",
    "pGPS","pHomeAddress","pAadhaar","pInsurance"
  ];

  function getSavedProfile(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(err){ return {}; }
  }

  function loadFormFromStorage(){
    const saved = getSavedProfile();
    FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && saved[id] !== undefined) el.value = saved[id];
    });
  }

  document.getElementById("patientInfoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {};
    FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) data[id] = el.value;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch(err) { /* local storage unavailable — continue silently */ }

    applyProfileToPage(data);

    document.getElementById("patientInfoForm").style.display = "none";
    document.getElementById("formSuccessView").style.display = "block";
  });

  document.getElementById("closeFullFormSuccessBtn")?.addEventListener("click", () => {
    closeModal(fullFormModal);
    document.getElementById("profile")?.scrollIntoView({ behavior: "smooth" });
  });

  function applyProfileToPage(data){
    const heroCardName = document.getElementById("heroCardName");
    if (data.pFullName){
      document.getElementById("profName").textContent = data.pFullName;
      if (heroCardName){
        heroCardName.textContent = data.pFullName;
        heroCardName.classList.remove("masked");
      }
    }
    if (data.pBlood){
      const label = bloodLabel(data.pBlood);
      document.getElementById("profBlood").textContent = label;
      const heroCardBlood = document.getElementById("heroCardBlood");
      if (heroCardBlood) heroCardBlood.textContent = label;
    }
    if (data.pAllergies) document.getElementById("profAllergies").textContent = data.pAllergies;
    if (data.pConditions) document.getElementById("profConditions").textContent = data.pConditions;
    if (data.pMeds) document.getElementById("profMeds").textContent = data.pMeds;
    if (data.pPrimaryName){
      const label = `${data.pPrimaryName}${data.pPrimaryRel ? " (" + data.pPrimaryRel + ")" : ""}`;
      document.getElementById("contactName").textContent = label;
      state.contactName = label;
    }
    if (data.pPrimaryPhone){
      const phoneLabel = `+91 ${data.pPrimaryPhone}`;
      document.getElementById("contactPhone").textContent = phoneLabel;
      state.contactPhone = phoneLabel;
      const heroCardPhone = document.getElementById("heroCardPhone");
      if (heroCardPhone) heroCardPhone.textContent = phoneLabel;
    }
  }

  // Pre-fill saved profile onto the live page on load
  (function hydrateFromStorage(){
    const saved = getSavedProfile();
    if (Object.keys(saved).length) applyProfileToPage(saved);
  })();

  /* ---------- INTERACTIVE CASE SIMULATION ---------- */
  const startSimBtn = document.getElementById("startSimBtn");
  const simChooseBiometric = document.getElementById("simChooseBiometric");
  const simChooseQR = document.getElementById("simChooseQR");
  const resetSimBtn = document.getElementById("resetSimBtn");

  const simStep1View = document.getElementById("simStep1View");
  const simStep2View = document.getElementById("simStep2View");
  const simStep3View = document.getElementById("simStep3View");
  const simStep4View = document.getElementById("simStep4View");

  const simStatusText = document.getElementById("simStatusText");
  const simStatusBadge = document.getElementById("simStatusBadge");
  const simProgressBar = document.getElementById("simProgressBar");

  const simStep1Indicator = document.getElementById("simStep1Indicator");
  const simStep2Indicator = document.getElementById("simStep2Indicator");
  const simStep3Indicator = document.getElementById("simStep3Indicator");
  const simStep4Indicator = document.getElementById("simStep4Indicator");

  const simLine1 = document.getElementById("simLine1");
  const simLine2 = document.getElementById("simLine2");
  const simLine3 = document.getElementById("simLine3");

  startSimBtn?.addEventListener("click", () => {
    simStep1View.style.display = "none";
    simStep2View.style.display = "block";
    simStatusText.textContent = "Step 2: Patient Triage";
    simStatusBadge.className = "simulation-status active-simulation-status";
    simStep2Indicator.classList.add("active");
    simLine1.classList.add("completed-line");
  });

  simChooseBiometric?.addEventListener("click", () => runSimProgress("biometric"));
  simChooseQR?.addEventListener("click", () => runSimProgress("qr"));

  function runSimProgress(type){
    simStep2View.style.display = "none";
    simStep3View.style.display = "block";
    simStatusText.textContent = "Step 3: Transmitting Vitals";
    simStep3Indicator.classList.add("active");
    simLine2.classList.add("completed-line");

    const dispatchText = document.getElementById("simDispatchText");
    if (dispatchText){
      dispatchText.textContent = type === "biometric"
        ? "Scanning fingerprint biometric pattern & matching with Lifora Central Health Cloud..."
        : "Decrypting patient QR health card & requesting consent token...";
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (simProgressBar) simProgressBar.style.width = `${progress}%`;
      if (progress >= 100){
        clearInterval(interval);
        setTimeout(() => {
          simStep3View.style.display = "none";
          simStep4View.style.display = "block";
          simStatusText.textContent = "Completed";
          simStatusBadge.className = "simulation-status completed-simulation-status";
          simStep4Indicator.classList.add("active", "completed");
          simLine3.classList.add("completed-line");
        }, 500);
      }
    }, 150);
  }

  resetSimBtn?.addEventListener("click", () => {
    simStep4View.style.display = "none";
    simStep1View.style.display = "block";
    simStatusText.textContent = "Ready to Begin";
    simStatusBadge.className = "simulation-status waiting-status";
    [simStep2Indicator, simStep3Indicator, simStep4Indicator].forEach(ind => ind.classList.remove("active", "completed"));
    [simLine1, simLine2, simLine3].forEach(line => line.classList.remove("completed-line"));
    if (simProgressBar) simProgressBar.style.width = "0%";
  });

  /* ---------- NAVBAR SHRINK ON SCROLL ---------- */
  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 30) navbar.style.boxShadow = "0 10px 30px -18px rgba(0,0,0,.6)";
    else navbar.style.boxShadow = "none";
  });

});
