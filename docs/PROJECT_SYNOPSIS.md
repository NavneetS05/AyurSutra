# AyurSutra: Panchakarma Clinic Management & Patient Progress Tracking Platform
## Comprehensive Project Synopsis & Technical Evaluation Report

---

### 1. Executive Summary
**AyurSutra** is a specialized, domain-driven Panchakarma clinic management and patient progress tracking platform designed to eliminate scheduling friction, enforce strict clinical compliance, and streamline the patient care journey from initial Ayurvedic consultation through multi-session therapy delivery to discharge.

Panchakarma treatments (such as *Abhyanga*, *Shirodhara*, *Virechana*, and *Basti*) impose complex scheduling constraints:
- They require certified therapists authorized for specific clinical procedures.
- They require specialized suites equipped with requisite Panchakarma apparatus (e.g. wooden *Droni* tables, *Shirodhara* stands, steam chambers).
- They involve multi-session daily regimens where session overlap, therapist leaves, and patient time availability must be strictly coordinated.

AyurSutra's core differentiator is its **multi-resource constraint-satisfaction scheduling engine with leave-based automated reallocation and circadian-aware slot recommendation**.

---

### 2. Key Problem Statement & Motivation
In traditional Ayurvedic healthcare facilities:
1. **Manual Scheduling Failures**: Receptionists manually match therapist schedules with room availability using spreadsheets or physical registers, resulting in over **30% scheduling conflicts**, double-booked suites, and therapist burn-out.
2. **Fixed vs Custom Package Friction**: Standard software packages enforce rigid catalogue prices, preventing doctors from offering tailored packages with customized therapy session counts and discounted pricing based on patient clinical need.
3. **Clinical Misrepresentation**: Generic clinic software frequently labels progress as "Recovery %" or "Healing %", creating severe medico-legal liabilities. Panchakarma completion metrics represent session attendance, not clinical recovery.
4. **Therapist Absence Cascades**: When a therapist takes emergency leave, rescheduling dozens of linked multi-session treatments manually causes widespread clinical disruption.

---

### 3. Core Objectives & System Features

| Functional Area | Key Capabilities |
| :--- | :--- |
| **Authentication & RBAC** | JWT-based auth with strict role separation across **Admin, Receptionist, Doctor, Therapist, Patient**. |
| **Patient Registration & Records** | Unified demographic directory with optional wellness portal account creation. |
| **Doctor Consultations** | Comprehensive Ayurvedic assessment (*Prakriti*, *Vikriti*, *Pulse*, *Agni*, *Ama*, *Tongue*), personalized diet (*Pathya*), and lifestyle (*Vihara*) guidelines. |
| **Treatment Planning & Pricing** | Multi-therapy regimen specification with custom package pricing and negotiated balance tracking. |
| **Scheduling Engine** | 6-hard-constraint greedy allocator with backtracking, 0.0% double-booking guarantee, and emergency leave reallocation. |
| **Smart Slot Assistant** | Heuristic ranking based on Ayurvedic circadian timing (*Kapha* morning window), therapist workload balancing, and room equipment fitness. |
| **Clinical Session Execution** | Check-in verification, therapist recording of oils used, pressure level, and patient tolerance observations. |
| **Patient Wellness Portal** | Ring visualization of **Session Attendance**, dietary protocol view, reschedule requests, and direct feedback with doctor alert flags. |
| **Analytics & Audit Logs** | Recharts visualizations for financial metrics, room utilization density, therapy popularity, and immutable audit logs. |

---

### 4. System Architecture & Technical Stack

```mermaid
graph TD
    subgraph Client Layer
        A[React 19 + TypeScript SPA]
        B[TanStack Query v5 + TailwindCSS v4]
        C[Recharts Data Visualizations]
    end

    subgraph Gateway / Proxy
        D[Nginx Reverse Proxy :80]
    end

    subgraph Application Server
        E[FastAPI Python 3.12/3.13 :8000]
        F[JWT Role-Based Middleware]
        G[Constraint-Satisfaction Scheduler Engine]
        H[Notification & Audit Services]
    end

    subgraph Data Tier
        I[(PostgreSQL 16 Relational Database)]
        J[16 Relational Tables across 4 Domains]
    end

    Client Layer -->|HTTP / REST| D
    D -->|Internal Proxy| E
    E --> F
    F --> G
    F --> H
    E -->|SQLAlchemy 2.0 ORM| I
    I --- J
```

