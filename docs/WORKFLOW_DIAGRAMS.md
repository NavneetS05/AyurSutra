# AyurSutra — Workflow Diagrams

## 1. End-to-End Clinical & Commercial Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    actor Receptionist
    actor Doctor
    actor Therapist
    participant Engine as Scheduling Engine
    participant DB as Database

    Patient->>Receptionist: Physical Intake / Registration
    Receptionist->>DB: POST /patients (Create Patient Profile & Portal User)
    Receptionist->>DB: POST /consultations (Book Consultation with Doctor)
    Receptionist->>DB: POST /billing/payments (Collect Consultation Fee & Issue PDF Slip)

    Doctor->>Patient: Clinical Consultation (Prakriti & Vikriti Assessment)
    Doctor->>DB: PATCH /consultations/{id}/notes (Record Dosha & Symptoms)
    Doctor->>DB: POST /consultations/{id}/treatment-plan (Prescribe Therapy & Sessions)
    Doctor->>DB: POST /treatment-plans/{id}/finalize (Lock Protocol)

    Receptionist->>DB: POST /billing/packages (Set Custom Package Price)
    Receptionist->>Engine: POST /scheduling/allocate (Run Conflict-Free Engine)
    
    activate Engine
    Engine->>DB: Query Therapist Skills, Room Facilities, Working Hours, Bookings
    Engine->>Engine: Filter 6 Hard Constraints & Greedy Backtracking
    Engine->>DB: Insert N Therapy Sessions (Zero Conflicts)
    deactivate Engine

    Receptionist->>DB: POST /scheduling/sessions/{id}/checkin (Patient Arrival)
    Therapist->>Patient: Conduct Panchakarma Therapy
    Therapist->>DB: POST /scheduling/sessions/{id}/complete (Record Observations & Oils)

    Patient->>DB: GET /patients/me/portal (View Timeline, Attendance %, Diet Guidelines)
    Patient->>DB: POST /sessions/{id}/reschedule-request (Request Slot Change)
    Patient->>DB: POST /sessions/{id}/feedback (Submit Feedback / Flag Doctor)
```

---

## 2. Multi-Session Scheduling Engine Constraint Pipeline

```mermaid
flowchart TD
    Start(["Input: Plan Items (Therapy × Sessions × Duration), Preferred Start Date"]) --> Grid["Generate 30-min candidate time slots across Clinic Operating Hours (08:00 - 18:00)"]
    
    Grid --> C1{"Constraint 1: Therapist Working & Not on Leave?"}
    C1 -- No --> NextSlot["Advance to Next Time Slot"]
    C1 -- Yes --> C2{"Constraint 2: Therapist Authorized for Therapy?"}
    
    C2 -- No --> NextTherapist["Try Alternate Therapist"]
    C2 -- Yes --> C3{"Constraint 3: Therapist Free (No Overlapping Session)?"}
    
    C3 -- No --> NextTherapist
    C3 -- Yes --> C4{"Constraint 4: Room Free (No Overlapping Session)?"}
    
    C4 -- No --> NextRoom["Try Alternate Room"]
    C4 -- Yes --> C5{"Constraint 5: Room Has Required Equipment/Facilities?"}
    
    C5 -- No --> NextRoom
    C5 -- Yes --> C6{"Constraint 6: Patient Free (No Simultaneous Booking)?"}
    
    C6 -- No --> NextSlot
    C6 -- Yes --> Assign["Lock Candidate Slot: Assign (Therapist, Room, Slot)"]
    
    Assign --> LocalList["Add to Local Booked Sessions (Prevents Intra-Run Conflicts)"]
    LocalList --> MoreSessions{"Are more sessions remaining in Plan Item?"}
    
    MoreSessions -- Yes --> NextDay["Advance Slot Date by 1 Day (Frequency Interval)"]
    NextDay --> C1
    
    MoreSessions -- No --> Done(["Commit Sessions Transactionally to Database & Return Allocation Summary"])
```

---

## 3. Therapist Leave & Automated Reallocation Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant DB as Database
    participant Engine as Scheduling Engine
    actor Therapist
    actor Patient

    Admin->>DB: POST /staff/{id}/availability (Register Approved Leave Date)
    Admin->>Engine: Trigger reallocate_affected_by_leave()
    
    activate Engine
    Engine->>DB: Find all sessions matching therapist_id on leave_date
    Engine->>DB: Update affected sessions: status = RESCHEDULED
    Engine->>Engine: Re-run allocator with leave constraints for affected plan items
    Engine->>DB: Insert new TherapySession linked via rescheduled_from_id
    deactivate Engine

    DB->>Patient: Push Notification: "Session rescheduled due to therapist leave"
    DB->>Admin: Reallocation complete: 100% placed with zero room/therapist overlap
```
