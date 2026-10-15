import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Calendar,
  Clock,
  Sparkles,
  FileText,
  Utensils,
  Moon,
  MessageSquare,
  Download,
  X,
} from 'lucide-react'

export default function PatientPortal() {
  const queryClient = useQueryClient()

  // Modals state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [rescheduleForm, setRescheduleForm] = useState({
    preferred_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    reason: '',
  })
  const [feedbackForm, setFeedbackForm] = useState({
    feedback: '',
    flag_doctor: false,
  })

  // Fetch portal summary
  const { data: portalData, isLoading } = useQuery({
    queryKey: ['patient-portal'],
    queryFn: async () => {
      const res = await api.get('/patients/me/portal')
      return res.data
    },
    refetchInterval: 15000,
  })

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ sessionId, body }: any) => {
      const res = await api.post(`/scheduling/sessions/${sessionId}/reschedule-request`, body)
      return res.data
    },
    onSuccess: () => {
      alert('Reschedule request sent to clinic reception!')
      setRescheduleModalOpen(false)
      setRescheduleForm({ preferred_date: '', reason: '' })
      queryClient.invalidateQueries({ queryKey: ['patient-portal'] })
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to submit reschedule request')
    },
  })

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ sessionId, body }: any) => {
      const res = await api.post(`/scheduling/sessions/${sessionId}/feedback`, body)
      return res.data
    },
    onSuccess: () => {
      alert('Feedback recorded. Thank you!')
      setFeedbackModalOpen(false)
      setFeedbackForm({ feedback: '', flag_doctor: false })
      queryClient.invalidateQueries({ queryKey: ['patient-portal'] })
    },
  })

  if (isLoading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Sparkles className="animate-spin mx-auto text-emerald-600 mb-2" size={28} />
        Loading your wellness portal...
      </div>
    )
  }

  if (!portalData) {
    return (
      <div className="p-8 text-center text-gray-400">
        No active patient records found.
      </div>
    )
  }

  const { patient, active_plan, sessions, progress, packages, payments } = portalData

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Patient Welcome Banner */}
      <div className="bg-gradient-to-r from-[#4d6342] to-[#6b7f5e] rounded-3xl p-6 md:p-8 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white mb-2">
            <Sparkles size={13} />
            AyurSutra Patient Wellness Journey
          </span>
          <h1 className="text-2xl md:text-3xl font-bold">
            Namaste, {patient.first_name} {patient.last_name}
          </h1>
          <p className="text-xs md:text-sm text-emerald-100 mt-1">
            Registered Phone: {patient.phone} • {patient.email || 'Digital Portal'}
          </p>
        </div>

        {/* Attendance Badge - Compliance requirement: Measures attendance, not recovery */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[220px]">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-emerald-100">{progress.attendance_label}</span>
            <span className="text-sm font-bold text-white">{progress.attendance_percentage}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 mb-2">
            <div
              className="bg-emerald-300 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.attendance_percentage}%` }}
            />
          </div>
          <p className="text-[11px] text-emerald-200">
            {progress.completed_sessions} of {progress.total_sessions} therapy sessions attended
          </p>
          <p className="text-[10px] text-white/60 italic mt-1">
            * Measures attendance percentage, not clinical recovery
          </p>
        </div>
      </div>

      {/* Main Grid: Plan & Guidelines */}
      {active_plan ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Details */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{active_plan.title}</h2>
                <p className="text-xs text-gray-500">
                  Target: {active_plan.objectives || 'Holistic Panchakarma Detoxification'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${api.defaults.baseURL}/consultations/treatment-plans/${active_plan.id}/summary/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  <Download size={13} />
                  Course Summary PDF
                </a>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Active Protocol
                </span>
              </div>
            </div>

            {/* Prescribed Items */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Prescribed Therapies
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active_plan.items.map((item: any) => (
                  <div key={item.id} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.therapy_name}</p>
                      <p className="text-xs text-gray-500">{item.duration_minutes} minutes per session</p>
                    </div>
                    <span className="px-2.5 py-1 bg-white rounded-lg text-xs font-bold text-emerald-700 shadow-sm border border-gray-100">
                      {item.session_count} Sessions
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Diet & Lifestyle Guidelines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100/60">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-1">
                  <Utensils size={14} />
                  <span>Diet Recommendations (Pathya)</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {active_plan.diet_recommendations || 'Light, freshly cooked meals with ghee. Avoid raw cold foods.'}
                </p>
              </div>

              <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100/60">
                <div className="flex items-center gap-2 text-purple-800 font-semibold text-xs mb-1">
                  <Moon size={14} />
                  <span>Lifestyle Recommendations (Vihara)</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {active_plan.lifestyle_recommendations || 'Gentle walking, avoid day sleep and cold exposure.'}
                </p>
              </div>
            </div>
          </div>

          {/* Billing & Package Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                <FileText size={18} />
                <h3 className="font-bold text-gray-800">Package & Billing</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Transparent customized pricing for your therapy cycle</p>

              {packages.length > 0 ? (
                <div className="space-y-3">
                  {packages.map((pkg: any) => (
                    <div key={pkg.id} className="p-4 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                      <p className="text-sm font-bold text-gray-800">{pkg.name}</p>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Total Package:</span>
                        <span className="font-semibold text-gray-800">₹{pkg.custom_price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-emerald-700">
                        <span>Amount Paid:</span>
                        <span className="font-semibold">₹{pkg.amount_paid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-red-600 border-t border-gray-200/60 pt-1.5 font-bold">
                        <span>Balance Due:</span>
                        <span>₹{pkg.balance_due.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No package assigned yet.</p>
              )}
            </div>

            {/* Receipts list */}
            {payments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-2">Payment Receipts</p>
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1.5">
                    <span className="text-gray-500">{p.receipt_number || 'Receipt'}</span>
                    <a
                      href={`http://localhost:8000/api/v1/billing/receipts/${p.receipt_number}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
                    >
                      <Download size={12} />
                      View Slip
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          Your doctor is currently reviewing your assessment to generate your personalized treatment plan.
        </div>
      )}

      {/* Therapy Timeline & Sessions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">My Therapy Schedule & Timeline</h2>
            <p className="text-xs text-gray-500">Track your daily Panchakarma appointments, therapists, and feedback</p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Calendar className="mx-auto text-gray-300 mb-2" size={32} />
            <p className="text-sm font-semibold text-gray-600">No sessions scheduled yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Sessions will appear here once allocated by clinic reception.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((s: any) => {
              const isCompleted = s.status === 'completed'
              const isScheduled = s.status === 'scheduled' || s.status === 'checked_in'
              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isCompleted
                      ? 'bg-emerald-50/30 border-emerald-100'
                      : s.status === 'checked_in'
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      #{s.session_number}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{s.therapy_name}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-gray-700">
                          <Calendar size={13} className="text-gray-400" />
                          {new Date(s.scheduled_start).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-gray-400" />
                          {new Date(s.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(s.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>Room: <strong className="text-gray-700">{s.room_name}</strong></span>
                        <span>Therapist: <strong className="text-gray-700">{s.therapist_name}</strong></span>
                      </div>

                      {s.observations && (
                        <p className="text-xs text-gray-500 mt-2 bg-white/80 p-2 rounded-lg border border-gray-100">
                          <strong>Therapist Notes:</strong> {s.observations}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {isCompleted && (
                      <button
                        onClick={() => {
                          setActiveSessionId(s.id)
                          setFeedbackModalOpen(true)
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-sm transition"
                      >
                        <MessageSquare size={13} />
                        {s.feedback ? 'Update Feedback' : 'Give Feedback'}
                      </button>
                    )}

                    {isScheduled && (
                      <button
                        onClick={() => {
                          setActiveSessionId(s.id)
                          setRescheduleModalOpen(true)
                        }}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold transition"
                      >
                        Request Reschedule
                      </button>
                    )}

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'checked_in'
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setRescheduleModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Request Reschedule</h3>
            <p className="text-xs text-gray-500 mb-4">
              Submit your preferred date. Our clinic coordinator will adjust the schedule without conflict.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!activeSessionId) return
                rescheduleMutation.mutate({ sessionId: activeSessionId, body: rescheduleForm })
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleForm.preferred_date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, preferred_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Reschedule *</label>
                <textarea
                  required
                  rows={3}
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                  placeholder="e.g. Travel commitments, feeling unwell, or office meeting"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-medium transition"
                >
                  {rescheduleMutation.isPending ? 'Sending...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setFeedbackModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Session Experience & Feedback</h3>
            <p className="text-xs text-gray-500 mb-4">
              Your feedback helps your therapist and doctor optimize your treatment.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!activeSessionId) return
                feedbackMutation.mutate({ sessionId: activeSessionId, body: feedbackForm })
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">How did you feel during and after the session? *</label>
                <textarea
                  required
                  rows={3}
                  value={feedbackForm.feedback}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                  placeholder="e.g. Great relaxation, pressure was good, or experienced mild tenderness"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-red-800">
                  <input
                    type="checkbox"
                    checked={feedbackForm.flag_doctor}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, flag_doctor: e.target.checked })}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Flag this feedback for Doctor's urgent attention</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={feedbackMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
                >
                  {feedbackMutation.isPending ? 'Submitting...' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