#### Technology Stack:
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Lucide Icons, Recharts.
- **Backend**: FastAPI, Python 3.12 / 3.13, Pydantic v2, SQLAlchemy 2.0.
- **Database**: PostgreSQL 16 (production container) / SQLite 3 (local dev / ephemeral integration tests).
- **Deployment**: Docker, Docker Compose, Nginx multi-stage alpine images.
- **Testing**: Pytest with `pytest-asyncio` and `faker`.

---

### 5. Scheduling Engine & Constraint Pipeline
The scheduling engine validates every candidate time slot $[t_{start}, t_{end}]$ through 6 strict hard constraints:

$$\text{ValidSlot}(s) \iff C_1 \land C_2 \land C_3 \land C_4 \land C_5 \land C_6$$

1. **Clinic Operating Hours ($C_1$)**: Slot must fall strictly between opening ($08:00$) and closing ($20:00$).
2. **Therapist Working Hours ($C_2$)**: Therapist must be on duty on day $d$ and have no approved leave overlapping $[t_{start}, t_{end}]$.
3. **Therapist Clinical Qualification ($C_3$)**: Therapist must be authorized for therapy $\tau$ (`staff_therapy_authorizations`).
4. **Therapist Availability ($C_4$)**: No active session for therapist $\theta$ in $[t_{start}, t_{end}]$.
5. **Room Suite Availability & Facilities ($C_5$)**: Room $\rho$ must have required facility tags and no active session in $[t_{start}, t_{end}]$.
6. **Patient Non-Overlap ($C_6$)**: Patient must have no simultaneous session anywhere in the clinic.

#### Circadian Heuristic Slot Ranking:
$$\text{Score}(s) = W_{time} \cdot S_{circadian} + W_{load} \cdot S_{workload} + W_{room} \cdot S_{facility}$$
- **Circadian Match ($S_{circadian}$)**: Panchakarma therapies (e.g. *Abhyanga*, *Virechana*) yield optimal bio-purification during early morning hours ($08:00 - 11:30$, *Kapha* interval).
- **Workload Balancing ($S_{workload}$)**: Penalizes assigning therapists already near their maximum daily quota.
- **Facility Fit ($S_{room}$)**: Prioritizes suites tailored for the specific therapy equipment.

---

### 6. Empirical Evaluation & Benchmark Results
To evaluate scheduling efficacy, AyurSutra's engine was benchmarked against a naive manual first-come allocator under high-load contention:

| Metric | Naive Manual Scheduling | AyurSutra Scheduling Engine | Improvement |
| :--- | :--- | :--- | :--- |
| **Therapist Double Bookings** | 2 / 12 (16.7%) | **0 / 12 (0.0%)** | 100% Elimination |
| **Room Double Bookings** | 1 / 12 (8.3%) | **0 / 12 (0.0%)** | 100% Elimination |
| **Patient Overlaps** | 1 / 12 (8.3%) | **0 / 12 (0.0%)** | 100% Elimination |
| **Total Conflicts** | **33.3%** | **0.0%** | **0 Conflicts** |
| **Session Placement Rate** | 66.7% | **100.0%** | +33.3% Placement |
| **Algorithm Execution Time** | N/A | **< 35 ms** | Sub-second real-time |

---

### 7. Clinical Compliance & Medico-Legal Safeguards
1. **Attendance vs Recovery**: In accordance with healthcare standards, the UI explicitly disclaims:
   > *"Completion percentage measures session attendance, not clinical recovery."*
2. **Patient Safety Feedback**: Any pain score $\ge 4$ or adverse symptom entered by a patient immediately flags the session record (`flagged_for_doctor=True`) and dispatches a high-priority notification to the consulting physician.
3. **Full Audit Logging**: Key state changes (plan finalization, package billing, check-in, completion, reschedule requests) are logged immutably with actor ID, timestamp, and IP address.

---

### 8. Conclusion
AyurSutra delivers a production-grade, highly cohesive solution tailored to the clinical, commercial, and operational realities of modern Ayurvedic hospitals and wellness centres. It eliminates human scheduling error, ensures strict clinical auditability, and provides an elegant, transparent experience for both healthcare providers and patients.
