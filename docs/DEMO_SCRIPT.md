# AyurSutra — Viva & Project Demonstration Script

This script provides an exact step-by-step walkthrough for project demonstrations, viva examinations, and evaluations.

---

## 🎯 Demonstration Journey at a Glance
$$\text{Register Rahul} \rightarrow \text{Consultation Fee & Receipt} \rightarrow \text{Doctor Clinical Assessment} \rightarrow \text{Plan & Custom Package} \rightarrow \text{Conflict-Free Scheduling} \rightarrow \text{Session Execution} \rightarrow \text{Patient Portal}$$

---

### Step 1: Login & Staff Dashboard
1. Open the frontend: [http://localhost:5173](http://localhost:5173).
2. Login as Clinic Administrator:
   - **Email:** `admin@ayursutra.com`
   - **Password:** `Admin@123`
3. Point out:
   - **Live Metrics:** Total scheduled sessions, active patients, catalogue size, and session attendance rate.
   - **Role-Based Navigation:** Only staff see management links (Patients, Consultations, Schedule, Therapies).

---

### Step 2: Patient Registration & Portal Account Provisioning
1. Click **Patients** in the sidebar.
2. Click **"Register Patient"**:
   - **First Name:** Rahul
   - **Last Name:** Verma
   - **Phone:** `9876543210`
   - **Gender:** Male
   - Check **"Create Patient Portal Account"**
   - **Initial Password:** `Patient@123`
3. Click **"Save Patient"**. Point out that the patient is immediately assigned a secure portal account with encrypted bcrypt credentials.

---

### Step 3: Doctor Consultation & Clinical Notes
1. Switch to Doctor view (or sign out and log in as `dr.sharma@ayursutra.com` / `Doctor@123`).
2. Click **Consultations** in the sidebar.
3. Select Rahul's consultation and click **"Create Plan"**:
   - **Chief Complaint:** Lumbar stiffness, chronic stress, insomnia.
   - **Prakriti:** Vata-Pitta.
   - **Vikriti:** Aggravated Vata with Ama accumulation.
   - **Prescribed Therapy:** Abhyanga (Full body oil massage, 60 mins).
   - **Session Count:** 3 Sessions.
   - **Pathya (Diet Guidelines):** Warm, lightly spiced khichdi with ghee; avoid cold salads and carbonated drinks.
   - **Vihara (Lifestyle Guidelines):** Gentle pranayama, warm oil self-massage, early sleep by 10 PM.
4. Click **"Finalize & Set Package Price"**.

---

### Step 4: Key Differentiator — Custom Package Pricing & Payment
1. Point out the modal: **"Set Custom Package Price"**.
   - Explain the design decision: *The therapy catalogue provides a suggested price (₹1200/session = ₹3600), but the doctor/admin can set a custom negotiated price (e.g. ₹4500) per patient.*
   - **Package Name:** AyurSutra 3-Session Detox & Vata Care
   - **Custom Package Price:** ₹4,500
2. Click **"Save Package"**.
3. View the generated receipt slip at [http://localhost:8000/api/v1/billing/receipts/REC-20261015-DEMO01/pdf](http://localhost:8000/api/v1/billing/receipts/REC-20261015-DEMO01/pdf).

---

### Step 5: Multi-Session Scheduling Engine with Conflict Detection
1. Click **"Run Auto-Scheduler"** (or click allocate in Schedule view).
2. Point out what happens behind the scenes in `<50ms`:
   - Checks therapist working hours and leave.
   - Checks therapist qualifications for Abhyanga.
   - Checks room facilities (table, oil).
   - Prevents double-booking therapist, room, or patient.
   - Transactionally commits 3 sessions without conflicts.
3. Open **Schedule** to view the allocated sessions:
   - Session #1: Room Dhanvantari, Therapist Anitha Krishnan.
   - Session #2: Next day, Room Dhanvantari.
   - Session #3: Following day.

---

### Step 6: Session Execution & Clinical Observations
1. In the **Schedule** view:
   - On Session #1, click **"Check In"** (simulating patient arrival).
   - Click **"Complete & Record"**:
     - **Oils Used:** Mahanarayana Taila & Ksheerabala 101.
     - **Pressure Level:** Madhyama (Medium).
     - **Therapist Observations:** Significant reduction in lumbar stiffness observed.
     - **Patient Feedback:** Felt very relaxed and warm.
2. Click **"Complete Session"**. Notice the badge updates to **"Completed"**.

---

### Step 7: Patient Wellness Portal & Regulatory Compliance
1. Sign out and sign in as Rahul:
   - **Email:** `rahul@demo.com`
   - **Password:** `Patient@123`
2. Point out:
   - **Role-Based Redirect:** Automatically lands on **My Wellness Portal**.
   - **Safety & Compliance Metric:** Displays **"Session Attendance: 33.3%"** (with footnote: *"Measures attendance percentage, not clinical recovery"*).
   - **Prescribed Protocol:** Direct visibility of doctor-prescribed *Pathya* (diet) and *Vihara* (lifestyle) instructions.
   - **Therapy Timeline:** Shows completed Session #1 with notes, and upcoming Sessions #2 and #3.
   - **Test Reschedule Request:** Click **"Request Reschedule"** on Session #2 $\rightarrow$ select preferred date and reason ("Office travel") $\rightarrow$ submit.
   - **Test Clinical Feedback:** Click **"Give Feedback"** on Session #1 $\rightarrow$ optional "Flag for Doctor" $\rightarrow$ submit.
   - **Billing & PDF:** View total fee ₹4,500, amount paid ₹2,000, balance due ₹2,500, and click **"View Slip"** to download the official receipt.

---

### Step 8: Empirical Evaluation Benchmark
1. In the terminal:
   ```powershell
   python benchmark_scheduler.py
   ```
2. Present the empirical evaluation results:
   - **Naive Manual Allocation:** 33.3% conflict rate under high contention.
   - **AyurSutra Engine:** **0.0% conflict rate** guaranteed with **100% placement** in **137ms**.
