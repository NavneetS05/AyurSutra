# AyurSutra (आयुर्सूत्र)
### Panchakarma Clinic Management & Patient Progress Tracking Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Pytest-17%2F17%20Passed-success?style=flat&logo=pytest&logoColor=white)](https://pytest.org/)

---

## 🌿 Executive Summary
**AyurSutra** is an end-to-end clinical and administrative operating system tailored specifically for Panchakarma hospitals and Ayurvedic wellness centres. 

Unlike generic clinic management software, AyurSutra solves the unique operational challenges of classical Ayurvedic care:
1. **Multi-Resource Scheduling**: Solves the combinatorial bottleneck of coordinating specialized therapists, suite equipment (e.g. *Droni* tables, *Shirodhara* apparatus, steam chambers), and patient time slots.
2. **Dynamic Custom Package Pricing**: Empowers doctors to personalize therapy regimens with customized pricing while referencing default catalogue rates.
3. **Clinical Safety & Medico-Legal Compliance**: Distinguishes **Session Attendance** from clinical recovery, shielding healthcare providers from medico-legal exposure.
4. **Automated Leave Reallocation & Smart Slot Recommendation**: Reallocates affected sessions upon staff leave and uses Ayurvedic circadian heuristics (*Kapha* early-morning window) to recommend optimal time slots.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client Layer
        A[React 19 + TypeScript SPA]
        B[TanStack Query v5 + TailwindCSS v4]
        C[Recharts Visualizations]
    end

    subgraph Reverse Proxy
        D[Nginx Container :80]
    end

    subgraph Backend Core
        E[FastAPI API Engine :8000]
        F[JWT RBAC Middleware]
        G[Constraint-Satisfaction Scheduler]
        H[Notification & Audit Services]
    end

    subgraph Data Tier
        I[(PostgreSQL 16 Relational Database)]
        J[16 Relational Tables Across 4 Domains]
    end

    Client Layer -->|HTTP / REST| D
    D -->|Reverse Proxy /api/| E
    E --> F
    F --> G
    F --> H
    E -->|SQLAlchemy 2.0 ORM| I
    I --- J
```

### Clean Domain Separation (16 Relational Tables)
- **Clinical Domain**: `patients`, `consultations`, `treatment_plans`, `treatment_plan_items`
- **Commercial Domain**: `patient_packages`, `payments`, `receipts`
- **Operational Domain**: `therapies`, `staff`, `staff_availability`, `staff_therapy_authorizations`, `rooms`, `therapy_sessions`, `session_records`
- **System Domain**: `users`, `audit_logs`, `notifications`

---

## ⚡ The Scheduling Engine: Zero-Conflict Guarantee

Every session candidate $[t_{start}, t_{end}]$ is evaluated against **6 hard constraints**:
$$\text{ValidSlot}(s) \iff C_1 \land C_2 \land C_3 \land C_4 \land C_5 \land C_6$$
1. **Clinic Operating Hours ($C_1$)**: Strictly between $08:00$ and $20:00$.
2. **Therapist On-Duty & Approved Leaves ($C_2$)**: Therapist must be on shift and not on approved leave.
3. **Therapist Qualification ($C_3$)**: Therapist must be certified in the specific procedure.
4. **Therapist Non-Overlap ($C_4$)**: Therapist has no simultaneous booking.
5. **Room Suite & Equipment Facilities ($C_5$)**: Room is unoccupied and possesses required apparatus tags.
6. **Patient Non-Overlap ($C_6$)**: Patient cannot undergo two treatments simultaneously.

### Empirical Benchmark vs Manual Allocation (High-Contention Test)
Run via `python backend/benchmark_scheduler.py`:

| Metric | Naive Manual Scheduling | AyurSutra Scheduling Engine | Improvement |
| :--- | :--- | :--- | :--- |
| **Therapist Double-Bookings** | 16.7% (2/12) | **0.0% (0/12)** | **100% Elimination** |
| **Room Double-Bookings** | 8.3% (1/12) | **0.0% (0/12)** | **100% Elimination** |
| **Patient Overlaps** | 8.3% (1/12) | **0.0% (0/12)** | **100% Elimination** |
| **Total Conflicts** | **33.3%** | **0.0%** | **0.0% Zero Conflicts** |
| **Session Placement Rate** | 66.7% | **100.0%** | **+33.3% Placement** |
| **Execution Time** | N/A | **< 35 ms** | Sub-second real-time |

---

## 🚀 Quick Start Guide

### Option 1: Docker Compose (One-Click Production Setup)
```bash
docker compose up --build
```
- Frontend Web App: `http://localhost:80`
- Backend API & OpenAPI Docs: `http://localhost:8000/docs`
- PostgreSQL Database: `localhost:5432`

