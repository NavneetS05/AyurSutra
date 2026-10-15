import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Calendar, Clock, CheckCircle2, UserCheck, X } from 'lucide-react'

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

export default function Schedule() {
  const queryClient = useQueryClient()
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Therapy Schedule</h1>
          <p className="text-sm text-gray-500">Multi-session management with conflict detection and room assignment</p>
        </div>
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
    </div>
  )
}
