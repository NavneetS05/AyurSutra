import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { downloadPdf } from '@/lib/download'
import {
  Stethoscope,
  Sparkles,
  FileText,
  Download,
  X,
  Activity,
  CalendarPlus,
  Banknote,
  QrCode,
  CreditCard,
  CheckCircle2,
  Flame,
  Leaf,
  Plus,
  Trash2,
  Layers,
} from 'lucide-react'

interface PlanItemState {
  therapy_id: string
  session_count: number
  duration_minutes: number
  notes?: string
}

interface Consultation {
  id: string
  patient_id: string
  patient_name: string
  patient_number?: string
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
  })

  // Multi-therapy plan items
  const [planItems, setPlanItems] = useState<PlanItemState[]>([])

  const applyProtocolPreset = (presetKey: string) => {
    const findThId = (nameQuery: string) => {
      const match = therapies.find((t: any) =>
        t.name.toLowerCase().includes(nameQuery.toLowerCase())
      )
      return match ? match.id : therapies[0]?.id || ''
    }

    if (presetKey === 'shodhana_14') {
      setPlanForm((prev) => ({
        ...prev,
        title: '14-Day Classical Shodhana Panchakarma Protocol',
        objectives: 'Complete biological purification (Snehana -> Swedana -> Virechana -> Samsarjana Krama -> Rasayana)',
        diet_recommendations: 'Strict Samsarjana Krama: Peya (thin rice gruel), Vilepi, Akrita Yusha, Krita Yusha. Luke-warm water only.',
        lifestyle_recommendations: 'Total physical and sensory rest. Avoid air conditioners, direct sunlight, mental exertion, and daytime sleep.',
      }))
      setPlanItems([
        { therapy_id: findThId('Snehapana'), session_count: 3, duration_minutes: 45, notes: 'Poorva Karma: Progressive internal oleation with medicated ghrita' },
        { therapy_id: findThId('Sarvanga Abhyanga'), session_count: 5, duration_minutes: 60, notes: 'Poorva Karma: Full body warm oil massage' },
        { therapy_id: findThId('Bashpa Sweda'), session_count: 5, duration_minutes: 30, notes: 'Poorva Karma: Medicated herbal steam bath' },
        { therapy_id: findThId('Virechana'), session_count: 1, duration_minutes: 180, notes: 'Pradhana Karma: Controlled therapeutic purgation' },
        { therapy_id: findThId('Samsarjana'), session_count: 3, duration_minutes: 30, notes: 'Paschat Karma: Graduated diet progression & Agni restoration' },
        { therapy_id: findThId('Rasayana'), session_count: 2, duration_minutes: 45, notes: 'Paschat Karma: Tissue rejuvenation & immunity building' },
      ])
    } else if (presetKey === 'kala_basti_8') {
      setPlanForm((prev) => ({
        ...prev,
        title: '8-Day Classical Kala Basti Regimen (Vata Shodhana)',
        objectives: 'Alleviate deep-seated Vata disorders, neurological rehabilitation, and joint nourishment.',
        diet_recommendations: 'Light warm soups, steamed vegetables with cow ghee, warm spiced milk at bedtime.',
        lifestyle_recommendations: 'Keep lower back and feet warm. Gentle walking only, no strenuous exertion.',
      }))
      setPlanItems([
        { therapy_id: findThId('Sarvanga Abhyanga'), session_count: 8, duration_minutes: 60, notes: 'Pre-Basti snehana massage' },
        { therapy_id: findThId('Anuvasana'), session_count: 5, duration_minutes: 45, notes: 'Medicated oil enema for Vata lubrication' },
        { therapy_id: findThId('Niruha'), session_count: 3, duration_minutes: 75, notes: 'Medicated herbal decoction enema' },
      ])
    } else if (presetKey === 'sandhi_spine_7') {
      setPlanForm((prev) => ({
        ...prev,
        title: '7-Day Spine & Joint Intensive Care Protocol',
        objectives: 'Relieve lumbar / cervical disc compression, knee joint friction, and musculoskeletal pain.',
        diet_recommendations: 'Anti-inflammatory diet: Turmeric milk, ginger soup, avoid fermentable and cold foods.',
        lifestyle_recommendations: 'Avoid heavy lifting, use firm orthopedic mattress, apply warm sesame oil locally.',
      }))
      setPlanItems([
        { therapy_id: findThId('Kati Basti'), session_count: 7, duration_minutes: 45, notes: 'Lumbosacral warm oil retention' },
        { therapy_id: findThId('Patra Pinda Sweda'), session_count: 7, duration_minutes: 60, notes: 'Herbal leaf bolus fomentation' },
        { therapy_id: findThId('Janu Basti'), session_count: 5, duration_minutes: 45, notes: 'Knee joint oil pool' },
      ])
    } else if (presetKey === 'manasa_shanti_7') {
      setPlanForm((prev) => ({
        ...prev,
        title: '7-Day Manasa Shanti & Shirodhara Stress Relief',
        objectives: 'Calm Manovaha Srotas (mind channels), relieve chronic insomnia, anxiety, and mental burnout.',
        diet_recommendations: 'Sattvic diet: Fresh fruits, almonds, warm milk with nutmeg, chamomile or brahmi tea.',
        lifestyle_recommendations: 'Digital detox after 8 PM, meditation, pranayama (Anulom-Vilom), early sleep.',
      }))
      setPlanItems([
        { therapy_id: findThId('Sarvanga Abhyanga'), session_count: 7, duration_minutes: 60, notes: 'Nervous system soothing massage' },
        { therapy_id: findThId('Shirodhara'), session_count: 7, duration_minutes: 45, notes: 'Continuous rhythmic warm oil stream on forehead' },
        { therapy_id: findThId('Nasya'), session_count: 5, duration_minutes: 45, notes: 'Nasal administration for head & sensory clearing' },
      ])
    }
  }

  // Package creation modal
  const [pkgModalOpen, setPkgModalOpen] = useState(false)
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null)
  const [pkgForm, setPkgForm] = useState({
    name: 'Complete Panchakarma Package',
    custom_price: 6500,
    valid_from: new Date().toISOString().split('T')[0],
  })

  // Book appointment modal state (Receptionist & Front Desk)
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookForm, setBookForm] = useState({
    patient_id: '',
    doctor_id: '',
    scheduled_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    consultation_type: 'initial',
    consultation_fee: 500,
    chief_complaint: '',
    collect_payment: true,
    payment_method: 'cash',
  })

  // Queries
  const { data: consultations = [], isLoading } = useQuery<Consultation[]>({
    queryKey: ['consultations'],
    queryFn: async () => {
      const res = await api.get('/consultations/')
      return res.data
    },
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await api.get('/patients/')
      return res.data
    },
  })

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get('/staff/')
      return res.data
    },
  })
  const doctors = staffList.filter((s: any) => s.is_doctor)

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

  // Book Appointment mutation
  const bookAppointmentMutation = useMutation({
    mutationFn: async (payload: typeof bookForm) => {
      const res = await api.post('/consultations/', {
        patient_id: payload.patient_id,
        doctor_id: payload.doctor_id,
        scheduled_at: new Date(payload.scheduled_at).toISOString(),
        consultation_type: payload.consultation_type,
        consultation_fee: payload.consultation_fee,
        chief_complaint: payload.chief_complaint || undefined,
        collect_payment: payload.collect_payment,
        payment_method: payload.payment_method,
      })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      setBookModalOpen(false)
      setBookForm({
        patient_id: '',
        doctor_id: '',
        scheduled_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
        consultation_type: 'initial',
        consultation_fee: 500,
        chief_complaint: '',
        collect_payment: true,
        payment_method: 'cash',
      })
      alert(`Appointment booked successfully! ${data.fee_paid ? 'Cash payment collected & receipt generated.' : ''}`)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to book appointment')
    },
  })

  // Quick Collect Cash mutation
  const collectCashMutation = useMutation({
    mutationFn: async (c: Consultation) => {
      const res = await api.post('/billing/payments', {
        patient_id: c.patient_id,
        consultation_id: c.id,
        amount: c.consultation_fee,
        method: 'cash',
        notes: 'Front Desk Counter Cash collection for consultation',
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      alert('Cash payment collected successfully! Receipt generated.')
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to collect payment')
    },
  })

  // Create treatment plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async ({ consultationId, payload }: any) => {
      const itemsPayload = (planItems.length > 0 ? planItems : [
        { therapy_id: therapies[0]?.id || '', session_count: 5, duration_minutes: 60, notes: '' }
      ]).map((it: PlanItemState) => ({
        therapy_id: it.therapy_id,
        session_count: Number(it.session_count),
        duration_minutes: Number(it.duration_minutes),
        notes: it.notes || undefined,
      }))

      const res = await api.post(`/consultations/${consultationId}/treatment-plan`, {
        title: payload.title,
        objectives: payload.objectives,
        diet_recommendations: payload.diet_recommendations,
        lifestyle_recommendations: payload.lifestyle_recommendations,
        start_date: payload.start_date,
        items: itemsPayload,
      })
      // Immediately finalize plan for scheduling
      await api.post(`/consultations/treatment-plans/${res.data.id}/finalize`)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      setCreatedPlanId(data.id)
      // Auto compute estimated package price from items
      const estTotal = planItems.reduce((acc, it) => {
        const th = therapies.find((t: any) => t.id === it.therapy_id)
        const unit = Number(th?.suggested_price || 1200)
        return acc + unit * it.session_count
      }, 0)
      setPkgForm({
        name: `${planForm.title} Package`,
        custom_price: estTotal > 0 ? estTotal : 6500,
        valid_from: new Date().toISOString().split('T')[0],
      })
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
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      setPkgModalOpen(false)
      setActiveTab('list')
      alert('Treatment Plan & Custom-Priced Package created successfully!')
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to create package')
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
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      alert(`Automated Scheduler Allocated ${data.sessions?.length || 0} sessions without conflict!`)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to allocate sessions via Auto-Scheduler')
    },
  })

  const [isProcessingAll, setIsProcessingAll] = useState(false)

  const handleSaveAndScheduleAll = async () => {
    if (!createdPlanId) return
    setIsProcessingAll(true)
    try {
      // 1. Create Package
      await createPackageMutation.mutateAsync({ planId: createdPlanId, form: pkgForm })
      // 2. Run Auto Scheduler
      const allocData = await allocateMutation.mutateAsync(createdPlanId)
      setPkgModalOpen(false)
      setActiveTab('list')
      alert(`Success! Package saved and ${allocData.sessions?.length || 0} therapy sessions scheduled automatically!`)
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error finalizing package and schedule')
    } finally {
      setIsProcessingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Doctor Consultations & Plans</h1>
          <p className="text-sm text-gray-500">Record clinical assessment, book appointments, prescribe treatment plans & packages</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBookModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-sm font-semibold shadow-sm transition"
          >
            <CalendarPlus size={16} />
            Book Patient Appointment
          </button>
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
              <button
                onClick={() => setBookModalOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition"
              >
                <CalendarPlus size={14} />
                Book First Consultation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Doctor</th>
                    <th className="py-3 px-4">Scheduled</th>
                    <th className="py-3 px-4">Fee & Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consultations.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{c.patient_name}</span>
                          {c.patient_number && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {c.patient_number}
                            </span>
                          )}
                        </div>
                        {c.chief_complaint && (
                          <div className="text-[11px] text-gray-400 truncate max-w-xs">{c.chief_complaint}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{c.doctor_name}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(c.scheduled_at).toLocaleDateString()} {new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        {c.fee_paid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            ₹{c.consultation_fee} Paid (Cash)
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              ₹{c.consultation_fee} Unpaid
                            </span>
                            <button
                              onClick={() => collectCashMutation.mutate(c)}
                              disabled={collectCashMutation.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-xs transition"
                            >
                              <Banknote size={13} />
                              Collect Cash
                            </button>
                          </div>
                        )}
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
                              if (planItems.length === 0 && therapies.length > 0) {
                                setPlanItems([
                                  {
                                    therapy_id: therapies[0].id,
                                    session_count: 5,
                                    duration_minutes: therapies[0].default_duration_minutes || 60,
                                    notes: 'Primary treatment procedure',
                                  },
                                ])
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
        /* Create Classical Panchakarma Treatment Plan Form */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/80 max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="text-rose-600" size={22} />
                <h2 className="text-xl font-bold text-gray-900">Prescribe Panchakarma Treatment Plan</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Patient: <strong className="text-gray-800">{selectedConsultation?.patient_name}</strong>
                {selectedConsultation?.prakriti && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-semibold text-[11px] border border-amber-200">
                    Prakriti: {selectedConsultation.prakriti}
                  </span>
                )}
                {selectedConsultation?.vikriti && (
                  <span className="ml-1.5 px-2 py-0.5 bg-rose-50 text-rose-800 rounded-md font-semibold text-[11px] border border-rose-200">
                    Vikriti: {selectedConsultation.vikriti}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('list')}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Back to list
            </button>
          </div>

          {/* ONE-CLICK CLASSICAL PANCHAKARMA PROTOCOLS */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-2xl border border-emerald-200/80">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-emerald-700" />
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Load Classical Panchakarma Protocol Presets
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 mb-3">
              One-click multi-stage regimens automatically combining Poorva Karma (Preparation), Pradhana Karma (Detox), and Paschat Karma (Restoration).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyProtocolPreset('shodhana_14')}
                className="p-3 text-left bg-white hover:bg-emerald-100/60 rounded-xl border border-emerald-200/90 shadow-2xs transition group"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 group-hover:text-emerald-700 mb-1">
                  <Flame size={14} className="text-rose-600 shrink-0" />
                  14-Day Shodhana
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-2">
                  Snehapana, Abhyanga, Swedana, Virechana & Samsarjana diet.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyProtocolPreset('kala_basti_8')}
                className="p-3 text-left bg-white hover:bg-emerald-100/60 rounded-xl border border-emerald-200/90 shadow-2xs transition group"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 group-hover:text-emerald-700 mb-1">
                  <Activity size={14} className="text-purple-600 shrink-0" />
                  8-Day Kala Basti
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-2">
                  Vata Shodhana (Ardha Chikitsa) with Anuvasana & Niruha bastis.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyProtocolPreset('sandhi_spine_7')}
                className="p-3 text-left bg-white hover:bg-emerald-100/60 rounded-xl border border-emerald-200/90 shadow-2xs transition group"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 group-hover:text-emerald-700 mb-1">
                  <Layers size={14} className="text-amber-600 shrink-0" />
                  7-Day Spine & Joint
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-2">
                  Kati Basti, Patra Pinda Sweda (Elakizhi) & Janu Basti.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyProtocolPreset('manasa_shanti_7')}
                className="p-3 text-left bg-white hover:bg-emerald-100/60 rounded-xl border border-emerald-200/90 shadow-2xs transition group"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 group-hover:text-emerald-700 mb-1">
                  <Leaf size={14} className="text-emerald-600 shrink-0" />
                  7-Day Manasa Shanti
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-2">
                  Sarvanga Abhyanga, Shirodhara oil stream & Nasya karma.
                </p>
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!selectedConsultation) return
              if (planItems.length === 0) {
                alert('Please add at least one Panchakarma procedure to the treatment plan.')
                return
              }
              createPlanMutation.mutate({
                consultationId: selectedConsultation.id,
                payload: planForm,
              })
            }}
            className="space-y-5"
          >
            {/* Title & Start Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Title *</label>
                <input
                  type="text"
                  required
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Protocol Start Date *</label>
                <input
                  type="date"
                  required
                  value={planForm.start_date}
                  onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>
            </div>

            {/* Clinical Objectives */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Objectives & Pathogenesis (Samprapti)</label>
              <input
                type="text"
                value={planForm.objectives}
                onChange={(e) => setPlanForm({ ...planForm, objectives: e.target.value })}
                placeholder="e.g. Pacify vitiated Vata-Pitta, eliminate localized Ama, restore joint lubrication"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
              />
            </div>

            {/* PRESCRIBED PANCHAKARMA PROCEDURES (MULTI-STAGE) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="text-[var(--color-brand)]" size={17} />
                  <h3 className="font-bold text-gray-900 text-sm">Prescribed Procedures & Clinical Karmas</h3>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">
                    {planItems.length} {planItems.length === 1 ? 'Procedure' : 'Procedures'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const defaultTh = therapies[0]?.id || ''
                    setPlanItems([
                      ...planItems,
                      { therapy_id: defaultTh, session_count: 5, duration_minutes: 60, notes: '' },
                    ])
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition"
                >
                  <Plus size={14} />
                  Add Procedure
                </button>
              </div>

              {planItems.map((item, index) => {
                const selectedTh = therapies.find((t: any) => t.id === item.therapy_id)
                return (
                  <div
                    key={index}
                    className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between transition hover:border-gray-300"
                  >
                    {/* Index & Selector */}
                    <div className="flex-1 w-full md:w-auto">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-[var(--color-brand)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <label className="text-xs font-semibold text-gray-700">Panchakarma Procedure</label>
                        {selectedTh?.category && (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-white border capitalize text-gray-600">
                            {selectedTh.category.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <select
                        required
                        value={item.therapy_id}
                        onChange={(e) => {
                          const newTh = therapies.find((t: any) => t.id === e.target.value)
                          const updated = [...planItems]
                          updated[index] = {
                            ...updated[index],
                            therapy_id: e.target.value,
                            duration_minutes: newTh?.default_duration_minutes || 60,
                          }
                          setPlanItems(updated)
                        }}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                      >
                        {therapies.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.name} — ₹{t.suggested_price || 0} ({t.default_duration_minutes} min)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sessions & Duration */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="w-24">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sessions</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          required
                          value={item.session_count}
                          onChange={(e) => {
                            const updated = [...planItems]
                            updated[index] = { ...updated[index], session_count: Number(e.target.value) }
                            setPlanItems(updated)
                          }}
                          className="w-full border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs bg-white text-center font-bold focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                        />
                      </div>

                      <div className="w-24">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mins/Sess</label>
                        <input
                          type="number"
                          min={15}
                          max={240}
                          required
                          value={item.duration_minutes}
                          onChange={(e) => {
                            const updated = [...planItems]
                            updated[index] = { ...updated[index], duration_minutes: Number(e.target.value) }
                            setPlanItems(updated)
                          }}
                          className="w-full border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs bg-white text-center font-bold focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Stage / Clinical Notes */}
                    <div className="w-full md:w-64">
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Stage / Specific Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Poorva Karma, use Bala taila"
                        value={item.notes || ''}
                        onChange={(e) => {
                          const updated = [...planItems]
                          updated[index] = { ...updated[index], notes: e.target.value }
                          setPlanItems(updated)
                        }}
                        className="w-full border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                      />
                    </div>

                    {/* Delete item button */}
                    {planItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPlanItems(planItems.filter((_, i) => i !== index))
                        }}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition md:mt-5"
                        title="Remove procedure"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Protocol Summary Calculation Strip */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-emerald-950 gap-2">
                <div className="flex items-center gap-4">
                  <span>
                    Total Prescribed Procedures: <strong>{planItems.length}</strong>
                  </span>
                  <span>
                    Total Clinical Sessions:{' '}
                    <strong>{planItems.reduce((acc, it) => acc + (Number(it.session_count) || 0), 0)}</strong>
                  </span>
                </div>
                <div>
                  Calculated Treatment Package Value:{' '}
                  <strong className="text-emerald-800 text-sm">
                    ₹
                    {planItems.reduce((acc, it) => {
                      const th = therapies.find((t: any) => t.id === it.therapy_id)
                      const unit = Number(th?.suggested_price || 1200)
                      return acc + unit * (Number(it.session_count) || 0)
                    }, 0)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Diet (Pathya / Apathya) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Dietary Regimen (Pathya & Apathya / Samsarjana Krama)
              </label>
              <textarea
                rows={2}
                value={planForm.diet_recommendations}
                onChange={(e) => setPlanForm({ ...planForm, diet_recommendations: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                placeholder="Prescribe graduated liquid-to-solid diet (Peya, Vilepi, Yusha), warm water, foods to avoid..."
              />
            </div>

            {/* Lifestyle */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lifestyle & Rest Protocol (Vihara)
              </label>
              <textarea
                rows={2}
                value={planForm.lifestyle_recommendations}
                onChange={(e) => setPlanForm({ ...planForm, lifestyle_recommendations: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                placeholder="Rest guidelines, avoiding cold exposure, sensory withdrawal, meditation..."
              />
            </div>

            {/* Actions */}
            <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPlanMutation.isPending}
                className="px-5 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                {createPlanMutation.isPending ? 'Finalizing Plan...' : 'Finalize Multi-Stage Plan & Set Package'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Package Creation & Scheduling Modal */}
      {pkgModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => {
                setPkgModalOpen(false)
                setActiveTab('list')
              }}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600 transition"
              title="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1 text-[var(--color-brand)]">
              <Sparkles size={20} />
              <h2 className="text-lg font-bold text-gray-900">Finalize Treatment Package & Schedule</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Set the customized commercial package pricing and allocate automated clinical appointments for this patient.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createPackageMutation.mutate({ planId: createdPlanId, form: pkgForm })
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Package Name</label>
                <input
                  type="text"
                  required
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Custom Package Price (₹) *</label>
                <input
                  type="number"
                  required
                  value={pkgForm.custom_price}
                  onChange={(e) => setPkgForm({ ...pkgForm, custom_price: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Auto-calculated from procedure defaults; you can adjust this price per patient.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                {/* 1. Primary One-Click Action: Save Package AND Run Auto-Scheduler */}
                {createdPlanId && (
                  <button
                    type="button"
                    disabled={isProcessingAll || createPackageMutation.isPending || allocateMutation.isPending}
                    onClick={handleSaveAndScheduleAll}
                    className="w-full py-2.5 px-4 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles size={15} />
                    {isProcessingAll
                      ? 'Saving Package & Scheduling Sessions...'
                      : 'Save Package & Auto-Schedule All Sessions'}
                  </button>
                )}

                {/* 2. Secondary Individual Actions */}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createPackageMutation.isPending || isProcessingAll}
                    className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  >
                    {createPackageMutation.isPending ? 'Saving Package...' : 'Save Package Only'}
                  </button>

                  {createdPlanId && (
                    <button
                      type="button"
                      disabled={allocateMutation.isPending || isProcessingAll}
                      onClick={() => allocateMutation.mutate(createdPlanId)}
                      className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Sparkles size={13} className="text-amber-700" />
                      {allocateMutation.isPending ? 'Allocating...' : 'Auto-Schedule Only'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPkgModalOpen(false)
                      setActiveTab('list')
                    }}
                    className="py-2 px-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-medium transition"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Patient Appointment Modal (Front Desk / Receptionist) */}
      {bookModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative my-8 border border-gray-100">
            <button
              onClick={() => setBookModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-1 text-[var(--color-brand)]">
              <CalendarPlus size={22} />
              <h2 className="text-xl font-bold text-gray-900">Book Patient Appointment</h2>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Front Desk appointment scheduling with instant cash collection & receipting.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!bookForm.patient_id) {
                  alert('Please select a patient')
                  return
                }
                if (!bookForm.doctor_id) {
                  alert('Please select a doctor')
                  return
                }
                bookAppointmentMutation.mutate(bookForm)
              }}
              className="space-y-4 text-sm"
            >
              {/* Patient Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Patient *</label>
                <select
                  required
                  value={bookForm.patient_id}
                  onChange={(e) => setBookForm({ ...bookForm, patient_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.uhid}) - {p.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Consulting Doctor (Vaidya) *</label>
                <select
                  required
                  value={bookForm.doctor_id}
                  onChange={(e) => setBookForm({ ...bookForm, doctor_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.first_name} {d.last_name} ({d.specialization || 'Ayurvedic Physician'}) {d.is_online ? '🟢 Available' : '⚪ Away'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date & Time */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Appointment Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={bookForm.scheduled_at}
                    onChange={(e) => setBookForm({ ...bookForm, scheduled_at: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>

                {/* Consultation Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Consultation Type</label>
                  <select
                    value={bookForm.consultation_type}
                    onChange={(e) => setBookForm({ ...bookForm, consultation_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                  >
                    <option value="initial">Initial Consultation (First Visit)</option>
                    <option value="followup">Follow-up Assessment</option>
                  </select>
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Chief Complaint / Primary Concern</label>
                <input
                  type="text"
                  placeholder="e.g., Chronic lower back pain, migraine, digestive issues"
                  value={bookForm.chief_complaint}
                  onChange={(e) => setBookForm({ ...bookForm, chief_complaint: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              {/* Payment Section */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                      Consultation Fee & Payment
                    </span>
                    <span className="text-xs text-gray-500">Standard Panchakarma consultation fee: ₹{bookForm.consultation_fee}</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookForm.collect_payment}
                      onChange={(e) => setBookForm({ ...bookForm, collect_payment: e.target.checked })}
                      className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)] h-4 w-4"
                    />
                    <span className="text-xs font-medium text-gray-700">Collect payment now</span>
                  </label>
                </div>

                {bookForm.collect_payment && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                      Select Payment Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Cash Option - Available */}
                      <label className="relative flex flex-col p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 cursor-pointer shadow-xs transition">
                        <input
                          type="radio"
                          name="payment_method"
                          value="cash"
                          checked={bookForm.payment_method === 'cash'}
                          onChange={() => setBookForm({ ...bookForm, payment_method: 'cash' })}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between mb-1">
                          <Banknote size={18} className="text-emerald-700" />
                          <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded font-bold text-[10px]">
                            Available
                          </span>
                        </div>
                        <span className="font-bold text-xs text-emerald-950">Cash</span>
                        <span className="text-[10px] text-emerald-700 mt-0.5">Counter receipt</span>
                      </label>

                      {/* UPI Option - Disabled with Coming Soon */}
                      <div className="relative flex flex-col p-3 rounded-xl border border-gray-200 bg-gray-100/70 opacity-60 cursor-not-allowed">
                        <div className="flex items-center justify-between mb-1">
                          <QrCode size={18} className="text-gray-400" />
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] border border-amber-200">
                            Coming Soon
                          </span>
                        </div>
                        <span className="font-semibold text-xs text-gray-600">UPI (GPay/QR)</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">Gateway setup</span>
                      </div>

                      {/* Card Option - Disabled with Coming Soon */}
                      <div className="relative flex flex-col p-3 rounded-xl border border-gray-200 bg-gray-100/70 opacity-60 cursor-not-allowed">
                        <div className="flex items-center justify-between mb-1">
                          <CreditCard size={18} className="text-gray-400" />
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] border border-amber-200">
                            Coming Soon
                          </span>
                        </div>
                        <span className="font-semibold text-xs text-gray-600">Card (POS)</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">Machine setup</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setBookModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookAppointmentMutation.isPending}
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-1.5"
                >
                  {bookAppointmentMutation.isPending ? 'Booking...' : 'Confirm Appointment & Collect Fee'}
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
                    <p className="text-gray-600">Patient No (UHID): <span className="font-mono font-bold text-emerald-800">{summaryData.patient.patient_number || summaryData.patient.uhid}</span></p>
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
                  <button
                    onClick={() =>
                      downloadPdf(
                        `/consultations/treatment-plans/${selectedSummaryPlanId}/summary/pdf`,
                        `Treatment_Summary_${summaryData?.patient?.patient_number || summaryData?.patient?.uhid || 'Plan'}.pdf`
                      )
                    }
                    className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
                  >
                    <Download size={15} />
                    Download Official PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