---

### Option 2: Local Development Setup

#### 1. Backend Setup (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
python seed.py            # Initializes database and seeds complete clinical demo dataset
uvicorn app.main:app --reload --port 8000
```
*Healthcheck:* `http://localhost:8000/health`  
*Swagger Docs:* `http://localhost:8000/docs`

#### 2. Frontend Setup (React 19 + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Web App:* `http://localhost:5173`

---

## 🔑 Demo User Credentials

The seeded dataset includes ready-to-test personas across all roles:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@ayursutra.com` | `Admin@123` | System oversight, Analytics, Audit Log feed, Catalog & Staff CRUD |
| **Receptionist** | `reception@ayursutra.com` | `Recept@123` | Patient check-in, Billing, Invoices, Scheduling Assistant |
| **Doctor** | `dr.sharma@ayursutra.com` | `Doctor@123` | Clinical assessment (*Prakriti/Vikriti*), Plan creation, Discharge summary |
| **Therapist** | `therapist1@ayursutra.com` | `Therapy@123` | Daily therapy execution, Clinical session records (oils, pressure, notes) |
| **Patient** | `rahul@demo.com` | `Patient@123` | Patient Wellness Portal, Session Attendance ring, Reschedule request, Discharge PDF |

---

## 🧪 Testing & Verification

### Run Pytest Suite (Unit + End-to-End Integration)
```bash
cd backend
python -m pytest tests/ -v
```
Output:
```text
tests/integration/test_workflow.py::test_full_patient_and_scheduling_lifecycle PASSED
tests/unit/test_scheduler.py::test_happy_path_single_session PASSED
tests/unit/test_scheduler.py::test_therapist_not_qualified_rejected PASSED
tests/unit/test_scheduler.py::test_therapist_double_booking_rejected PASSED
tests/unit/test_scheduler.py::test_room_double_booking_rejected PASSED
tests/unit/test_scheduler.py::test_patient_double_booking_rejected PASSED
tests/unit/test_scheduler.py::test_therapist_leave_rescheduling PASSED
tests/unit/test_scheduler.py::test_ranked_slot_recommendation PASSED
...
======================= 17 passed in 1.88s =======================
```

### Frontend Typecheck & Production Build
```bash
cd frontend
npm run build
```
Output:
```text
✓ built in 557ms (0 errors)
```

---

## 🛡️ Clinical Safety & Medico-Legal Safeguards
1. **Attendance vs Recovery**: In full adherence to medical guidelines, progress percentages in the UI are strictly titled **"Session Attendance Rate"** accompanied by:
   > *"Completion percentage measures session attendance, not clinical recovery."*
2. **Doctor Adverse Reaction Escalation**: If a patient reports discomfort or submits feedback with adverse reactions, `flagged_for_doctor` is automatically set to `True` and an urgent notification is dispatched to the consulting physician.
3. **Immutable Audit Trails**: Every clinical plan finalization, package billing, check-in, completion, and reschedule request is logged with actor ID, timestamp, and IP address under `GET /api/v1/audit-logs`.

---

## 📚 Technical Documentation Index

| Document | Description |
| :--- | :--- |
| [`docs/PROJECT_SYNOPSIS.md`](file:///d:/ayursutra/docs/PROJECT_SYNOPSIS.md) | Complete academic & viva synopsis, mathematical formulation, and benchmark study |
| [`docs/SYSTEM_ARCHITECTURE.md`](file:///d:/ayursutra/docs/SYSTEM_ARCHITECTURE.md) | Technical architecture, layered domain patterns, and security design |
| [`docs/ER_DIAGRAM.md`](file:///d:/ayursutra/docs/ER_DIAGRAM.md) | Full 16-table Mermaid entity-relationship diagram |
| [`docs/WORKFLOW_DIAGRAMS.md`](file:///d:/ayursutra/docs/WORKFLOW_DIAGRAMS.md) | Sequence diagrams for patient journey, constraint validation, and leave reallocation |
| [`docs/DEMO_SCRIPT.md`](file:///d:/ayursutra/docs/DEMO_SCRIPT.md) | Step-by-step viva & evaluator presentation script |

---

## 📜 License
AyurSutra is licensed under the MIT License. Developed for clinical Panchakarma administration and patient progress tracking.
