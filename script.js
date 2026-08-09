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
   CRITICAL PATIENT FLOW
========================================================= */

function startCriticalFlow() {

    scrollToSection("criticalSection");

    setTimeout(function () {

        const status = getElement("criticalStatus");

        if (status) {
            status.innerHTML = `
                <i class="fa-solid fa-circle-exclamation"></i>
                Critical case selected. Begin secure identification.
            `;
        }

    }, 500);

}


function startBiometricScan() {

    const status = getElement("criticalStatus");
    const biometricResult = getElement("biometricResult");

    if (status) {
        status.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Scanning biometric identity...
        `;
    }

    setTimeout(function () {

        if (status) {
            status.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                Biometric identity verified successfully.
            `;
        }

        if (biometricResult) {
            biometricResult.classList.add("active-result");
            biometricResult.innerHTML = `
                <i class="fa-solid fa-check-circle"></i>
                Biometric Match Found
            `;
        }

    }, 1800);

}


function startIrisScan() {

    const status = getElement("criticalStatus");
    const irisResult = getElement("irisResult");

    if (status) {
        status.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Scanning iris pattern...
        `;
    }

    setTimeout(function () {

        if (status) {
            status.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                Iris recognition completed successfully.
            `;
        }

        if (irisResult) {
            irisResult.classList.add("active-result");
            irisResult.innerHTML = `
                <i class="fa-solid fa-eye"></i>
                Iris Identity Verified
            `;
        }

    }, 2000);

}


function retrieveCriticalRecord() {

    const status = getElement("criticalStatus");

    if (status) {
        status.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Retrieving emergency medical profile...
        `;
    }

    setTimeout(function () {

        const patientName = getElement("patientName");
        const patientBlood = getElement("patientBlood");
        const patientAllergy = getElement("patientAllergy");

        if (patientName) {
            patientName.innerText = "Emergency Patient Identified";
        }

        if (patientBlood) {
            patientBlood.innerText = "O Positive";
        }

        if (patientAllergy) {
            patientAllergy.innerText = "No Critical Allergy Found";
        }

        if (status) {
            status.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                Emergency medical profile retrieved successfully.
            `;
        }

        scrollToSection("emergencyProfile");

    }, 1500);

}


/* =========================================================
   NON-CRITICAL PATIENT FLOW
========================================================= */

function startNonCriticalFlow() {

    scrollToSection("nonCriticalSection");

}


function startQRScan() {

    const qrStatus = getElement("qrStatus");
    const qrResult = getElement("qrResult");

    if (qrStatus) {
        qrStatus.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Scanning secure QR code...
        `;
    }

    setTimeout(function () {

        if (qrStatus) {
            qrStatus.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                QR code verified successfully.
            `;
        }

        if (qrResult) {
            qrResult.classList.add("active-result");
            qrResult.innerHTML = `
                <i class="fa-solid fa-qrcode"></i>
                Secure Patient Record Found
            `;
        }

    }, 1600);

}


function retrieveQRRecord() {

    const qrStatus = getElement("qrStatus");

    if (qrStatus) {
        qrStatus.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Opening authorized patient record...
        `;
    }

    setTimeout(function () {

        if (qrStatus) {
            qrStatus.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                Patient record accessed successfully.
            `;
        }

        scrollToSection("emergencyProfile");

    }, 1200);

}


/* =========================================================
   EMERGENCY CONTACT
========================================================= */

function notifyEmergencyContact() {

    const notification = getElement("notificationStatus");

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

    }, 1800);

}


function openContactModal() {

    const modal = getElement("contactModal");

    if (modal) {
        modal.classList.add("show-modal");
    }

}


function closeContactModal() {

    const modal = getElement("contactModal");

    if (modal) {
        modal.classList.remove("show-modal");
    }

}


function saveEmergencyContact() {

    const contactName = getElement("contactName");
    const contactPhone = getElement("contactPhone");

    const savedName =
        contactName && contactName.value.trim() !== ""
            ? contactName.value.trim()
            : "Emergency Contact";

    const savedPhone =
        contactPhone && contactPhone.value.trim() !== ""
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


    const displayName = getElement("displayContactName");
    const displayPhone = getElement("displayContactPhone");

    if (displayName) {
        displayName.innerText = savedName;
    }

    if (displayPhone) {
        displayPhone.innerText = savedPhone;
    }

    closeContactModal();

}


/* =========================================================
   HOSPITAL INFORMATION
========================================================= */

function saveHospitalInformation() {

    const hospitalName = getElement("hospitalNameInput");
    const hospitalLocation = getElement("hospitalLocationInput");

    const savedHospital =
        hospitalName && hospitalName.value.trim() !== ""
            ? hospitalName.value.trim()
            : "Selected Hospital";


    const savedLocation =
        hospitalLocation && hospitalLocation.value.trim() !== ""
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
        hospitalDisplay.innerText = savedHospital;
    }


    if (locationDisplay) {
        locationDisplay.innerText = savedLocation;
    }

}


/* =========================================================
   EMERGENCY CONSENT
========================================================= */

function startConsentProcess() {

    const consentStatus = getElement("consentStatus");

    if (consentStatus) {

        consentStatus.innerHTML = `
            <i class="fa-solid fa-file-signature"></i>
            Consent process initiated.
            The emergency contact has been informed about
            the hospital and can proceed for written consent.
        `;

    }

    scrollToSection("consentSection");

}


/* =========================================================
   SIMULATION
========================================================= */

let currentSimulationType = "";


function startEmergencySimulation() {

    const screen = getElement("simulationScreen");
    const title = getElement("simulationCaseTitle");
    const status = getElement("simulationStatus");

    if (!screen) return;


    if (title) {
        title.innerText = "Patient Type Selection";
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

    const screen = getElement("simulationScreen");
    const title = getElement("simulationCaseTitle");

    if (!screen) return;


    if (title) {
        title.innerText = patientType;
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

        showIdentificationSuccess(patientType);

    }, 2200);

}


function showIdentificationSuccess(patientType) {

    const screen = getElement("simulationScreen");

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

    const screen = getElement("simulationScreen");

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

    const screen = getElement("simulationScreen");

    if (!screen) return;


    updateSimulationStep(4);


    const hospitalName =
        localStorage.getItem("liforaHospitalName")
        || "Selected Hospital";


    const hospitalLocation =
        localStorage.getItem("liforaHospitalLocation")
        || "Hospital Location";


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

    const screen = getElement("simulationScreen");
    const status = getElement("simulationStatus");

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


function updateSimulationStep(currentStep) {

    for (let i = 1; i <= 5; i++) {

        const step = getElement("simStep" + i);

        if (!step) continue;


        step.classList.remove(
            "active",
            "completed"
        );


        if (i < currentStep) {

            step.classList.add("completed");

        } else if (i === currentStep) {

            step.classList.add("active");

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

    const screen = getElement("simulationScreen");
    const title = getElement("simulationCaseTitle");
    const status = getElement("simulationStatus");

    if (!screen) return;


    currentSimulationType = "";


    if (title) {
        title.innerText = "No Active Case";
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
            displayName.innerText = savedName;
        }


        if (savedPhone && displayPhone) {
            displayPhone.innerText = savedPhone;
        }


        if (savedHospital && hospitalDisplay) {
            hospitalDisplay.innerText = savedHospital;
        }


        if (savedLocation && locationDisplay) {
            locationDisplay.innerText = savedLocation;
        }

    }
);
