# AyurSutra — System Architecture & Specification Document

## 1. System Overview
**AyurSutra** is an enterprise Panchakarma clinic management and patient progress tracking platform. It manages the complete patient journey from clinical intake to therapy completion:
$$\text{Registration} \longrightarrow \text{Doctor Consultation} \longrightarrow \text{Treatment Plan} \longrightarrow \text{Custom Package} \longrightarrow \text{Conflict-Free Scheduling} \longrightarrow \text{Session Records} \longrightarrow \text{Patient Portal}$$

### Core Differentiator: Multi-Session Scheduling Engine with Multi-Resource Conflict Detection
Unlike conventional hospital management systems that handle single doctor appointments, Panchakarma therapies require **multi-session protocols** (e.g. 7, 14, or 21 days) with concurrent multi-resource allocation:
- **Therapist qualification** matching (not all therapists perform all therapies).
- **Specialized room facilities** matching (e.g. Droni massage table, Shirodhara stands, Basti equipment).
- **Patient non-overlap** (a patient cannot undergo two sessions simultaneously).
- **Operating hours and leave schedules** adherence.

---

## 2. Technology Stack & Architectural Layers

| Layer | Technology | Responsibilities |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Lucide Icons, TanStack Query | Client application with dual role-based areas (Staff Operations & Patient Wellness Portal). |
| **Backend** | FastAPI, Python 3.13, Pydantic v2, Pytest | RESTful API, JWT authentication, RBAC authorization, business logic, scheduling algorithm. |
| **Database** | PostgreSQL / SQLite (Local Dev fallback), SQLAlchemy 2.0 ORM | Relational data persistence, integrity constraints, ACID transactions. |
| **PDF Engine** | WeasyPrint / Clean HTML Receipt Fallback | Generates official patient payment slips and receipts. |

---

## 3. Role-Based Access Control (RBAC) Matrix

| Resource / Endpoint | Admin | Receptionist | Doctor | Therapist | Patient |
|---|:---:|:---:|:---:|:---:|:---:|
| User & Staff Management | Full | None | None | None | None |
| Patient Registration | Full | Full | View Only | None | None |
| Clinical Consultation Notes | Full | View Only | Full | None | Own Records |
| Treatment Plan Creation & Finalization | Full | None | Full | None | Own Plan |
| Custom Package Pricing & Billing | Full | Full | View Only | None | Own Invoices |
| Run Automated Scheduling Engine | Full | Full | Full | None | None |
| Check-in Session | Full | Full | None | None | None |
| Complete Session & Clinical Record | Full | None | Full | Full | None |
| Patient Portal Timeline | Full (Preview) | Full (Preview) | Full (Preview) | None | Own Journey |
| Submit Reschedule Request | None | None | None | None | Own Sessions |
| Submit Post-Session Feedback | None | None | None | None | Own Sessions |

---

## 4. Domain Model Architecture
The data model is strictly decoupled into 4 distinct domains to maintain separation of concerns:

### 1. Clinical Domain
- `patients`: Patient demographics, allergies, medical history.
- `consultations`: Initial/follow-up visits, chief complaints, Prakriti (Vata/Pitta/Kapha), Vikriti, consultation fee.
- `treatment_plans`: Prescribed titles, clinical objectives, *Pathya* (dietary guidelines), *Vihara* (lifestyle advice).
- `treatment_plan_items`: Individual prescribed therapies, session counts, and duration.

### 2. Commercial Domain
- `patient_packages`: Custom package price negotiated per patient (differentiator), payment status, active dates.
- `payments`: Financial transactions (Cash, Card, UPI, NetBanking).
- `receipts`: Generated receipts with unique sequential numbering.

### 3. Operational Domain
- `therapies`: Catalogue of Panchakarma therapies, suggested prices, facility tags.
- `rooms`: Clinic therapy suites with equipment capabilities.
- `staff`: Doctor and therapist profiles, qualifications.
- `staff_availability`: Weekly working hours (08:00–18:00) and approved leave dates.
- `therapist_therapies`: Many-to-many qualification matrix.
- `therapy_sessions`: Scheduled and executed therapy slots.
- `session_records`: Post-therapy observations, oils used, pressure level, doctor flags.

### 4. System Domain
- `users`: Authentication identities, password hashes, roles.
- `audit_logs`: Immutable trail of clinical changes and scheduling actions.
- `notifications`: Alerts for reschedule requests and doctor flags.

---

## 5. Safety & Regulatory Compliance
1. **Attendance vs. Recovery Metric**: Completion percentage in the UI is strictly labeled as **"Session Attendance"** (with compliance disclosure *"Measures session attendance, not clinical recovery"*).
2. **Clinical Decision Support**: The platform organizes and records clinician decisions; it never algorithmically prescribes or diagnoses.
3. **Data Isolation**: Patients authenticate via JWT and are strictly constrained to their own clinical records (`WHERE user_id == current_user.id`).
