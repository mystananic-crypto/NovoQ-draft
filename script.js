/* =========================================================
   LIFORA - COMPLETE WEBSITE JAVASCRIPT
   Critical Patient | Non-Critical Patient | Emergency Contact
========================================================= */


/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}

function scrollToSection(sectionId) {
    const section = getElement(sectionId);

    if (section) {
        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


/* =========================================================
   PAGE LOADER
========================================================= */

window.addEventListener("load", function () {

    const loader = getElement("pageLoader");

    if (loader) {
        setTimeout(function () {
            loader.classList.add("hide-loader");
        }, 500);
    }

});


/* =========================================================
   NAVIGATION
========================================================= */

function toggleMobileMenu() {

    const navLinks = getElement("navLinks");

    if (navLinks) {
        navLinks.classList.toggle("show-nav");
    }

}


/* =========================================================
   PATIENT FORM / MODAL FUNCTIONS
========================================================= */

function openPatientForm(patientType) {

    const modal = getElement("patientFormModal");

    if (!modal) {
        console.log("Patient form modal not found.");
        return;
    }

    const title = getElement("patientFormTitle");

    if (title) {
        title.innerText =
            patientType === "critical"
                ? "Critical Patient Emergency Information"
                : "Non-Critical Patient Information";
    }

    modal.classList.add("show-modal");
    document.body.style.overflow = "hidden";
}


function closePatientForm() {

    const modal = getElement("patientFormModal");

    if (modal) {
        modal.classList.remove("show-modal");
    }

    document.body.style.overflow = "auto";
}


/* =========================================================
   CRITICAL PATIENT
========================================================= */

function openCriticalPatient() {

    const modal = getElement("scannerModal");

    if (!modal) {
        console.log("Scanner modal not found.");
        return;
    }

    modal.classList.add("show-modal");
    document.body.style.overflow = "hidden";

    const scannerTitle = getElement("scannerTitle");

    if (scannerTitle) {
        scannerTitle.innerText =
            "Choose Identification Method";
    }

    const scannerContent = getElement("scannerContent");

    if (scannerContent) {

        scannerContent.innerHTML = `

            <div class="scanner-choice-container">

                <p class="scanner-description">
                    Select a secure identification method for
                    the unconscious or critical patient.
                </p>

                <div class="scanner-choice-buttons">

                    <button
                        type="button"
                        class="scanner-choice biometric-choice"
                        onclick="startTenSecondScan('biometric')"
                    >

                        <i class="fa-solid fa-fingerprint"></i>

                        <strong>Biometric Scan</strong>

                        <span>
                            Verify patient identity using biometric data
                        </span>

                    </button>


                    <button
                        type="button"
                        class="scanner-choice iris-choice"
                        onclick="startTenSecondScan('iris')"
                    >

                        <i class="fa-solid fa-eye"></i>

                        <strong>Iris Scan</strong>

                        <span>
                            Verify patient identity using iris recognition
                        </span>

                    </button>

                </div>

            </div>

        `;

    }

}


function closeScannerModal() {

    const modal = getElement("scannerModal");

    if (modal) {
        modal.classList.remove("show-modal");
    }

    document.body.style.overflow = "auto";
}


/* =========================================================
   10 SECOND BIOMETRIC / IRIS SCAN
========================================================= */

let scanTimer = null;


function startTenSecondScan(scanType) {

    const scannerContent = getElement("scannerContent");

    if (!scannerContent) return;

    const icon =
        scanType === "iris"
            ? "fa-eye"
            : "fa-fingerprint";

    const title =
        scanType === "iris"
            ? "Iris Scanner Verification"
            : "Biometric Identification";


    scannerContent.innerHTML = `

        <div class="lifora-scanning-screen">

            <div class="scan-animation">

                <div class="scan-circle">

                    <i class="fa-solid ${icon}"></i>

                </div>

            </div>

            <span class="scan-label">
                SECURE IDENTIFICATION IN PROGRESS
            </span>

            <h3>${title}</h3>

            <p>
                Lifora is securely scanning the patient.
                Please wait while identification is completed.
            </p>

            <div class="scan-countdown">

                <span id="scanSeconds">10</span>

                <small>seconds remaining</small>

            </div>

            <div class="scan-progress-container">

                <div
                    id="scanProgress"
                    class="scan-progress"
                    style="width: 0%;"
                ></div>

            </div>

        </div>

    `;


    let seconds = 10;

    const countdown = getElement("scanSeconds");
    const progress = getElement("scanProgress");


    clearInterval(scanTimer);


    scanTimer = setInterval(function () {

        seconds--;

        if (countdown) {
            countdown.innerText = seconds;
        }

        if (progress) {

            const percentage =
                ((10 - seconds) / 10) * 100;

            progress.style.width =
                percentage + "%";
        }


        if (seconds <= 0) {

            clearInterval(scanTimer);

            scanCompleted(scanType);
        }

    }, 1000);

}


function scanCompleted(scanType) {

    const scannerContent = getElement("scannerContent");

    if (!scannerContent) return;


    const scanName =
        scanType === "iris"
            ? "Iris"
            : "Biometric";


    scannerContent.innerHTML = `

        <div class="scan-success-screen">

            <div class="scan-success-icon">

                <i class="fa-solid fa-circle-check"></i>

            </div>

            <h3>${scanName} Identity Verified</h3>

            <p>
                Patient identification was completed successfully.
                Opening the emergency information form...
            </p>

        </div>

    `;


    setTimeout(function () {

        closeScannerModal();

        openPatientForm("critical");

    }, 1500);

}


/* =========================================================
   NON-CRITICAL PATIENT
========================================================= */

function openNonCriticalPatient() {

    openPatientForm("noncritical");

}


/* =========================================================
   SAVE PATIENT INFORMATION
   DATA IS SAVED IN BROWSER LOCAL STORAGE
========================================================= */

function savePatientInformation() {

    const form = getElement("patientInformationForm");

    if (!form) {
        alert("Patient form was not found.");
        return;
    }


    const formData = new FormData(form);

    const patientData = {};


    formData.forEach(function (value, key) {

        patientData[key] = value;

    });


    patientData.savedAt =
        new Date().toLocaleString();


    localStorage.setItem(
        "liforaPatientInformation",
        JSON.stringify(patientData)
    );


    updateEmergencyStatus(
        "Identified",
        "Available",
        "Saved"
    );


    alert(
        "Patient information has been saved successfully."
    );


    closePatientForm();

}


function loadPatientInformation() {

    const savedData =
        localStorage.getItem(
            "liforaPatientInformation"
        );


    if (!savedData) return;


    let patientData;


    try {

        patientData =
            JSON.parse(savedData);

    } catch (error) {

        console.log(
            "Unable to load patient information."
        );

        return;
    }


    const form = getElement(
        "patientInformationForm"
    );


    if (!form) return;


    Object.keys(patientData).forEach(
        function (key) {

            const field =
                form.querySelector(
                    `[name="${key}"]`
                );

            if (field) {

                field.value =
                    patientData[key];

            }

        }
    );

}


/* =========================================================
   EMERGENCY STATUS
========================================================= */

function updateEmergencyStatus(
    identification,
    medical,
    contact
) {

    const identificationStatus =
        getElement("identificationStatus");

    const medicalStatus =
        getElement("medicalStatus");

    const contactStatus =
        getElement("contactStatus");


    if (
        identificationStatus &&
        identification
    ) {

        identificationStatus.innerText =
            identification;

    }


    if (medicalStatus && medical) {

        medicalStatus.innerText =
            medical;

    }


    if (contactStatus && contact) {

        contactStatus.innerText =
            contact;

    }

}


/* =========================================================
   EMERGENCY CONTACT
========================================================= */

function notifyEmergencyContact() {

    const notification =
        getElement("notificationStatus");


    if (notification) {

        notification.innerHTML = `

            <i class="fa-solid fa-spinner fa-spin"></i>
            Sending emergency notification...

        `;

    }


    setTimeout(function () {

        if (notification) {

            notification.innerHTML = `

                <i class="fa-solid fa-circle-check"></i>
                Emergency contact notified successfully.
                Hospital name and location have been shared.

            `;

        }


        updateEmergencyStatus(
            "Identified",
            "Available",
            "Notified"
        );

    }, 1800);

}


function openContactModal() {

    const modal =
        getElement("contactModal");

    if (modal) {

        modal.classList.add(
            "show-modal"
        );

    }

}


function closeContactModal() {

    const modal =
        getElement("contactModal");

    if (modal) {

        modal.classList.remove(
            "show-modal"
        );

    }

}


function saveEmergencyContact() {

    const contactName =
        getElement("contactName");

    const contactPhone =
        getElement("contactPhone");


    const savedName =
        contactName &&
        contactName.value.trim() !== ""

            ? contactName.value.trim()

            : "Emergency Contact";


    const savedPhone =
        contactPhone &&
        contactPhone.value.trim() !== ""

            ? contactPhone.value.trim()

            : "Contact Number Not Added";


    localStorage.setItem(
        "liforaEmergencyContactName",
        savedName
    );


    localStorage.setItem(
        "liforaEmergencyContactPhone",
        savedPhone
    );


    const displayName =
        getElement("displayContactName");

    const displayPhone =
        getElement("displayContactPhone");


    if (displayName) {

        displayName.innerText =
            savedName;

    }


    if (displayPhone) {

        displayPhone.innerText =
            savedPhone;

    }


    closeContactModal();

}


/* =========================================================
   HOSPITAL INFORMATION
========================================================= */

function saveHospitalInformation() {

    const hospitalName =
        getElement("hospitalNameInput");

    const hospitalLocation =
        getElement("hospitalLocationInput");


    const savedHospital =
        hospitalName &&
        hospitalName.value.trim() !== ""

            ? hospitalName.value.trim()

            : "Selected Hospital";


    const savedLocation =
        hospitalLocation &&
        hospitalLocation.value.trim() !== ""

            ? hospitalLocation.value.trim()

            : "Hospital Location";


    localStorage.setItem(
        "liforaHospitalName",
        savedHospital
    );


    localStorage.setItem(
        "liforaHospitalLocation",
        savedLocation
    );


    const hospitalDisplay =
        getElement("hospitalNameDisplay");

    const locationDisplay =
        getElement("hospitalLocationDisplay");


    if (hospitalDisplay) {

        hospitalDisplay.innerText =
            savedHospital;

    }


    if (locationDisplay) {

        locationDisplay.innerText =
            savedLocation;

    }


    alert(
        "Hospital details saved successfully."
    );

}


/* THIS FUNCTION SUPPORTS
   THE DASHBOARD HOSPITAL FIELDS */

function saveHospitalDetails() {

    const dashboardName =
        getElement("dashboardHospitalName");

    const dashboardLocation =
        getElement("dashboardHospitalLocation");


    const savedHospital =
        dashboardName &&
        dashboardName.value.trim() !== ""

            ? dashboardName.value.trim()

            : "Selected Hospital";


    const savedLocation =
        dashboardLocation &&
        dashboardLocation.value.trim() !== ""

            ? dashboardLocation.value.trim()

            : "Hospital Location";


    localStorage.setItem(
        "liforaHospitalName",
        savedHospital
    );


    localStorage.setItem(
        "liforaHospitalLocation",
        savedLocation
    );


    alert(
        "Hospital details saved successfully."
    );

}


/* =========================================================
   EMERGENCY CONSENT
========================================================= */

function startConsentProcess() {

    const consentStatus =
        getElement("consentStatus");


    if (consentStatus) {

        consentStatus.innerHTML = `

            <i class="fa-solid fa-file-signature"></i>

            Consent process initiated.

            The emergency contact has been informed about
            the hospital and can proceed for written consent.

        `;

    }


    scrollToSection(
        "consentSection"
    );

}


/* =========================================================
   EMERGENCY SIMULATION
========================================================= */

let currentSimulationType = "";


function startEmergencySimulation() {

    const screen =
        getElement("simulationScreen");

    const title =
        getElement("simulationCaseTitle");

    const status =
        getElement("simulationStatus");


    if (!screen) return;


    if (title) {

        title.innerText =
            "Patient Type Selection";

    }


    if (status) {

        status.className =
            "simulation-status active-simulation-status";

        status.innerHTML = `
            <span></span>
            Case In Progress
        `;

    }


    updateSimulationStep(1);


    screen.innerHTML = `

        <div class="simulation-choice">

            <span>STEP 01 OF 05</span>

            <h3>Select Patient Condition</h3>

            <p>
                Choose the appropriate identification process
                according to the patient's condition.
            </p>


            <div class="patient-choice-buttons">


                <button
                    class="patient-choice-btn critical-choice"
                    onclick="simulateCriticalPatient()"
                >

                    <div class="choice-icon">

                        <i class="fa-solid fa-heart-pulse"></i>

                    </div>

                    <strong>
                        Critical / Unconscious Patient
                    </strong>

                    <small>
                        Biometric and iris identification
                        for rapid emergency information access.
                    </small>

                </button>


                <button
                    class="patient-choice-btn noncritical-choice"
                    onclick="simulateNonCriticalPatient()"
                >

                    <div class="choice-icon">

                        <i class="fa-solid fa-qrcode"></i>

                    </div>

                    <strong>
                        Non-Critical Patient
                    </strong>

                    <small>
                        Secure QR identification for faster
                        emergency documentation.
                    </small>

                </button>

            </div>

        </div>

    `;

}


function simulateCriticalPatient() {

    currentSimulationType = "critical";

    runIdentificationScan(
        "Critical Patient",
        "fa-fingerprint",
        "Biometric and Iris Identification"
    );

}


function simulateNonCriticalPatient() {

    currentSimulationType = "noncritical";

    runIdentificationScan(
        "Non-Critical Patient",
        "fa-qrcode",
        "Secure QR Identification"
    );

}


function runIdentificationScan(
    patientType,
    icon,
    scanMethod
) {

    const screen =
        getElement("simulationScreen");

    const title =
        getElement("simulationCaseTitle");


    if (!screen) return;


    if (title) {

        title.innerText =
            patientType;

    }


    updateSimulationStep(2);


    screen.innerHTML = `

        <div class="scanning-screen">

            <div class="scanner-circle">

                <i class="fa-solid ${icon}"></i>

            </div>


            <span class="verified-text">

                IDENTIFICATION IN PROGRESS

            </span>


            <h3>${scanMethod}</h3>


            <p>

                Lifora is securely processing the patient
                identification request.

            </p>

        </div>

    `;


    setTimeout(function () {

        showIdentificationSuccess(
            patientType
        );

    }, 2200);

}


function showIdentificationSuccess(
    patientType
) {

    const screen =
        getElement("simulationScreen");


    if (!screen) return;


    screen.innerHTML = `

        <div class="simulation-result">

            <div class="simulation-result-icon">

                <i class="fa-solid fa-circle-check"></i>

            </div>


            <span class="verified-text">

                IDENTITY VERIFIED

            </span>


            <h3>

                Patient Successfully Identified

            </h3>


            <p>

                Essential emergency information is now available
                to authorized healthcare personnel.

            </p>


            <button
                class="simulation-next-btn"
                onclick="simulateMedicalAccess()"
            >

                Access Emergency Information

                <i class="fa-solid fa-arrow-right"></i>

            </button>

        </div>

    `;

}


function simulateMedicalAccess() {

    const screen =
        getElement("simulationScreen");


    if (!screen) return;


    updateSimulationStep(3);


    screen.innerHTML = `

        <div class="simulation-result">

            <div class="simulation-result-icon">

                <i class="fa-solid fa-file-medical"></i>

            </div>


            <span class="verified-text">

                AUTHORIZED ACCESS

            </span>


            <h3>

                Emergency Profile Retrieved

            </h3>


            <p>

                Essential medical information such as blood group,
                allergies, medical history and emergency contact
                details can now be reviewed.

            </p>


            <button
                class="simulation-next-btn"
                onclick="simulateEmergencyNotification()"
            >

                Notify Emergency Contact

                <i class="fa-solid fa-bell"></i>

            </button>

        </div>

    `;

}


function simulateEmergencyNotification() {

    const screen =
        getElement("simulationScreen");


    if (!screen) return;


    updateSimulationStep(4);


    const hospitalName =
        localStorage.getItem(
            "liforaHospitalName"
        ) || "Selected Hospital";


    const hospitalLocation =
        localStorage.getItem(
            "liforaHospitalLocation"
        ) || "Hospital Location";


    screen.innerHTML = `

        <div class="simulation-result">

            <div class="simulation-result-icon">

                <i class="fa-solid fa-paper-plane"></i>

            </div>


            <span class="verified-text">

                EMERGENCY ALERT SENT

            </span>


            <h3>

                Emergency Contact Notified

            </h3>


            <p>

                The emergency contact has received the
                hospital information.

            </p>


            <div class="simulation-hospital-preview">

                <strong>

                    <i class="fa-solid fa-hospital"></i>

                    ${hospitalName}

                </strong>


                <span>

                    <i class="fa-solid fa-location-dot"></i>

                    ${hospitalLocation}

                </span>

            </div>


            <button
                class="simulation-next-btn"
                onclick="simulateConsentStep()"
            >

                Continue to Consent Process

                <i class="fa-solid fa-file-signature"></i>

            </button>

        </div>

    `;

}


function simulateConsentStep() {

    const screen =
        getElement("simulationScreen");

    const status =
        getElement("simulationStatus");


    if (!screen) return;


    updateSimulationStep(5);


    if (status) {

        status.className =
            "simulation-status completed-simulation-status";

        status.innerHTML = `
            <span></span>
            Workflow Completed
        `;

    }


    screen.innerHTML = `

        <div class="simulation-result">

            <div class="simulation-result-icon">

                <i class="fa-solid fa-file-signature"></i>

            </div>


            <span class="verified-text">

                CONSENT PROCESS INITIATED

            </span>


            <h3>

                Emergency Contact Can Reach the Hospital

            </h3>


            <p>

                The emergency contact has received the hospital
                name and location and can proceed with the
                required written consent process.

            </p>


            <button
                class="simulation-next-btn"
                onclick="resetEmergencySimulation()"
            >

                <i class="fa-solid fa-rotate-right"></i>

                Start New Emergency Case

            </button>

        </div>

    `;

}


function updateSimulationStep(
    currentStep
) {

    for (
        let i = 1;
        i <= 5;
        i++
    ) {

        const step =
            getElement("simStep" + i);


        if (!step) continue;


        step.classList.remove(
            "active",
            "completed"
        );


        if (i < currentStep) {

            step.classList.add(
                "completed"
            );

        } else if (i === currentStep) {

            step.classList.add(
                "active"
            );

        }


        if (i < 5) {

            const line =
                getElement("simLine" + i);


            if (!line) continue;


            if (i < currentStep) {

                line.classList.add(
                    "completed-line"
                );

            } else {

                line.classList.remove(
                    "completed-line"
                );

            }

        }

    }

}


function resetEmergencySimulation() {

    const screen =
        getElement("simulationScreen");

    const title =
        getElement("simulationCaseTitle");

    const status =
        getElement("simulationStatus");


    if (!screen) return;


    currentSimulationType = "";


    if (title) {

        title.innerText =
            "No Active Case";

    }


    if (status) {

        status.className =
            "simulation-status waiting-status";

        status.innerHTML = `
            <span></span>
            Waiting to Start
        `;

    }


    updateSimulationStep(1);


    screen.innerHTML = `

        <div class="simulation-welcome">

            <div class="simulation-main-icon">

                <i class="fa-solid fa-heart-pulse"></i>

            </div>


            <span>

                READY FOR DEMONSTRATION

            </span>


            <h3>

                Start a New Emergency Case

            </h3>


            <p>

                Demonstrate how Lifora reduces delays in
                emergency identification, documentation and
                emergency contact notification.

            </p>


            <button
                class="start-simulation-btn"
                onclick="startEmergencySimulation()"
            >

                <i class="fa-solid fa-play"></i>

                Start Emergency Case

            </button>

        </div>

    `;

}


/* =========================================================
   LOAD SAVED INFORMATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const savedName =
            localStorage.getItem(
                "liforaEmergencyContactName"
            );


        const savedPhone =
            localStorage.getItem(
                "liforaEmergencyContactPhone"
            );


        const savedHospital =
            localStorage.getItem(
                "liforaHospitalName"
            );


        const savedLocation =
            localStorage.getItem(
                "liforaHospitalLocation"
            );


        const displayName =
            getElement("displayContactName");


        const displayPhone =
            getElement("displayContactPhone");


        const hospitalDisplay =
            getElement("hospitalNameDisplay");


        const locationDisplay =
            getElement("hospitalLocationDisplay");


        if (savedName && displayName) {

            displayName.innerText =
                savedName;

        }


        if (savedPhone && displayPhone) {

            displayPhone.innerText =
                savedPhone;

        }


        if (
            savedHospital &&
            hospitalDisplay
        ) {

            hospitalDisplay.innerText =
                savedHospital;

        }


        if (
            savedLocation &&
            locationDisplay
        ) {

            locationDisplay.innerText =
                savedLocation;

        }


        loadPatientInformation();

    }
);
