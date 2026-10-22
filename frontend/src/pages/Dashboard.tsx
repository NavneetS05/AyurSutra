import { useAuth } from '@/lib/auth'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Users,
  Calendar,
  ClipboardList,
  Sparkles,
  Leaf,
  Stethoscope,
  ArrowRight,
  Clock,
  UserCheck,
  DoorClosed,
  CalendarPlus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth()

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => (await api.get('/patients/')).data,
  })

  const { data: therapies = [] } = useQuery({
    queryKey: ['therapies'],
    queryFn: async () => (await api.get('/therapies/')).data,
  })

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await api.get('/scheduling/sessions')).data,
  })

  const { data: staffList = [], refetch: refetchStaff } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get('/staff/')).data,
    enabled: ['admin', 'receptionist', 'doctor', 'therapist'].includes(user?.role || ''),
  })
  const doctors = staffList.filter((s: any) => s.is_doctor)
  const therapists = staffList.filter((s: any) => s.is_therapist)

  const { data: rooms = [], refetch: refetchRooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api.get('/rooms/?active_only=false')).data,
    enabled: ['admin', 'receptionist', 'doctor', 'therapist'].includes(user?.role || ''),
  })

  const completedSessions = sessions.filter((s: any) => s.status === 'completed').length
  const completionRate = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0

  const onlineDoctorsCount = doctors.filter((d: any) => d.is_online).length
  const onlineTherapistsCount = therapists.filter((t: any) => t.is_online).length
  const activeRoomsCount = rooms.filter((r: any) => r.status === 'active' && r.is_active).length

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#5a6e4d] to-[#6b7f5e] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white mb-2">
            <Sparkles size={13} />
            Ayurveda Clinical Platform
          </span>
          <h1 className="text-2xl font-bold">Welcome back, {user?.email}</h1>
          <p className="text-sm text-emerald-100 mt-1">
            Current Role: <span className="capitalize font-semibold">{user?.role}</span> • Panchakarma Centre Operations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'receptionist' && (
            <Link
              to="/consultations"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              <CalendarPlus size={16} />
              Book Appointment
            </Link>
          )}
          <Link
            to="/consultations"
            className="px-4 py-2 bg-white text-[var(--color-brand-dark)] hover:bg-emerald-50 rounded-lg text-sm font-semibold transition shadow-sm"
          >
            Consultations
          </Link>
          <Link
            to="/schedule"
            className="px-4 py-2 bg-emerald-800/60 hover:bg-emerald-800 text-white rounded-lg text-sm font-medium transition"
          >
            Schedule
          </Link>
        </div>
      </div>

      {/* Dynamic Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-blue-50 text-blue-600">
            <Calendar size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{sessions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Scheduled Sessions</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-emerald-50 text-emerald-600">
            <Users size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{patients.length}</p>
          <p className="text-xs text-gray-500 mt-1">Registered Patients</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-amber-50 text-amber-600">
            <Leaf size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{therapies.length}</p>
          <p className="text-xs text-gray-500 mt-1">Active Therapies in Catalogue</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-purple-50 text-purple-600">
            <ClipboardList size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {completionRate}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Session Attendance Rate</p>
        </div>
      </div>

      {/* Front Desk Live Operational Status (Receptionist & Clinical Staff) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserCheck size={20} className="text-[var(--color-brand)]" />
              Front Desk Live Operations Board
            </h2>
            <p className="text-xs text-gray-500">
              Real-time availability of Consulting Vaidyas, Certified Therapists, and Treatment Rooms
            </p>
          </div>
          <button
            onClick={() => {
              refetchStaff()
              refetchRooms()
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
          >
            <RefreshCw size={13} />
            Refresh Status
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Active Doctors (Vaidyas) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-emerald-700" />
                <h3 className="font-bold text-gray-800 text-sm">Consulting Doctors</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {onlineDoctorsCount} / {doctors.length} Online
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-80 pr-1 flex-1">
              {doctors.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No doctors registered</p>
              ) : (
                doctors.map((d: any) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-gray-900 text-xs block">
                          Dr. {d.first_name} {d.last_name}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {d.specialization || 'Ayurvedic Physician'}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.is_online
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            d.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                          }`}
                        />
                        {d.is_online ? 'Available' : 'Away'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-2">
                      <Clock size={12} className="text-gray-400" />
                      <span>
                        Shift: {d.working_hours_start || '09:00'} - {d.working_hours_end || '18:00'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-gray-100">
              <Link
                to="/staff"
                className="text-xs font-semibold text-[var(--color-brand)] hover:underline flex items-center justify-between"
              >
                <span>View Vaidya Schedule</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Column 2: Active Therapists */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-teal-700" />
                <h3 className="font-bold text-gray-800 text-sm">Panchakarma Therapists</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                {onlineTherapistsCount} / {therapists.length} On Duty
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-80 pr-1 flex-1">
              {therapists.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No therapists registered</p>
              ) : (
                therapists.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-gray-900 text-xs block">
                          {t.first_name} {t.last_name}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {t.qualification || 'Certified Ayurvedic Therapist'}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.is_online
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                          }`}
                        />
                        {t.is_online ? 'On Duty' : 'Away'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-2">
                      <Clock size={12} className="text-gray-400" />
                      <span>
                        Shift: {t.working_hours_start || '09:00'} - {t.working_hours_end || '18:00'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-gray-100">
              <Link
                to="/staff"
                className="text-xs font-semibold text-teal-700 hover:underline flex items-center justify-between"
              >
                <span>View Therapist Roster</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Column 3: Treatment Rooms & Suites */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <DoorClosed size={18} className="text-amber-700" />
                <h3 className="font-bold text-gray-800 text-sm">Treatment Rooms</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                {activeRoomsCount} / {rooms.length} Active
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-80 pr-1 flex-1">
              {rooms.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No rooms registered</p>
              ) : (
                rooms.map((r: any) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-gray-900 text-xs block">{r.name}</span>
                        <span className="text-[11px] text-gray-500">
                          Capacity: {r.capacity} Bed{r.capacity > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'cleaning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {r.status === 'active' ? (
                          <>
                            <CheckCircle2 size={10} className="text-emerald-600" /> Active
                          </>
                        ) : r.status === 'cleaning' ? (
                          <>
                            <RefreshCw size={10} className="text-amber-600" /> Cleaning
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={10} className="text-red-600" /> Maintenance
                          </>
                        )}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-gray-600 space-y-0.5">
                      {r.assigned_doctor_name && (
                        <div className="text-gray-600">
                          <strong className="text-gray-700">Doctor:</strong> {r.assigned_doctor_name}
                        </div>
                      )}
                      {r.assigned_therapist_name && (
                        <div className="text-gray-600">
                          <strong className="text-gray-700">Therapist:</strong> {r.assigned_therapist_name}
                        </div>
                      )}
                      {!r.assigned_doctor_name && !r.assigned_therapist_name && (
                        <div className="text-gray-400 italic">No doctor or therapist assigned</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-gray-100">
              <Link
                to="/rooms"
                className="text-xs font-semibold text-amber-700 hover:underline flex items-center justify-between"
              >
                <span>Manage All Suites</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/patients"
          className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform">
              <Users size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Patient Management</h3>
            <p className="text-xs text-gray-500">
              Register patients, view medical history, allergies, and check longitudinal 360 EHR records.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:gap-2 transition-all">
            <span>Check Patient Records</span>
            <ArrowRight size={14} />
          </div>
        </Link>

        <Link
          to="/consultations"
          className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform">
              <Stethoscope size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Clinical Consultations</h3>
            <p className="text-xs text-gray-500">
              Book appointments, collect cash fees, record Prakriti/Vikriti notes, and draft treatment plans.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600 group-hover:gap-2 transition-all">
            <span>Book & Manage Consultations</span>
            <ArrowRight size={14} />
          </div>
        </Link>

        <Link
          to="/schedule"
          className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform">
              <Clock size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Smart Scheduling Engine</h3>
            <p className="text-xs text-gray-500">
              Conflict-free multi-session allocation based on therapist qualifications, room facilities, and clinic hours.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-amber-600 group-hover:gap-2 transition-all">
            <span>Open schedule</span>
            <ArrowRight size={14} />
          </div>
        </Link>
      </div>
    </div>
  )
}
