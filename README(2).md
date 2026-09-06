# Lifora — Community Healthcare Continuity & Care Coordination Platform
### Smart India Hackathon 2026 | Problem ID: SIH26133

> **Right Care. Right Place. Right Time.**  
> A Community-Assisted Digital Healthcare Continuity and Care Coordination Platform designed to close the referral loop, coordinate primary to secondary care, and support frontline health workers (ASHAs) with responsible clinical decision support.

---

## 🌟 Key Highlights

- **Closed-Loop Healthcare Continuity**: Referrals do not end with sending patient data; the system tracks the patient across `SENT → ACCEPTED → EN ROUTE → RECEIVED → TREATMENT → COMPLETED` and automatically creates follow-up visits for community health workers upon discharge.
- **Responsible AI Clinical Decision Support**: Priority urgency indicators (Routine, Priority, Urgent) with multi-factor vitals evaluation (blood pressure, blood glucose, heart rate, SpO₂, age risk, and symptom keywords). Always provides transparent reasoning and clear non-diagnostic disclaimers.
- **Centralized Shared State & Persistence**: Pure frontend architecture using in-memory state with immediate `localStorage` synchronization and cross-tab reactive updates.
- **Low-Connectivity / Offline-Ready Demo**: Supports local registration queueing with on-device caching and one-click synchronization once connectivity is restored.
- **Zero-Setup Deployment**: Built with vanilla HTML5, CSS3, and modern ES6 JavaScript. No bundlers, npm packages, or server runtimes required — run directly in any browser or deploy on GitHub Pages in seconds.

---

## 📂 Project Structure

```
├── index.html     # Single-page application markup with 7 integrated portals
├── styles.css     # Complete design system, responsive styles & theme tokens
├── script.js      # Central routing engine, mock database, AI decision support & event delegation
└── README.md      # Project overview and hackathon documentation
```

---

## 🚀 Portals & Roles

1. **Health Worker (ASHA)**: Community dashboard, 4-step registration wizard, patient records, AI-assisted priority assessment, facility referral dispatch, follow-up management, offline mode.
2. **Healthcare Staff (Hospital)**: Live patient queue, incoming referral acceptance & progression pipeline, emergency registration, patient identification, ward & bed management.
3. **Patient Portal**: Digital Health ID, QR access sharing, medical vault, prescriptions, lab reports, consent settings, access audit trail.
4. **Ambulance Portal**: Pre-arrival emergency alert transmission, en-route vitals broadcasting, ETA tracking, and hospital handover confirmation.
5. **Resource Coordination**: Real-time blood group inventory tracking, essential medicines availability index, blood bank emergency requisition.
6. **Hospital Admin**: Emergency department KPIs, workload charts, discharge distribution donut, staff duty rosters, and audit logs.
7. **Public Information**: Health portal education, workflow walkthrough, emergency help guidance, and community contact.

---

## 💻 How to Run Locally

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
3. Click **"⚡ Quick Demo Sign In (1-Click Access)"** or use:
   - **Phone**: `9265470008` (Demo OTP: `140706`)
   - **Email**: `bs12054@gmail.com` (Demo OTP: `041005`)

---

## 🌐 Deploy to GitHub Pages (1 Minute)

1. Push these files to your GitHub repository `main` branch.
2. Go to repository **Settings** → **Pages**.
3. Under **Build and deployment** → **Branch**, select `main` and `/ (root)`.
4. Click **Save**. Your live demo will be published at `https://<username>.github.io/<repo-name>/`.

---

## 🏆 SIH 2026 Team Deliverable
- **Platform**: Lifora (SIH26133)
- **Built for**: Smart India Hackathon 2026

---

## 📱 Mobile UI Update

The final prototype includes a dedicated mobile stability layer for phone-sized screens:

- Compact sticky application header
- Horizontally scrollable role switcher
- Collapsible mobile navigation drawer
- Single-column responsive content layouts
- Touch-friendly buttons and form controls
- Scroll-safe data tables
- Bottom-sheet style mobile modals
- Responsive cards, dashboards, referral pipelines and workflows
- Overflow protection to prevent overlapping or broken UI
- Mobile navigation automatically closes after a selection

The desktop experience and existing application functionality are preserved.
