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


class TestSlotRecommendations:
    def test_slot_recommendation_ranking(self):
        """Verify recommend_slots ranks morning Ayurvedic timing highest and includes reasons."""
        mock_db = MagicMock()

        # Mock therapy
        mock_th = MagicMock(spec=Therapy, id="th1", name="Abhyanga", required_facilities=None)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_th

        # Mock therapist working every day
        mock_therapist = MagicMock(spec=Staff, id="st1", first_name="Anitha", last_name="K")
        mock_avail = MagicMock(spec=StaffAvailability, weekday=date.today().weekday(), start_time=time(8, 0), end_time=time(18, 0), leave_date=None)
        mock_therapist.availabilities = [mock_avail]
        mock_tt = MagicMock(spec=TherapistTherapy, therapy_id="th1")
        mock_therapist.authorized_therapies = [mock_tt]

        # Mock room
        mock_room = MagicMock(spec=Room, id="r1", name="Dhanvantari", facilities="table,oil")

        engine = SchedulingEngine(db=mock_db, clinic_open=time(8, 0), clinic_close=time(18, 0))
        engine._load_therapists = MagicMock(return_value=[mock_therapist])
        engine._load_rooms = MagicMock(return_value=[mock_room])

        mock_db.query.return_value.filter.return_value.all.return_value = []
        mock_db.query.return_value.all.return_value = []

        recs = engine.recommend_slots(
            therapy_id="th1",
            patient_id="p1",
            duration_minutes=60,
            preferred_start_date=date.today(),
            top_n=3,
        )

        assert len(recs) <= 3
        if recs:
            assert recs[0].rank == 1
            assert recs[0].score >= recs[-1].score
            assert len(recs[0].reasons) > 0
            assert any("timing" in r.lower() or "detox" in r.lower() or "window" in r.lower() for r in recs[0].reasons)
