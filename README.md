# AyurSutra (आयुर्सूत्र)
### Enterprise Panchakarma Hospital Management, Intelligent Scheduling & EHR Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20(Neon)-336791?style=flat&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Pytest-23%2F23%20Passed-success?style=flat&logo=pytest&logoColor=white)](https://pytest.org/)

---

## 🌿 Executive Summary
**AyurSutra** is a modern, end-to-end clinical and administrative operating system tailored specifically for Panchakarma hospitals, Ayurvedic clinics, and holistic wellness centres.

Unlike generic clinic management software, AyurSutra solves the unique operational, clinical, and scheduling complexities of classical Ayurvedic care:
1. **Multi-Resource Scheduling Engine**: Eliminates double-bookings across therapists, treatment suites (*Droni* tables, *Shirodhara* apparatus, steam chambers), and patient time slots under hard clinical constraints.
2. **Unique Patient Identity (UHID)**: Issues sequential clinical numbers (e.g., `AYUR-1001`, `AYUR-1002`) providing a unified longitudinal 360° EHR profile across multiple doctor visits, regimens, sessions, and invoices.
3. **Official Clinical & Billing PDF Generation**: Pure-Python in-memory document generation for:
   - Official **Payment Receipts** with authentic Indian Rupee glyph (`₹`) rendering.
   - Comprehensive **Panchakarma Discharge & Treatment Summaries** with session attendance metrics, daily therapy logs, and *Pathya/Vihara* dietary protocols.
4. **Dynamic Custom Package Pricing**: Empowers doctors to personalize therapy regimens with negotiated package pricing while referencing catalog tariffs.
5. **Clinical Safety & Medico-Legal Safeguards**: Formally measures **Session Attendance Rate** separate from clinical cure rates, shielding practitioners from medico-legal exposure.
6. **Presence & Working Hours Governance**: Allows administration to configure custom working hours per staff member with real-time online/offline presence control and feature lockout enforcement.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client Layer
        A[React 19 + TypeScript SPA]
        B[TanStack Query v5 + TailwindCSS v4]
        C[Lucide Icons + Recharts]
    end

    subgraph API & Gateway Layer
        D[FastAPI REST Engine :8000]
        E[JWT RBAC & Presence Guard]
        F[Audit Logging Middleware]
    end

    subgraph Core Services
        G[Constraint-Satisfaction Scheduler]
        H[ReportLab PDF Generation Engine]
        I[Leave Reallocation Service]
    end

    subgraph Data Tier
        J[(Lakebase PostgreSQL 16 - Neon)]
        K[16 Domain Tables + Full Audit Trails]
    end

    Client Layer -->|HTTP / REST + Bearer Token| D
    D --> E
    E --> F
    F --> G
    F --> H
    F --> I
    D -->|SQLAlchemy 2.0 ORM| J
    J --- K
```

### Domain Architecture
- **Clinical Domain**: `patients`, `consultations`, `treatment_plans`, `treatment_plan_items`
- **Commercial Domain**: `patient_packages`, `payments`, `receipts`
- **Operational Domain**: `therapies`, `staff`, `staff_availability`, `staff_therapy_authorizations`, `rooms`, `therapy_sessions`, `session_records`
- **Administrative & Security Domain**: `users`, `audit_logs`, `notifications`

---

## ⚡ The Scheduling Engine: Zero-Conflict Guarantee

Every session candidate $[t_{start}, t_{end}]$ is evaluated against **6 hard constraints**:
$$\text{ValidSlot}(s) \iff C_1 \land C_2 \land C_3 \land C_4 \land C_5 \land C_6$$
1. **Clinic Operating Hours ($C_1$)**: Strictly between $08:00$ and $20:00$.
2. **Therapist On-Duty & Shifts ($C_2$)**: Therapist must be within designated working hours and not on leave.
3. **Therapist Specialization ($C_3$)**: Therapist must be certified in the specific procedure (*Pradhana Karma*, *Abhyanga*, *Shirodhara*, etc.).
4. **Therapist Non-Overlap ($C_4$)**: Therapist has no simultaneous booking.
5. **Room Suite & Equipment Facilities ($C_5$)**: Room is unoccupied and possesses required apparatus tags.
6. **Patient Non-Overlap ($C_6$)**: Patient cannot undergo two treatments simultaneously.

### Benchmark vs Manual Scheduling (High-Contention Test)
Run via `python backend/benchmark_scheduler.py`:

| Metric | Naive Manual Scheduling | AyurSutra Scheduling Engine | Improvement |
| :--- | :--- | :--- | :--- |
| **Therapist Double-Bookings** | 16.7% (2/12) | **0.0% (0/12)** | **100% Elimination** |
| **Room Double-Bookings** | 8.3% (1/12) | **0.0% (0/12)** | **100% Elimination** |
| **Patient Overlaps** | 8.3% (1/12) | **0.0% (0/12)** | **100% Elimination** |
| **Total Conflicts** | **33.3%** | **0.0%** | **0.0% Zero Conflicts** |
| **Session Placement Rate** | 66.7% | **100.0%** | **+33.3% Placement** |
| **Execution Latency** | N/A | **< 35 ms** | Sub-second real-time |

---

## 🚀 Quick Start Guide

### Option 1: Local Development

#### 1. Backend Setup (FastAPI + Python 3.11+)
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Root: `http://localhost:8000`
- Interactive OpenAPI / Swagger Docs: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/health`

#### 2. Frontend Setup (React 19 + Vite)
```bash
cd frontend
npm install
npm run dev -- --host
```
- Web Application: `http://localhost:5173`

