"""
Pytest tests for the scheduling engine.
Tests core hard constraints without needing a live DB.
"""
import pytest
from datetime import date, datetime, time, timedelta
from unittest.mock import MagicMock, patch

from app.models import (
    Room,
    SessionStatus,
    Staff,
    StaffAvailability,
    TherapistTherapy,
    TherapySession,
    TreatmentPlan,
    TreatmentPlanItem,
    Therapy,
    Consultation,
)
from app.services.scheduler import (
    SchedulingEngine,
    _sessions_overlap,
    _therapist_qualified,
    _therapist_free,
    _room_free,
    _patient_free,
    _room_has_facilities,
    _therapist_working,
)


# ---------------------------------------------------------------------------
# Unit tests — pure constraint functions
# ---------------------------------------------------------------------------


class TestOverlap:
    def test_overlap_middle(self):
        s1, e1 = datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10)
        s2, e2 = datetime(2026, 1, 1, 9, 30), datetime(2026, 1, 1, 10, 30)
        assert _sessions_overlap(s1, e1, s2, e2)

    def test_back_to_back_no_overlap(self):
        """Back-to-back sessions must NOT be flagged as conflicting."""
        s1, e1 = datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10)
        s2, e2 = datetime(2026, 1, 1, 10), datetime(2026, 1, 1, 11)
        assert not _sessions_overlap(s1, e1, s2, e2)

    def test_contained_overlap(self):
        s1, e1 = datetime(2026, 1, 1, 8), datetime(2026, 1, 1, 12)
        s2, e2 = datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 11)
        assert _sessions_overlap(s1, e1, s2, e2)

    def test_no_overlap(self):
        s1, e1 = datetime(2026, 1, 1, 8), datetime(2026, 1, 1, 9)
        s2, e2 = datetime(2026, 1, 1, 10), datetime(2026, 1, 1, 11)
        assert not _sessions_overlap(s1, e1, s2, e2)


class TestTherapistQualified:
    def _make_therapist(self, therapy_ids):
        t = MagicMock(spec=Staff)
        t.authorized_therapies = [MagicMock(therapy_id=tid) for tid in therapy_ids]
        return t

    def test_qualified(self):
        therapist = self._make_therapist(["t1", "t2"])
        assert _therapist_qualified(therapist, "t1")

    def test_not_qualified(self):
        therapist = self._make_therapist(["t1"])
        assert not _therapist_qualified(therapist, "t2")


class TestRoomFacilities:
    def _make_room(self, facilities_str):
        r = MagicMock(spec=Room)
        r.facilities = facilities_str
        return r

    def test_all_facilities_present(self):
        room = self._make_room("steam,table,towel")
        assert _room_has_facilities(room, "steam,table")

    def test_missing_facility(self):
        room = self._make_room("table,towel")
        assert not _room_has_facilities(room, "steam,table")

    def test_no_requirement(self):
        room = self._make_room("table")
        assert _room_has_facilities(room, None)


class TestTherapistFree:
    def _make_session(self, therapist_id, start, end):
        s = MagicMock(spec=TherapySession)
        s.therapist_id = therapist_id
        s.scheduled_start = start
        s.scheduled_end = end
        return s

    def test_therapist_double_booking_rejected(self):
        booked = [
            self._make_session("th1", datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10))
        ]
        assert not _therapist_free(
            MagicMock(id="th1"),
            datetime(2026, 1, 1, 9, 30),
            datetime(2026, 1, 1, 10, 30),
            booked,
        )

    def test_different_therapist_allowed(self):
        booked = [
            self._make_session("th1", datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10))
        ]
        assert _therapist_free(
            MagicMock(id="th2"),
            datetime(2026, 1, 1, 9),
            datetime(2026, 1, 1, 10),
            booked,
        )


class TestRoomFree:
    def _make_session(self, room_id, start, end):
        s = MagicMock(spec=TherapySession)
        s.room_id = room_id
        s.scheduled_start = start
        s.scheduled_end = end
        return s

    def test_same_room_double_booking_rejected(self):
        booked = [
            self._make_session("room1", datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10))
        ]
        assert not _room_free(
            MagicMock(id="room1"),
            datetime(2026, 1, 1, 9, 30),
            datetime(2026, 1, 1, 10, 30),
            booked,
        )

    def test_different_room_allowed(self):
        booked = [
            self._make_session("room1", datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10))
        ]
        assert _room_free(
            MagicMock(id="room2"),
            datetime(2026, 1, 1, 9),
            datetime(2026, 1, 1, 10),
            booked,
        )


class TestPatientFree:
    def _make_session(self, plan_item_id, start, end):
        s = MagicMock(spec=TherapySession)
        s.plan_item_id = plan_item_id
        s.scheduled_start = start
        s.scheduled_end = end
        return s

    def test_patient_double_booking_rejected(self):
        booked = [self._make_session("pi1", datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10))]
        plan_items_map = {"pi1": "patient1"}
        assert not _patient_free(
            "patient1",
            datetime(2026, 1, 1, 9, 30),
            datetime(2026, 1, 1, 10, 30),
            booked,
            plan_items_map,
        )

    def test_different_patient_allowed(self):
        booked = [self._make_session("pi1", datetime(2026, 1, 1, 9), datetime(2026, 1, 1, 10))]
        plan_items_map = {"pi1": "patient1"}
        assert _patient_free(
            "patient2",
            datetime(2026, 1, 1, 9),
            datetime(2026, 1, 1, 10),
            booked,
            plan_items_map,
        )
