import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Calendar,
  Clock,
  X,
  Sparkles,
  Search,
  Stethoscope,
  Layers,
} from 'lucide-react'

interface SessionItem {
  id: string
  plan_item_id: string
  therapist_id: string
  room_id: string
  session_number: number
  scheduled_start: string
  scheduled_end: string
  status: string
}

interface RankedSlot {
  slot_start: string
  slot_end: string
  therapist_id: string
  therapist_name: string
  room_id: string
  room_name: string
  score: number
  rank: number
  reasons: string[]
}

interface DaywiseConsultation {
  id: string
  patient_id: string
  patient_name: string
  patient_phone?: string
  doctor_id: string
  doctor_name: string
  scheduled_at: string
  consultation_type: string
  chief_complaint?: string
  fee_paid: boolean
}

interface DaywiseTherapySession {
  id: string
  patient_id: string
  patient_name: string
  patient_phone?: string
  therapy_name: string
  session_number: number
  therapist_name: string
  room_name: string
  scheduled_start: string
  scheduled_end: string
  status: string
}

interface DaywiseSchedule {
  date: string
  day_name: string
  is_today: boolean
  total_unique_patients: number
  consultations: DaywiseConsultation[]
  therapy_sessions: DaywiseTherapySession[]
}

export default function Schedule() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'daywise' | 'operations'>('daywise')

  // Daywise View State
  const [daywiseRange, setDaywiseRange] = useState<number>(7)
  const [daywiseStartDate, setDaywiseStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [patientSearch, setPatientSearch] = useState<string>('')

  // Operations View State
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [recommendModalOpen, setRecommendModalOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Slot recommendation form
  const [recPatientId, setRecPatientId] = useState('')
  const [recTherapyId, setRecTherapyId] = useState('')
  const [recDate, setRecDate] = useState(new Date().toISOString().split('T')[0])
  const [rankedResults, setRankedResults] = useState<RankedSlot[]>([])
  const [recLoading, setRecLoading] = useState(false)

  const [recordForm, setRecordForm] = useState({
    observations: '',
    patient_feedback: '',
    oils_used: 'Mahanarayana Taila',
    pressure_level: 'Medium',
    therapist_notes: '',
    flagged_for_doctor: false,
  })

  // 1. Fetch Daywise Schedule & Upcoming Patients
  const { data: daywiseData = [], isLoading: daywiseLoading } = useQuery<DaywiseSchedule[]>({
    queryKey: ['daywise-schedule', daywiseStartDate, daywiseRange, patientSearch],
    queryFn: async () => {
      const params: any = {
        start_date: daywiseStartDate,
        days: daywiseRange,
      }
      if (patientSearch) params.search = patientSearch
      const res = await api.get('/scheduling/daywise', { params })
      return res.data
    },
    enabled: activeTab === 'daywise',
  })

  // 2. Fetch Sessions for Operations view
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/scheduling/sessions')
      return res.data
    },
    refetchInterval: 10000,
    enabled: activeTab === 'operations',
  })

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(`/scheduling/sessions/${sessionId}/checkin`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['daywise-schedule'] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: async ({ sessionId, body }: { sessionId: string; body: typeof recordForm }) => {
      await api.post(`/scheduling/sessions/${sessionId}/complete`, {
        session_id: sessionId,
        ...body,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['daywise-schedule'] })
      setCompleteModalOpen(false)
      setActiveSessionId(null)
    },
  })

  const markMissedMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(`/scheduling/sessions/${sessionId}/mark-missed`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['daywise-schedule'] })
    },
  })

  function openCompleteModal(sessionId: string) {
    setActiveSessionId(sessionId)
    setCompleteModalOpen(true)
  }

  function handleRecordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeSessionId) return
    completeMutation.mutate({ sessionId: activeSessionId, body: recordForm })
  }

  async function handleRecommendSlots(e: React.FormEvent) {
    e.preventDefault()
    setRecLoading(true)
    try {
      const res = await api.post('/scheduling/recommend-slots', {
        therapy_id: recTherapyId,
        patient_id: recPatientId,
        duration_minutes: 60,
        preferred_start_date: recDate,
        top_n: 3,
      })
      setRankedResults(res.data)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to recommend slots')
    } finally {
      setRecLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Scheduled
          </span>
        )
      case 'checked_in':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
            Checked In
          </span>
        )
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            In Progress
          </span>
        )
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed
          </span>
        )
      case 'missed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
            Missed
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200 capitalize">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="text-[var(--color-brand)]" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">Clinic Schedule & Patient Appointments</h1>
          </div>
          <p className="text-sm text-gray-500">
            Daywise schedule of arriving patients, doctor consultations, and Panchakarma therapy sessions.
          </p>
        </div>
        <button
          onClick={() => setRecommendModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
        >
          <Sparkles size={16} />
          Circadian Slot Optimizer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('daywise')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'daywise'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Calendar size={16} />
          Daywise View & Upcoming Patients
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'operations'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layers size={16} />
          Live Session Operations & Check-ins
        </button>
      </div>

      {/* TAB 1: DAYWISE VIEW & UPCOMING PATIENTS */}
      {activeTab === 'daywise' && (
        <div className="space-y-5">
          {/* Controls Bar: Range presets, Date picker, Patient search */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => {
                  setDaywiseStartDate(new Date().toISOString().split('T')[0])
                  setDaywiseRange(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  daywiseRange === 1 && daywiseStartDate === new Date().toISOString().split('T')[0]
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]
                  setDaywiseStartDate(tmrw)
                  setDaywiseRange(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  daywiseRange === 1 && daywiseStartDate !== new Date().toISOString().split('T')[0]
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Tomorrow
              </button>
              <button
                onClick={() => {
                  setDaywiseStartDate(new Date().toISOString().split('T')[0])
                  setDaywiseRange(7)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  daywiseRange === 7
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Next 7 Days
              </button>
              <button
                onClick={() => {
                  setDaywiseStartDate(new Date().toISOString().split('T')[0])
                  setDaywiseRange(14)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  daywiseRange === 14
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Next 14 Days
              </button>
            </div>

            {/* Custom Date + Search */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-xs text-gray-400 font-medium">From:</span>
                <input
                  type="date"
                  value={daywiseStartDate}
                  onChange={(e) => setDaywiseStartDate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder="Filter by patient name..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Daywise Cards Feed */}
          {daywiseLoading ? (
            <div className="p-12 text-center text-gray-400">Loading daywise schedule...</div>
          ) : daywiseData.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
              No appointments or sessions scheduled for this period.
            </div>
          ) : (
            <div className="space-y-6">
              {daywiseData.map((day) => {
                const totalItems = day.consultations.length + day.therapy_sessions.length
                const dayDateFormatted = new Date(day.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })

                return (
                  <div
                    key={day.date}
                    className={`rounded-3xl border transition overflow-hidden shadow-xs ${
                      day.is_today
                        ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Day Header Bar */}
                    <div
                      className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
                        day.is_today ? 'bg-amber-100/60 border-amber-200' : 'bg-gray-50/70 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            day.is_today ? 'bg-amber-700 text-white shadow-2xs' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {new Date(day.date).getDate()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-gray-900">
                              {day.day_name}, {dayDateFormatted}
                            </h2>
                            {day.is_today && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-600 text-white tracking-wide">
                                TODAY
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {day.total_unique_patients} Unique{' '}
                            {day.total_unique_patients === 1 ? 'Patient' : 'Patients'} Scheduled
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 bg-white rounded-lg border border-gray-200 font-semibold text-gray-700">
                          {day.consultations.length} Consultations
                        </span>
                        <span className="px-2.5 py-1 bg-white rounded-lg border border-gray-200 font-semibold text-gray-700">
                          {day.therapy_sessions.length} Therapy Sessions
                        </span>
                      </div>
                    </div>

                    {/* Day Content: Split into Consultations & Therapies */}
                    {totalItems === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-400 italic">
                        No appointments or therapies scheduled on this date.
                      </div>
                    ) : (
                      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Section A: Doctor Consultations */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                              <Stethoscope size={14} className="text-emerald-600" />
                              Doctor Consultations ({day.consultations.length})
                            </span>
                          </div>

                          {day.consultations.length === 0 ? (
                            <p className="text-xs text-gray-400 italic p-3">No consultations scheduled.</p>
                          ) : (
                            day.consultations.map((c) => (
                              <div
                                key={c.id}
                                className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-200 transition space-y-2 text-xs"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-bold text-gray-900 text-sm">{c.patient_name}</div>
                                    {c.patient_phone && (
                                      <div className="text-gray-400 text-[11px]">{c.patient_phone}</div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-gray-800 text-xs flex items-center gap-1 justify-end">
                                      <Clock size={12} className="text-gray-400" />
                                      {new Date(c.scheduled_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    <span
                                      className={`text-[10px] font-semibold ${
                                        c.fee_paid ? 'text-emerald-700' : 'text-amber-700'
                                      }`}
                                    >
                                      {c.fee_paid ? '✓ Fee Paid' : 'Fee Pending'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center text-gray-600 pt-1 border-t border-gray-50">
                                  <span>
                                    Attending: <strong className="text-emerald-800">{c.doctor_name}</strong>
                                  </span>
                                  <span className="capitalize px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-600">
                                    {c.consultation_type}
                                  </span>
                                </div>

                                {c.chief_complaint && (
                                  <p className="text-[11px] text-gray-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                    <strong>Complaint:</strong> {c.chief_complaint}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Section B: Panchakarma Therapies */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                              <Sparkles size={14} className="text-amber-600" />
                              Panchakarma Therapies ({day.therapy_sessions.length})
                            </span>
                          </div>

                          {day.therapy_sessions.length === 0 ? (
                            <p className="text-xs text-gray-400 italic p-3">No therapy sessions scheduled.</p>
                          ) : (
                            day.therapy_sessions.map((s) => (
                              <div
                                key={s.id}
                                className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-2xs hover:border-amber-200 transition space-y-2 text-xs"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-bold text-gray-900 text-sm">
                                      {s.patient_name}
                                    </div>
                                    <div className="text-amber-900 font-semibold text-xs">
                                      {s.therapy_name} (Session #{s.session_number})
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-gray-800 text-xs flex items-center gap-1 justify-end">
                                      <Clock size={12} className="text-gray-400" />
                                      {new Date(s.scheduled_start).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}{' '}
                                      -{' '}
                                      {new Date(s.scheduled_end).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    {getStatusBadge(s.status)}
                                  </div>
                                </div>

                                <div className="flex justify-between items-center text-gray-600 pt-1 border-t border-gray-50 text-[11px]">
                                  <span>
                                    Therapist: <strong className="text-gray-800">{s.therapist_name}</strong>
                                  </span>
                                  <span>
                                    Suite: <strong className="text-gray-800">{s.room_name}</strong>
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE SESSION OPERATIONS (Existing feature preserved) */}
      {activeTab === 'operations' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
            {sessionsLoading ? (
              <div className="p-8 text-center text-gray-400">Loading live operational sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No scheduled sessions in this view.</div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800 text-sm">Session #{session.session_number}</span>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Room ID: {session.room_id.slice(0, 8)}...</span>
                      <span>Therapist ID: {session.therapist_id.slice(0, 8)}...</span>
                      <span>
                        Time:{' '}
                        {new Date(session.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        - {new Date(session.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.status === 'scheduled' && (
                      <button
                        onClick={() => checkInMutation.mutate(session.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                      >
                        Check In
                      </button>
                    )}
                    {session.status === 'checked_in' && (
                      <button
                        onClick={() => openCompleteModal(session.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                      >
                        Complete Session
                      </button>
                    )}
                    {(session.status === 'scheduled' || session.status === 'checked_in') && (
                      <button
                        onClick={() => markMissedMutation.mutate(session.id)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-lg text-xs font-semibold transition"
                      >
                        Mark Missed
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* COMPLETE SESSION MODAL */}
      {completeModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setCompleteModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Complete Panchakarma Session</h2>
            <p className="text-xs text-gray-500 mb-4">
              Record therapist clinical notes, oils applied, and patient response.
            </p>

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Therapeutic Oils Used</label>
                <input
                  type="text"
                  required
                  value={recordForm.oils_used}
                  onChange={(e) => setRecordForm({ ...recordForm, oils_used: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pressure Level</label>
                <select
                  value={recordForm.pressure_level}
                  onChange={(e) => setRecordForm({ ...recordForm, pressure_level: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                >
                  <option value="Light">Light (Mridu)</option>
                  <option value="Medium">Medium (Madhyama)</option>
                  <option value="Firm">Firm (Pravana)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Therapist Clinical Notes</label>
                <textarea
                  rows={2}
                  required
                  value={recordForm.therapist_notes}
                  onChange={(e) => setRecordForm({ ...recordForm, therapist_notes: e.target.value })}
                  placeholder="Note tissue response, sweating quality, or patient comfort..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-red-700">
                  <input
                    type="checkbox"
                    checked={recordForm.flagged_for_doctor}
                    onChange={(e) => setRecordForm({ ...recordForm, flagged_for_doctor: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Flag for Attending Vaidya Review</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition"
                >
                  {completeMutation.isPending ? 'Saving...' : 'Finalize Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI CIRCADIAN SLOT RECOMMENDER MODAL */}
      {recommendModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setRecommendModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="text-amber-600" size={20} />
              <h2 className="text-lg font-bold text-gray-900">Ayurvedic Circadian Slot Optimizer</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Ranks open clinical slots based on traditional Dosha circadian windows (e.g. Kapha detox morning window).
            </p>

            <form onSubmit={handleRecommendSlots} className="space-y-3 p-4 bg-amber-50/50 rounded-2xl border border-amber-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Patient ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Patient UUID"
                    value={recPatientId}
                    onChange={(e) => setRecPatientId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Therapy ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Therapy UUID"
                    value={recTherapyId}
                    onChange={(e) => setRecTherapyId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-end justify-between gap-3 pt-1">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Start Date</label>
                  <input
                    type="date"
                    required
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={recLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  {recLoading ? 'Evaluating...' : 'Find Ranked Slots'}
                </button>
              </div>
            </form>

            {/* Results */}
            {rankedResults.length > 0 && (
              <div className="mt-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Top Recommended Slots (Ranked by Clinical & Resource Fit)
                </h3>
                {rankedResults.map((rec) => {
                  const isTop = rec.rank === 1
                  return (
                    <div
                      key={rec.rank}
                      className={`p-4 rounded-2xl border transition-all ${
                        isTop
                          ? 'bg-amber-50/50 border-amber-300 shadow-xs ring-1 ring-amber-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isTop ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            #{rec.rank}
                          </span>
                          <div>
                            <span className="font-bold text-gray-800 text-sm">
                              {new Date(rec.slot_start).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                              , {new Date(rec.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                              {new Date(rec.slot_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          Fit Score: {rec.score}
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 flex gap-4 my-2">
                        <span>Therapist: <strong className="text-gray-800">{rec.therapist_name}</strong></span>
                        <span>Room: <strong className="text-gray-800">{rec.room_name}</strong></span>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-gray-100/80">
                        <span className="text-[11px] font-semibold text-gray-400 block">Evaluation Rationale:</span>
                        {rec.reasons.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
