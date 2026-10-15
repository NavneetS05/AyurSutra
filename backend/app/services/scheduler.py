"""
Scheduling Engine — greedy slot allocator with hard-constraint filtering.

Given a list of TreatmentPlanItems, this engine:
1. Generates candidate time slots within clinic hours.
2. Filters slots by hard constraints (therapist free + qualified,
   room free + equipped, patient free, within clinic hours).
3. Assigns sessions greedily, earliest first.
4. Returns assigned TherapySession objects (not yet committed to DB).

Concurrency note: DB-level exclusion constraints / row locks must be
applied in the calling service layer before committing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models import (
    Room,
    SessionStatus,
    Staff,
    StaffAvailability,
    TherapySession,
    TreatmentPlanItem,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class SlotCandidate:
    start: datetime
    end: datetime
    therapist: Staff
    room: Room
    reason: str = ""


@dataclass
class AllocationResult:
    plan_item_id: str
    therapy_name: str
    assigned: list[TherapySession] = field(default_factory=list)
    unassigned_count: int = 0
    conflicts: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Hard constraint checkers
# ---------------------------------------------------------------------------


def _therapist_qualified(therapist: Staff, therapy_id: str) -> bool:
    authorized_ids = {tt.therapy_id for tt in therapist.authorized_therapies}
    return therapy_id in authorized_ids


def _sessions_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    """Return True if two half-open intervals [s1, e1) and [s2, e2) overlap."""
    return start1 < end2 and start2 < end1


def _therapist_free(
    therapist: Staff,
    start: datetime,
    end: datetime,
    booked_sessions: list[TherapySession],
) -> bool:
    for session in booked_sessions:
        if session.therapist_id == therapist.id:
            if _sessions_overlap(start, end, session.scheduled_start, session.scheduled_end):
                return False
    return True


def _room_free(
    room: Room,
    start: datetime,
    end: datetime,
    booked_sessions: list[TherapySession],
) -> bool:
    for session in booked_sessions:
        if session.room_id == room.id:
            if _sessions_overlap(start, end, session.scheduled_start, session.scheduled_end):
                return False
    return True


def _patient_free(
    patient_id: str,
    start: datetime,
    end: datetime,
    booked_sessions: list[TherapySession],
    plan_items_map: dict[str, str],  # plan_item_id -> patient_id
) -> bool:
    for session in booked_sessions:
        pid = plan_items_map.get(session.plan_item_id)
        if pid == patient_id:
            if _sessions_overlap(start, end, session.scheduled_start, session.scheduled_end):
                return False
    return True


def _therapist_working(
    therapist: Staff,
    slot_date: date,
    start_time: time,
    end_time: time,
) -> bool:
    weekday = slot_date.weekday()
    for avail in therapist.availabilities:
        # Check leave
        if avail.leave_date and avail.leave_date == slot_date:
            return False
    for avail in therapist.availabilities:
        if avail.weekday == weekday and avail.start_time and avail.end_time:
            if avail.start_time <= start_time and avail.end_time >= end_time:
                return True
    return False


def _room_has_facilities(room: Room, required: str | None) -> bool:
    if not required:
        return True
    required_set = {f.strip().lower() for f in required.split(",") if f.strip()}
    room_set = {f.strip().lower() for f in (room.facilities or "").split(",") if f.strip()}
    return required_set.issubset(room_set)


# ---------------------------------------------------------------------------
# Slot generator
# ---------------------------------------------------------------------------


def _generate_candidate_slots(
    start_date: date,
    duration_minutes: int,
    clinic_open: time,
    clinic_close: time,
    days_ahead: int = 60,
) -> list[tuple[date, time, time]]:
    """Yield (slot_date, start_time, end_time) within clinic hours."""
    candidates = []
    step = timedelta(minutes=30)  # 30-min grid
    current_date = start_date
    for _ in range(days_ahead):
        slot_start = datetime.combine(current_date, clinic_open)
        day_end = datetime.combine(current_date, clinic_close)
        while slot_start + timedelta(minutes=duration_minutes) <= day_end:
            slot_end = slot_start + timedelta(minutes=duration_minutes)
            candidates.append((current_date, slot_start.time(), slot_end.time()))
            slot_start += step
        current_date += timedelta(days=1)
    return candidates


# ---------------------------------------------------------------------------
# Main allocator
# ---------------------------------------------------------------------------


class SchedulingEngine:
    def __init__(
        self,
        db: Session,
        clinic_open: time,
        clinic_close: time,
    ):
        self.db = db
        self.clinic_open = clinic_open
        self.clinic_close = clinic_close

    def allocate(
        self,
        plan_items: list[TreatmentPlanItem],
        patient_id: str,
        preferred_start_date: date,
        preferred_therapist_ids: list[str] | None = None,
        preferred_room_ids: list[str] | None = None,
    ) -> list[AllocationResult]:
        """
        Allocate all sessions for a list of plan items.

        Returns AllocationResult per plan item.
        Sessions are not committed to DB — caller handles persistence + locking.
        """
        # Load resources
        therapists = self._load_therapists(preferred_therapist_ids)
        rooms = self._load_rooms(preferred_room_ids)

        # Existing booked sessions (already in DB, not cancelled/missed)
        active_statuses = [
            SessionStatus.scheduled,
            SessionStatus.confirmed,
            SessionStatus.checked_in,
            SessionStatus.in_progress,
        ]
        booked_sessions: list[TherapySession] = (
            self.db.query(TherapySession)
            .filter(TherapySession.status.in_(active_statuses))
            .all()
        )

        # Build patient map for overlap checks
        plan_item_ids = [pi.id for pi in plan_items]
        all_items = self.db.query(TreatmentPlanItem).all()
        plan_items_map: dict[str, str] = {}
        for item in all_items:
            plan = item.plan
            if plan and plan.consultation and plan.consultation.patient_id:
                plan_items_map[item.id] = plan.consultation.patient_id

        results: list[AllocationResult] = []

        for plan_item in plan_items:
            result = AllocationResult(
                plan_item_id=plan_item.id,
                therapy_name=plan_item.therapy.name if plan_item.therapy else "Unknown",
            )
            therapy = plan_item.therapy
            required_facilities = therapy.required_facilities if therapy else None

            candidates = _generate_candidate_slots(
                preferred_start_date,
                plan_item.duration_minutes,
                self.clinic_open,
                self.clinic_close,
            )

            sessions_needed = plan_item.session_count

            for session_num in range(1, sessions_needed + 1):
                slot_assigned = False

                for slot_date, start_t, end_t in candidates:
                    slot_start_dt = datetime.combine(slot_date, start_t)
                    slot_end_dt = datetime.combine(slot_date, end_t)

                    # Skip past datetimes
                    if slot_start_dt < datetime.now():
                        continue

                    for therapist in therapists:
                        # Hard constraint 1: therapist qualified
                        if therapy and not _therapist_qualified(therapist, therapy.id):
                            continue
                        # Hard constraint 2: therapist working
                        if not _therapist_working(therapist, slot_date, start_t, end_t):
                            continue
                        # Hard constraint 3: therapist free
                        if not _therapist_free(therapist, slot_start_dt, slot_end_dt, booked_sessions):
                            continue

                        for room in rooms:
                            # Hard constraint 4: room has required facilities
                            if not _room_has_facilities(room, required_facilities):
                                continue
                            # Hard constraint 5: room free
                            if not _room_free(room, slot_start_dt, slot_end_dt, booked_sessions):
                                continue
                            # Hard constraint 6: patient free
                            if not _patient_free(patient_id, slot_start_dt, slot_end_dt, booked_sessions, plan_items_map):
                                continue

                            # All constraints satisfied — create session
                            new_session = TherapySession(
                                plan_item_id=plan_item.id,
                                therapist_id=therapist.id,
                                room_id=room.id,
                                session_number=session_num,
                                scheduled_start=slot_start_dt,
                                scheduled_end=slot_end_dt,
                                status=SessionStatus.scheduled,
                            )
                            result.assigned.append(new_session)
                            booked_sessions.append(new_session)  # prevent double-booking in same run

                            logger.info(
                                "Allocated session %d/%d for plan_item=%s: %s %s–%s in room %s with %s",
                                session_num,
                                sessions_needed,
                                plan_item.id,
                                slot_date,
                                start_t,
                                end_t,
                                room.name,
                                therapist.user.email if therapist.user else therapist.id,
                            )
                            slot_assigned = True
                            break  # room found

                        if slot_assigned:
                            break  # therapist found

                    if slot_assigned:
                        break  # candidate slot consumed

                if not slot_assigned:
                    result.unassigned_count += 1
                    result.conflicts.append(
                        f"Session {session_num}/{sessions_needed} could not be allocated "
                        f"within 60 days. No free slot satisfying all constraints."
                    )

            results.append(result)

        return results

    def _load_therapists(self, ids: list[str] | None) -> list[Staff]:
        q = self.db.query(Staff).filter(Staff.is_therapist == True)  # noqa: E712
        if ids:
            q = q.filter(Staff.id.in_(ids))
        return q.all()

    def _load_rooms(self, ids: list[str] | None) -> list[Room]:
        q = self.db.query(Room).filter(Room.is_active == True)  # noqa: E712
        if ids:
            q = q.filter(Room.id.in_(ids))
        return q.all()

    def reallocate_affected_by_leave(
        self,
        therapist_id: str,
        leave_date: date,
        patient_id_map: dict[str, str],  # plan_item_id -> patient_id
    ) -> list[TherapySession]:
        """
        Find sessions affected by a therapist's new leave date and
        re-allocate them using alternate resources.
        Returns new TherapySession objects (not committed).
        """
        affected = (
            self.db.query(TherapySession)
            .filter(
                TherapySession.therapist_id == therapist_id,
                TherapySession.status.in_([SessionStatus.scheduled, SessionStatus.confirmed]),
            )
            .all()
        )

        affected_on_date = [
            s for s in affected
            if s.scheduled_start.date() == leave_date
        ]

        new_sessions = []
        for session in affected_on_date:
            plan_item = session.plan_item
            patient_id = patient_id_map.get(plan_item.id, "")
            results = self.allocate(
                plan_items=[plan_item],
                patient_id=patient_id,
                preferred_start_date=leave_date,
            )
            for result in results:
                new_sessions.extend(result.assigned)

            # Mark original as rescheduled
            session.status = SessionStatus.rescheduled

        return new_sessions