---

### Option 2: Docker Compose (One-Click Setup)
```bash
docker compose up --build
```
- Frontend Web App: `http://localhost:80`
- Backend API & OpenAPI Docs: `http://localhost:8000/docs`
- PostgreSQL Database: `localhost:5432`

---

## 🔑 Demo User Credentials

The database comes pre-seeded with personas across all healthcare roles:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@ayursutra.com` | `Admin@123` | System oversight, Staff working hours, Account lockout, Audit logs, Room management |
| **Receptionist** | `reception@ayursutra.com` | `Recept@123` | Patient registration (UHID), Consultation booking, Cash payments & PDF receipts |
| **Doctor** | `dr.sharma@ayursutra.com` | `Doctor@123` | Clinical assessment (*Prakriti/Vikriti*), Plan design, Discharge summary PDF |
| **Therapist** | `therapist1@ayursutra.com` | `Therapy@123` | Daily session records (medicated oils, pressure, clinical observations) |
| **Patient** | `rahul@demo.com` | `Patient@123` | Patient Wellness Portal, Session attendance ring, Course Summary PDF, Payment slips |

---

## 🧪 Testing & Verification

### Run Pytest Suite (Unit + End-to-End Integration)
```bash
cd backend
python -m pytest -v
```
Output:
```text
tests/integration/test_admin_features.py .....                [ 21%]
tests/integration/test_pdf_and_patient_number.py .            [ 26%]
tests/integration/test_workflow.py .                          [ 30%]
tests/unit/test_scheduler.py ................                 [100%]
======================= 23 passed in 4.37s =======================
```

### Frontend Typecheck & Production Build
```bash
cd frontend
npm run build
```
Output:
```text
✓ built in 486ms (0 errors)
```

---

## 🛡️ Medico-Legal Safeguards & Compliance
1. **Attendance vs Clinical Recovery**: In full adherence to healthcare regulations, patient progress metrics in the UI and reports are titled **"Session Attendance Rate"** accompanied by:
   > *"Completion percentage measures session attendance, not clinical recovery."*
2. **Adverse Reaction Escalation**: If a patient reports discomfort or unexpected symptoms during or after a therapy session, `flagged_for_doctor` is automatically set and flagged on the doctor's clinical board.
3. **Immutable Audit Trails**: Every clinical plan finalization, package billing, check-in, status adjustment, and reschedule request is recorded with actor ID, timestamp, and details under `GET /api/v1/audit-logs`.

---

## 📚 Technical Documentation Index

| Document | Description |
| :--- | :--- |
| [`docs/PROJECT_SYNOPSIS.md`](file:///d:/ayursutra/docs/PROJECT_SYNOPSIS.md) | Academic synopsis, mathematical formulation, and benchmark study |
| [`docs/SYSTEM_ARCHITECTURE.md`](file:///d:/ayursutra/docs/SYSTEM_ARCHITECTURE.md) | Layered technical architecture, security design, and domain boundaries |
| [`docs/ER_DIAGRAM.md`](file:///d:/ayursutra/docs/ER_DIAGRAM.md) | Full 16-table Mermaid entity-relationship diagram |
| [`docs/WORKFLOW_DIAGRAMS.md`](file:///d:/ayursutra/docs/WORKFLOW_DIAGRAMS.md) | Sequence diagrams for patient journey, constraint validation, and leave reallocation |
| [`docs/DEMO_SCRIPT.md`](file:///d:/ayursutra/docs/DEMO_SCRIPT.md) | Step-by-step evaluator presentation script |

---

## 📜 License
AyurSutra is licensed under the MIT License. Developed for clinical Panchakarma administration, zero-conflict scheduling, and patient wellness tracking.
