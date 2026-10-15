import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Stethoscope, Sparkles, FileText, Download, X, Activity } from 'lucide-react'

interface Consultation {
  id: string
  patient_id: string
  patient_name: string
  doctor_id: string
  doctor_name: string
  consultation_type: string
  scheduled_at: string
  notes?: string
  chief_complaint?: string
  prakriti?: string
  vikriti?: string
  consultation_fee: number
  fee_paid: boolean
  has_treatment_plan: boolean
  treatment_plan_id?: string
}

export default function Consultations() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'list' | 'plan'>('list')
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  
  // Summary modal state
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [selectedSummaryPlanId, setSelectedSummaryPlanId] = useState<string | null>(null)

  // Plan form state
  const [planForm, setPlanForm] = useState({
    title: 'Panchakarma Detox & Rejuvenation Plan',
    objectives: 'Alleviate joint stiffness and restore Vata balance',
    diet_recommendations: 'Warm, lightly spiced khichdi, avoid cold dry foods',
    lifestyle_recommendations: 'Abhyanga self-massage, early sleep by 10 PM',
    start_date: new Date().toISOString().split('T')[0],
    therapy_id: '',
    session_count: 5,
    duration_minutes: 60,
  })

  // Package creation modal
  const [pkgModalOpen, setPkgModalOpen] = useState(false)
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null)
  const [pkgForm, setPkgForm] = useState({
    name: 'Complete Panchakarma Package',
    custom_price: 6500,
    valid_from: new Date().toISOString().split('T')[0],
  })

  // Queries
  const { data: consultations = [], isLoading } = useQuery<Consultation[]>({
    queryKey: ['consultations'],
    queryFn: async () => {
      const res = await api.get('/consultations/')
      return res.data
    },
  })

  const { data: therapies = [] } = useQuery({
    queryKey: ['therapies'],
    queryFn: async () => {
      const res = await api.get('/therapies/')
      return res.data
    },
  })

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['treatment-summary', selectedSummaryPlanId],
    queryFn: async () => {
      if (!selectedSummaryPlanId) return null
      const res = await api.get(`/consultations/treatment-plans/${selectedSummaryPlanId}/summary`)
      return res.data
    },
    enabled: !!selectedSummaryPlanId,
  })

  // Create treatment plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async ({ consultationId, payload }: any) => {
      const res = await api.post(`/consultations/${consultationId}/treatment-plan`, {
        title: payload.title,
        objectives: payload.objectives,
        diet_recommendations: payload.diet_recommendations,
        lifestyle_recommendations: payload.lifestyle_recommendations,
        start_date: payload.start_date,
        items: [
          {
            therapy_id: payload.therapy_id,
            session_count: payload.session_count,
            duration_minutes: payload.duration_minutes,
          },
        ],
      })
      // Immediately finalize plan for scheduling
      await api.post(`/consultations/treatment-plans/${res.data.id}/finalize`)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      setCreatedPlanId(data.id)
      setPkgModalOpen(true)
    },
  })

  // Create custom package mutation
  const createPackageMutation = useMutation({
    mutationFn: async ({ planId, form }: any) => {
      const res = await api.post('/billing/packages', {
        treatment_plan_id: planId,
        name: form.name,
        custom_price: form.custom_price,
        valid_from: form.valid_from,
      })
      return res.data
    },
    onSuccess: () => {
      setPkgModalOpen(false)
      setActiveTab('list')
      alert('Treatment Plan & Custom-Priced Package created successfully!')
    },
  })

  // Allocate sessions mutation (Differentiator demo)
  const allocateMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post('/scheduling/allocate', {
        treatment_plan_id: planId,
        preferred_start_date: new Date().toISOString().split('T')[0],
      })
      return res.data
    },
    onSuccess: (data) => {
      alert(`Automated Scheduler Allocated ${data.sessions.length} sessions without conflict!`)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Doctor Consultations & Plans</h1>
          <p className="text-sm text-gray-500">Record clinical assessment, prescribe treatment plans & packages</p>
        </div>
      </div>

      {activeTab === 'list' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading consultations...</div>
          ) : consultations.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Stethoscope className="mx-auto text-gray-300 mb-2" size={32} />
              <p className="font-semibold text-gray-700">No active consultations recorded</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Doctor</th>
                    <th className="py-3 px-4">Scheduled</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consultations.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3 px-4 font-semibold text-gray-800">{c.patient_name}</td>
                      <td className="py-3 px-4 text-gray-600">{c.doctor_name}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(c.scheduled_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {c.has_treatment_plan ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            Plan Created
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Pending Plan
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.has_treatment_plan && c.treatment_plan_id ? (
                          <button
                            onClick={() => {
                              setSelectedSummaryPlanId(c.treatment_plan_id || null)
                              setSummaryModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition"
                          >
                            <FileText size={14} />
                            Summary Report
                          </button>
                        ) : !c.has_treatment_plan ? (
                          <button
                            onClick={() => {
                              setSelectedConsultation(c)
                              if (therapies.length > 0) {
                                setPlanForm((prev) => ({ ...prev, therapy_id: therapies[0].id }))
                              }
                              setActiveTab('plan')
                            }}
                            className="px-3 py-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-xs font-medium transition"
                          >
                            Create Plan
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Create Treatment Plan Form */
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-2xl">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-800">New Treatment Plan</h2>
              <p className="text-xs text-gray-500">
                Patient: <span className="font-semibold text-gray-700">{selectedConsultation?.patient_name}</span>
              </p>
            </div>
            <button
              onClick={() => setActiveTab('list')}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Back to list
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!selectedConsultation) return
              createPlanMutation.mutate({
                consultationId: selectedConsultation.id,
                payload: planForm,
              })
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan Title</label>
              <input
                type="text"
                required
                value={planForm.title}
                onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prescribed Therapy</label>
                <select
                  required
                  value={planForm.therapy_id}
                  onChange={(e) => setPlanForm({ ...planForm, therapy_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                >
                  <option value="">Select Therapy</option>
                  {therapies.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.default_duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Session Count</label>
                <input
                  type="number"
                  min={1}
                  max={21}
                  required
                  value={planForm.session_count}
                  onChange={(e) => setPlanForm({ ...planForm, session_count: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Diet Recommendations (Pathya)</label>
              <textarea
                rows={2}
                value={planForm.diet_recommendations}
                onChange={(e) => setPlanForm({ ...planForm, diet_recommendations: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPlanMutation.isPending}
                className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-medium transition"
              >
                {createPlanMutation.isPending ? 'Finalizing...' : 'Finalize & Set Package Price'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Package Creation Modal */}
      {pkgModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Set Custom Package Price</h2>
            <p className="text-xs text-gray-500 mb-4">
              Key Differentiator: customize package price for this patient based on therapy default
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createPackageMutation.mutate({ planId: createdPlanId, form: pkgForm })
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Package Name</label>
                <input
                  type="text"
                  required
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Custom Package Price (₹) *</label>
                <input
                  type="number"
                  required
                  value={pkgForm.custom_price}
                  onChange={(e) => setPkgForm({ ...pkgForm, custom_price: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-between gap-2">
                {createdPlanId && (
                  <button
                    type="button"
                    onClick={() => allocateMutation.mutate(createdPlanId)}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Sparkles size={14} />
                    Run Auto-Scheduler
                  </button>
                )}
                <button
                  type="submit"
                  disabled={createPackageMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-medium transition"
                >
                  Save Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clinical Treatment Summary & Discharge Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto border border-gray-100">
            <button
              onClick={() => {
                setSummaryModalOpen(false)
                setSelectedSummaryPlanId(null)
              }}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={20} />
            </button>

            {summaryLoading || !summaryData ? (
              <div className="py-20 text-center text-gray-400">
                <Activity className="mx-auto mb-2 animate-pulse text-[var(--color-brand)]" size={32} />
                Loading comprehensive clinical summary...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2 text-[var(--color-brand)] mb-1">
                    <FileText size={22} />
                    <h2 className="text-xl font-bold text-gray-900">
                      Panchakarma Treatment Summary & Discharge Report
                    </h2>
                  </div>
                  <p className="text-xs text-gray-500">
                    Official clinical record of therapeutic execution, session attendance, and post-care protocol.
                  </p>
                </div>

                {/* Patient & Doctor Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
                  <div>
                    <h3 className="font-bold text-gray-700 uppercase tracking-wider mb-2 text-[10px]">
                      Patient Details
                    </h3>
                    <p className="font-semibold text-gray-900 text-sm mb-1">{summaryData.patient.name}</p>
                    <p className="text-gray-600">UHID: <span className="font-mono">{summaryData.patient.uhid}</span></p>
                    <p className="text-gray-600">Contact: {summaryData.patient.phone}</p>
                    <p className="text-gray-600">Gender: <span className="capitalize">{summaryData.patient.gender}</span></p>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-700 uppercase tracking-wider mb-2 text-[10px]">
                      Ayurvedic Assessment
                    </h3>
                    <p className="font-semibold text-gray-900 mb-1">{summaryData.doctor.name}</p>
                    <div className="flex gap-2 my-1">
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded font-semibold text-[11px] border border-teal-200">
                        Prakriti: {summaryData.clinical_assessment.prakriti || 'Pitta-Kapha'}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-semibold text-[11px] border border-amber-200">
                        Vikriti: {summaryData.clinical_assessment.vikriti || 'Vata'}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">
                      <strong>Complaint:</strong> {summaryData.clinical_assessment.chief_complaint || 'General Fatigue & Stiffness'}
                    </p>
                  </div>
                </div>

                {/* Compliance Attendance Banner */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                      Session Attendance Rate
                    </span>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Completed {summaryData.attendance.completed_sessions} of {summaryData.attendance.total_planned_sessions} therapeutic sessions.
                    </p>
                    <p className="text-[10px] text-emerald-600 italic mt-1">
                      * {summaryData.attendance.compliance_notice}
                    </p>
                  </div>
                  <div className="text-2xl font-black text-emerald-800 bg-white px-4 py-2 rounded-xl shadow-xs border border-emerald-100">
                    {summaryData.attendance.session_attendance_percentage}%
                  </div>
                </div>

                {/* Prescribed Therapy Regimen */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Prescribed Therapy Protocol: {summaryData.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {summaryData.prescriptions.map((rx: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs">
                        <span className="font-semibold text-gray-800">{rx.therapy_name}</span>
                        <div className="text-gray-500 text-[11px] mt-0.5">
                          {rx.session_count} Sessions • {rx.duration_minutes} mins duration
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session Records Table */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Therapeutic Session Log
                  </h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                        <tr>
                          <th className="p-2.5">Session</th>
                          <th className="p-2.5">Date & Time</th>
                          <th className="p-2.5">Therapist</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Observations / Oils</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summaryData.sessions.map((s: any) => (
                          <tr key={s.session_id} className="hover:bg-gray-50/50">
                            <td className="p-2.5 font-medium text-gray-800">
                              #{s.session_number} {s.therapy_name}
                            </td>
                            <td className="p-2.5 text-gray-500">
                              {s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="p-2.5 text-gray-600">{s.therapist_name}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                  s.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-gray-600 max-w-xs truncate">
                              {s.observations || s.oils_used || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dietary & Lifestyle Instructions */}
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 text-xs space-y-2">
                  <h4 className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                    Discharge Care Instructions (Pathya & Vihara)
                  </h4>
                  <p className="text-gray-700">
                    <strong>Pathya (Diet):</strong>{' '}
                    {summaryData.diet_recommendations || 'Warm, freshly prepared meals. Avoid chilled items.'}
                  </p>
                  <p className="text-gray-700">
                    <strong>Vihara (Lifestyle):</strong>{' '}
                    {summaryData.lifestyle_recommendations || 'Early rest before 10 PM. Avoid strenuous exercise.'}
                  </p>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setSummaryModalOpen(false)
                      setSelectedSummaryPlanId(null)
                    }}
                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                  <a
                    href={`${api.defaults.baseURL}/consultations/treatment-plans/${selectedSummaryPlanId}/summary/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
                  >
                    <Download size={15} />
                    Download Official PDF
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
