import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Calendar, Clock, CheckCircle2, UserCheck, X, Sparkles } from 'lucide-react'

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

export default function Schedule() {
  const queryClient = useQueryClient()
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

  // Fetch sessions
  const { data: sessions = [], isLoading } = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/scheduling/sessions')
      return res.data
    },
    refetchInterval: 10000,
  })

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(`/scheduling/sessions/${sessionId}/checkin`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  // Complete session mutation
  const completeMutation = useMutation({
    mutationFn: async ({ sessionId, body }: { sessionId: string; body: typeof recordForm }) => {
      await api.post(`/scheduling/sessions/${sessionId}/complete`, {
        session_id: sessionId,
        ...body,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] }),
      setCompleteModalOpen(false)
      setActiveSessionId(null)
    },
  })

  // Mark missed mutation
  const markMissedMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(`/scheduling/sessions/${sessionId}/mark-missed`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Scheduled</span>
      case 'checked_in':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">Checked In</span>
      case 'in_progress':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">In Progress</span>
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>
      case 'missed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Missed</span>
      case 'rescheduled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Rescheduled</span>
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
    }
  }

  // Fetch patients & therapies for recommendation picker
  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => (await api.get('/patients/')).data,
  })

  const { data: therapies = [] } = useQuery({
    queryKey: ['therapies-list'],
    queryFn: async () => (await api.get('/therapies/')).data,
  })

  async function handleRunRecommendations(e: React.FormEvent) {
    e.preventDefault()
    if (!recPatientId || !recTherapyId) return
    setRecLoading(true)
    try {
      const res = await api.post('/scheduling/recommend-slots', {
        patient_id: recPatientId,
        therapy_id: recTherapyId,
        preferred_start_date: recDate,
        top_n: 3,
      })
      setRankedResults(res.data)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to fetch slot recommendations')
    } finally {
      setRecLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Therapy Schedule</h1>
          <p className="text-sm text-gray-500">Multi-session management with conflict detection and room assignment</p>
        </div>
        <button
          onClick={() => {
            if (patients.length > 0) setRecPatientId(patients[0].id)
            if (therapies.length > 0) setRecTherapyId(therapies[0].id)
            setRecommendModalOpen(true)
          }}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition"
        >
          <Sparkles size={16} />
          Recommend Best Slots
        </button>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading schedule...</div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Calendar className="mx-auto text-gray-300 mb-3" size={36} />
            <p className="text-base font-semibold text-gray-700">No therapy sessions scheduled</p>
            <p className="text-xs text-gray-500 mt-1">
              Finalize a treatment plan and allocate sessions to see them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Session</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-medium text-gray-800">
                      Session #{s.session_number}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        <Calendar size={13} className="text-gray-400" />
                        {new Date(s.scheduled_start).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                        <Clock size={12} />
                        {new Date(s.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(s.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(s.status)}</td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {s.status === 'scheduled' && (
                        <button
                          onClick={() => checkInMutation.mutate(s.id)}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          <UserCheck size={12} />
                          Check In
                        </button>
                      )}
                      {(s.status === 'checked_in' || s.status === 'scheduled') && (
                        <button
                          onClick={() => openCompleteModal(s.id)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          <CheckCircle2 size={12} />
                          Complete & Record
                        </button>
                      )}
                      {s.status === 'scheduled' && (
                        <button
                          onClick={() => markMissedMutation.mutate(s.id)}
                          className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          Missed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Session Modal */}
      {completeModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setCompleteModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Session Notes & Record</h2>
            <p className="text-xs text-gray-500 mb-4">Complete treatment session with clinical observations</p>

            <form onSubmit={handleRecordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Oils / Herbs Used</label>
                <input
                  type="text"
                  value={recordForm.oils_used}
                  onChange={(e) => setRecordForm({ ...recordForm, oils_used: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pressure Level</label>
                <select
                  value={recordForm.pressure_level}
                  onChange={(e) => setRecordForm({ ...recordForm, pressure_level: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                >
                  <option value="Light">Light (Mridu)</option>
                  <option value="Medium">Medium (Madhyama)</option>
                  <option value="Deep">Deep / Firm (Teevra)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Therapist Observations</label>
                <textarea
                  rows={2}
                  value={recordForm.observations}
                  onChange={(e) => setRecordForm({ ...recordForm, observations: e.target.value })}
                  placeholder="e.g. Muscle stiffness reduced, relaxation observed."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Patient Feedback</label>
                <input
                  type="text"
                  value={recordForm.patient_feedback}
                  onChange={(e) => setRecordForm({ ...recordForm, patient_feedback: e.target.value })}
                  placeholder="e.g. Felt very calm and relaxed."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-red-800">
                  <input
                    type="checkbox"
                    checked={recordForm.flagged_for_doctor}
                    onChange={(e) => setRecordForm({ ...recordForm, flagged_for_doctor: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Flag this session for Doctor's immediate review</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
                >
                  {completeMutation.isPending ? 'Saving...' : 'Complete Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ranked Slot Recommendation Assistant Modal */}
      {recommendModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setRecommendModalOpen(false)
                setRankedResults([])
              }}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <Sparkles size={20} />
              <h2 className="text-xl font-bold text-gray-800">Smart Slot Recommendation Assistant</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              AI & rule-based ranking: matches optimal Ayurvedic circadian timing, therapist workload, and specialized equipment.
            </p>

            <form onSubmit={handleRunRecommendations} className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Patient</label>
                  <select
                    required
                    value={recPatientId}
                    onChange={(e) => setRecPatientId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {patients.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Therapy</label>
                  <select
                    required
                    value={recTherapyId}
                    onChange={(e) => setRecTherapyId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {therapies.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.default_duration_minutes}m)
                      </option>
                    ))}
                  </select>
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={recLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-60 flex items-center gap-1.5"
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
                          ? 'bg-amber-50/50 border-amber-300 shadow-sm ring-1 ring-amber-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isTop
                                ? 'bg-amber-600 text-white'
                                : 'bg-gray-100 text-gray-700'
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
