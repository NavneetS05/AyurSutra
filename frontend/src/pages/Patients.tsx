import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  X,
  AlertTriangle,
  Stethoscope,
  Sparkles,
  FileText,
  CreditCard,
  ChevronRight,
  Activity,
  History,
  CalendarPlus,
  CheckCircle2,
  Banknote,
  QrCode,
  Download,
} from 'lucide-react'
import { downloadPdf } from '@/lib/download'

interface PatientSummary {
  id: string
  patient_number?: string
  uhid?: string
  first_name: string
  last_name: string
  phone: string
  email?: string
  date_of_birth?: string
  gender?: string
  address?: string
  allergies?: string
  medical_history?: string
  registration_date: string
  has_portal_account: boolean
  consultation_count: number
}

interface PatientFullHistory {
  patient: {
    id: string
    patient_number?: string
    uhid?: string
    first_name: string
    last_name: string
    phone: string
    email?: string
    date_of_birth?: string
    gender?: string
    address?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    allergies?: string
    medical_history?: string
    registration_date?: string
    has_portal_account: boolean
  }
  summary: {
    total_visits: number
    total_treatment_plans: number
    total_sessions: number
    completed_sessions: number
    attendance_rate: number
    compliance_metric_name: string
    total_billed: number
    total_paid: number
    outstanding_balance: number
  }
  consultations: Array<{
    id: string
    scheduled_at: string
    consultation_type: string
    doctor_id: string
    doctor_name: string
    chief_complaint?: string
    prakriti?: string
    vikriti?: string
    notes?: string
    consultation_fee: number
    fee_paid: boolean
    has_treatment_plan: boolean
  }>
  treatment_plans: Array<{
    id: string
    consultation_id: string
    consultation_date?: string
    doctor_name: string
    title: string
    objectives?: string
    diet_recommendations?: string
    lifestyle_recommendations?: string
    start_date?: string
    end_date?: string
    is_finalized: boolean
    items: Array<{
      id: string
      therapy_name: string
      session_count: number
      duration_minutes: number
      frequency_per_week?: number
      notes?: string
    }>
  }>
  therapy_sessions: Array<{
    id: string
    session_number: number
    therapy_name: string
    therapist_name: string
    room_name: string
    scheduled_start: string
    scheduled_end: string
    actual_start?: string
    actual_end?: string
    status: string
    observations?: string
    patient_feedback?: string
    oils_used?: string
    pressure_level?: string
    therapist_notes?: string
    flagged_for_doctor: boolean
  }>
  packages: Array<{
    id: string
    name: string
    custom_price: number
    amount_paid: number
    balance_due: number
    payment_status: string
    status: string
    valid_from?: string
    valid_until?: string
  }>
  payments: Array<{
    id: string
    amount: number
    method: string
    status: string
    paid_at?: string
    receipt_number?: string
  }>
}

export default function Patients() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'consultations' | 'plans' | 'sessions' | 'billing'>('consultations')

  // Register Form
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    gender: 'male',
    date_of_birth: '',
    address: '',
    allergies: '',
    medical_history: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    create_portal_account: false,
    portal_password: '',
  })
  const [formError, setFormError] = useState('')

  // 1. Fetch unique patients directory
  const { data: patients = [], isLoading } = useQuery<PatientSummary[]>({
    queryKey: ['patients', search],
    queryFn: async () => {
      const res = await api.get('/patients/', { params: search ? { search } : {} })
      return res.data
    },
  })

  // 2. Fetch full longitudinal history for selected unique patient
  const {
    data: patientHistory,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErrorObj,
    refetch: refetchHistory,
  } = useQuery<PatientFullHistory>({
    queryKey: ['patient-full-history', selectedPatientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${selectedPatientId}/full-history`)
      return res.data
    },
    enabled: !!selectedPatientId,
  })

  const registerMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/patients/', payload)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setRegisterModalOpen(false)
      setForm({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        gender: 'male',
        date_of_birth: '',
        address: '',
        allergies: '',
        medical_history: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        create_portal_account: false,
        portal_password: '',
      })
      setSelectedPatientId(data.id)
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || 'Registration failed')
    },
  })

  // Book Appointment for Existing / Returning Patient
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookForm, setBookForm] = useState({
    patient_id: '',
    patient_name: '',
    doctor_id: '',
    scheduled_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    consultation_type: 'followup',
    consultation_fee: 500,
    chief_complaint: '',
    collect_payment: true,
    payment_method: 'cash',
  })

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get('/staff/')
      return res.data
    },
  })
  const doctors = staffList.filter((s: any) => s.is_doctor)

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
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient-full-history', bookForm.patient_id] })
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      setBookModalOpen(false)
      alert(`Appointment booked successfully for ${bookForm.patient_name}! ${data.fee_paid ? 'Cash payment collected & receipt generated.' : ''}`)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || 'Failed to book appointment')
    },
  })

  function openBookModalForPatient(p: { id: string; first_name: string; last_name: string }) {
    setBookForm({
      patient_id: p.id,
      patient_name: `${p.first_name} ${p.last_name}`,
      doctor_id: doctors.length > 0 ? doctors[0].id : '',
      scheduled_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      consultation_type: 'followup',
      consultation_fee: 500,
      chief_complaint: '',
      collect_payment: true,
      payment_method: 'cash',
    })
    setBookModalOpen(true)
  }

  function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    registerMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients & Medical Records</h1>
          <p className="text-sm text-gray-500">
            Each patient has <strong>one permanent profile</strong>. Existing patients never register twice—simply search and click <strong>"Book Visit"</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRegisterModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <UserPlus size={16} />
            Register New Patient (1st Visit)
          </button>
        </div>
      </div>

      {/* Returning Patient Guide Banner */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-200/60 rounded-lg text-emerald-800">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <strong className="text-sm font-bold text-emerald-900 block">Patient visiting again?</strong>
            <span>
              Do <strong>NOT</strong> register them again! Simply find their name in the directory below and click <strong>"Book Visit"</strong> or <strong>"Full EHR"</strong>.
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search unique patients by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] shadow-xs"
        />
      </div>

      {/* Unique Patients Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading patient records...</div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-base font-medium text-gray-600 mb-1">No patient records found</p>
            <p className="text-sm">Register a new patient or clear your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Unique Patient Record</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Gender & DOB</th>
                  <th className="py-3 px-4">Visits / Consultations</th>
                  <th className="py-3 px-4">Portal Account</th>
                  <th className="py-3 px-4 text-right">EHR Medical History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className="hover:bg-amber-50/40 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        {p.first_name} {p.last_name}
                        {p.allergies && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            Allergies
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {p.patient_number || p.uhid || `ID: ${p.id.slice(0, 8)}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Phone size={13} className="text-gray-400" />
                        <span>{p.phone}</span>
                      </div>
                      {p.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                          <Mail size={12} />
                          <span>{p.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600">
                      <span className="capitalize">{p.gender || '—'}</span>
                      {p.date_of_birth && (
                        <span className="text-gray-400 block text-[11px]">{p.date_of_birth}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <History size={12} />
                        {p.consultation_count} {p.consultation_count === 1 ? 'Visit' : 'Visits'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.has_portal_account ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active Portal
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Offline Only
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openBookModalForPatient(p)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                        >
                          <CalendarPlus size={13} />
                          Book Visit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPatientId(p.id)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-[var(--color-brand)] text-gray-700 hover:text-white rounded-lg text-xs font-semibold border border-gray-200 transition"
                        >
                          Full EHR
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PATIENT 360 LONGITUDINAL HISTORY DRAWER / MODAL */}
      {selectedPatientId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] shadow-2xl flex flex-col overflow-hidden relative border border-gray-200">
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedPatientId(null)}
              className="absolute right-5 top-5 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition z-10"
            >
              <X size={18} />
            </button>

            {historyLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
                <div className="w-8 h-8 border-3 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium">Loading longitudinal EHR history...</p>
              </div>
            ) : historyError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-red-600 gap-3">
                <AlertTriangle size={36} />
                <p className="text-base font-bold">Failed to load medical history</p>
                <p className="text-xs text-gray-500 max-w-md">
                  {(historyErrorObj as any)?.response?.data?.detail || 'An unexpected error occurred while communicating with the database.'}
                </p>
                <button
                  onClick={() => refetchHistory()}
                  className="px-4 py-2 bg-[var(--color-brand)] text-white text-xs font-semibold rounded-xl hover:bg-[var(--color-brand-dark)] transition"
                >
                  Retry Loading
                </button>
              </div>
            ) : !patientHistory ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Patient record not found.
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Patient Header Banner */}
                <div className="p-6 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-white border-b border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand)] text-white flex items-center justify-center text-xl font-bold shadow-xs">
                          {patientHistory.patient.first_name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-900">
                              {patientHistory.patient.first_name} {patientHistory.patient.last_name}
                            </h2>
                            <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-bold border border-emerald-300 font-mono">
                              Patient No: {patientHistory.patient.patient_number || patientHistory.patient.uhid || patientHistory.patient.id.slice(0, 8)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mt-1">
                            <span>Phone: <strong className="text-gray-900">{patientHistory.patient.phone}</strong></span>
                            {patientHistory.patient.email && (
                              <span>Email: <strong className="text-gray-900">{patientHistory.patient.email}</strong></span>
                            )}
                            <span className="capitalize">Gender: <strong className="text-gray-900">{patientHistory.patient.gender || 'N/A'}</strong></span>
                            {patientHistory.patient.date_of_birth && (
                              <span>DOB: <strong className="text-gray-900">{patientHistory.patient.date_of_birth}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Clinical Warning Alerts */}
                      {(patientHistory.patient.allergies || patientHistory.patient.medical_history) && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {patientHistory.patient.allergies && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg font-semibold">
                              <AlertTriangle size={13} />
                              Known Allergies: {patientHistory.patient.allergies}
                            </span>
                          )}
                          {patientHistory.patient.medical_history && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                              <Activity size={13} />
                              Medical History: {patientHistory.patient.medical_history}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Metric Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Visits</span>
                        <span className="text-lg font-bold text-gray-900">{patientHistory.summary.total_visits}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Regimens</span>
                        <span className="text-lg font-bold text-purple-700">{patientHistory.summary.total_treatment_plans}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Sessions Done</span>
                        <span className="text-lg font-bold text-emerald-700">
                          {patientHistory.summary.completed_sessions}/{patientHistory.summary.total_sessions}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Attendance Rate</span>
                        <span className="text-lg font-bold text-amber-700">{patientHistory.summary.attendance_rate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar inside Header */}
                  <div className="mt-4 pt-3 border-t border-gray-200/70 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      Unified longitudinal profile — all visits, regimens, sessions, and payments are tracked under this record.
                    </p>
                    <button
                      onClick={() => openBookModalForPatient(patientHistory.patient)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      <CalendarPlus size={15} />
                      Book Next Visit / Consultation
                    </button>
                  </div>
                </div>

                {/* Drawer Tab Navigation */}
                <div className="flex border-b border-gray-200 px-6 bg-gray-50/60">
                  <button
                    onClick={() => setDetailTab('consultations')}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
                      detailTab === 'consultations'
                        ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Stethoscope size={15} />
                    Consultations & Doctor Visits ({patientHistory.consultations.length})
                  </button>
                  <button
                    onClick={() => setDetailTab('plans')}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
                      detailTab === 'plans'
                        ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <FileText size={15} />
                    Treatment Regimens ({patientHistory.treatment_plans.length})
                  </button>
                  <button
                    onClick={() => setDetailTab('sessions')}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
                      detailTab === 'sessions'
                        ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Sparkles size={15} />
                    Therapy Sessions Log ({patientHistory.therapy_sessions.length})
                  </button>
                  <button
                    onClick={() => setDetailTab('billing')}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
                      detailTab === 'billing'
                        ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <CreditCard size={15} />
                    Billing & Receipts ({patientHistory.payments.length})
                  </button>
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* TAB 1: CONSULTATIONS */}
                  {detailTab === 'consultations' && (
                    <div className="space-y-4">
                      {patientHistory.consultations.length === 0 ? (
                        <div className="text-center p-8 text-gray-400">No consultations on file for this patient.</div>
                      ) : (
                        patientHistory.consultations.map((c) => (
                          <div
                            key={c.id}
                            className="p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs hover:border-amber-200 transition space-y-3"
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-800">
                                    {new Date(c.scheduled_at).toLocaleDateString(undefined, {
                                      weekday: 'short',
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 capitalize">
                                    {c.consultation_type}
                                  </span>
                                </div>
                                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                                  Attending Doctor: <span className="text-[var(--color-brand)]">{c.doctor_name}</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-bold text-gray-900">₹{c.consultation_fee}</span>
                                <span
                                  className={`block text-[11px] font-semibold ${
                                    c.fee_paid ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {c.fee_paid ? '✓ Fee Paid' : 'Pending Payment'}
                                </span>
                              </div>
                            </div>

                            {c.chief_complaint && (
                              <p className="text-xs text-gray-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                                <strong className="text-amber-900">Chief Complaint:</strong> {c.chief_complaint}
                              </p>
                            )}

                            {(c.prakriti || c.vikriti) && (
                              <div className="flex gap-4 text-xs p-2.5 bg-gray-50 rounded-xl">
                                {c.prakriti && (
                                  <span>
                                    <strong className="text-gray-700">Prakriti (Constitution):</strong> {c.prakriti}
                                  </span>
                                )}
                                {c.vikriti && (
                                  <span>
                                    <strong className="text-gray-700">Vikriti (Imbalance):</strong> {c.vikriti}
                                  </span>
                                )}
                              </div>
                            )}

                            {c.notes && (
                              <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-100">
                                <strong className="text-gray-900 block mb-1">Doctor&apos;s Clinical Notes:</strong>
                                {c.notes}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 2: TREATMENT PLANS */}
                  {detailTab === 'plans' && (
                    <div className="space-y-4">
                      {patientHistory.treatment_plans.length === 0 ? (
                        <div className="text-center p-8 text-gray-400">No treatment regimens on file.</div>
                      ) : (
                        patientHistory.treatment_plans.map((tp) => (
                          <div
                            key={tp.id}
                            className="p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-gray-900 text-sm">{tp.title}</h3>
                                <p className="text-xs text-gray-500">
                                  Prescribed by {tp.doctor_name} • Start:{' '}
                                  {tp.start_date ? new Date(tp.start_date).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => downloadPdf(`/consultations/treatment-plans/${tp.id}/summary/pdf`, `Treatment_Summary_${patientHistory.patient.patient_number || 'Plan'}.pdf`)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[var(--color-brand)] text-[var(--color-brand)] hover:text-white rounded-lg text-xs font-semibold border border-[var(--color-brand)] transition shadow-2xs"
                                  title="Download Official Clinical Treatment Summary PDF"
                                >
                                  <Download size={13} />
                                  Summary PDF
                                </button>
                                <span
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                                    tp.is_finalized
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {tp.is_finalized ? 'Finalized Regimen' : 'Draft / Active'}
                                </span>
                              </div>
                            </div>

                            {/* Plan items */}
                            <div className="mt-3">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                                Prescribed Panchakarma Therapies
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {tp.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="p-3 bg-amber-50/40 rounded-xl border border-amber-100 text-xs"
                                  >
                                    <div className="font-bold text-amber-950">{item.therapy_name}</div>
                                    <div className="text-gray-600 mt-0.5">
                                      {item.session_count} Sessions • {item.duration_minutes} mins each
                                    </div>
                                    {item.notes && <div className="text-gray-500 mt-1 italic">{item.notes}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Diet and Lifestyle */}
                            {(tp.diet_recommendations || tp.lifestyle_recommendations) && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 text-xs">
                                {tp.diet_recommendations && (
                                  <div className="bg-gray-50 p-2.5 rounded-xl">
                                    <strong className="text-gray-800 block mb-1">Dietary Advice (Pathya):</strong>
                                    <p className="text-gray-600">{tp.diet_recommendations}</p>
                                  </div>
                                )}
                                {tp.lifestyle_recommendations && (
                                  <div className="bg-gray-50 p-2.5 rounded-xl">
                                    <strong className="text-gray-800 block mb-1">Lifestyle & Daily Routine (Dinacharya):</strong>
                                    <p className="text-gray-600">{tp.lifestyle_recommendations}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: THERAPY SESSIONS LOG */}
                  {detailTab === 'sessions' && (
                    <div className="space-y-4">
                      {patientHistory.therapy_sessions.length === 0 ? (
                        <div className="text-center p-8 text-gray-400">No therapy sessions scheduled or completed.</div>
                      ) : (
                        patientHistory.therapy_sessions.map((s) => (
                          <div
                            key={s.id}
                            className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2 text-xs"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900 text-sm">
                                  {s.therapy_name} (Session #{s.session_number})
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                                    s.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : s.status === 'scheduled'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </div>
                              <span className="text-gray-400">
                                {new Date(s.scheduled_start).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500">
                              <span>Therapist: <strong className="text-gray-800">{s.therapist_name}</strong></span>
                              <span>Suite: <strong className="text-gray-800">{s.room_name}</strong></span>
                              {s.oils_used && (
                                <span>Oils: <strong className="text-amber-800">{s.oils_used}</strong></span>
                              )}
                              {s.pressure_level && (
                                <span>Pressure: <strong className="text-gray-800">{s.pressure_level}</strong></span>
                              )}
                            </div>

                            {s.therapist_notes && (
                              <div className="p-2.5 bg-gray-50 rounded-xl text-gray-700 mt-2">
                                <strong className="text-gray-900">Therapist Clinical Notes:</strong> {s.therapist_notes}
                              </div>
                            )}

                            {s.observations && (
                              <div className="p-2.5 bg-amber-50/50 rounded-xl text-amber-900 border border-amber-100">
                                <strong>Vaidya Observations:</strong> {s.observations}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: BILLING & PAYMENTS */}
                  {detailTab === 'billing' && (
                    <div className="space-y-5">
                      {/* Packages */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Commercial Treatment Packages
                        </h4>
                        {patientHistory.packages.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No packages enrolled.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {patientHistory.packages.map((pkg) => (
                              <div
                                key={pkg.id}
                                className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2 text-xs"
                              >
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-gray-900">{pkg.name}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 capitalize">
                                    {pkg.payment_status}
                                  </span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                  <span>Custom Price: ₹{pkg.custom_price}</span>
                                  <span>Paid: ₹{pkg.amount_paid}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-100 flex justify-between font-bold">
                                  <span className="text-gray-500">Balance Due:</span>
                                  <span className={pkg.balance_due > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                                    ₹{pkg.balance_due}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Payment Receipts */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          Payment Transactions & Receipts
                        </h4>
                        {patientHistory.payments.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No payments recorded yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {patientHistory.payments.map((p) => (
                              <div
                                key={p.id}
                                className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-bold text-gray-900">
                                    ₹{p.amount} • <span className="uppercase">{p.method}</span>
                                  </div>
                                  <div className="text-gray-400 text-[11px]">
                                    {p.paid_at ? new Date(p.paid_at).toLocaleString() : 'N/A'} • Receipt: {p.receipt_number || 'N/A'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {p.receipt_number && (
                                    <button
                                      onClick={() => downloadPdf(`/billing/receipts/${p.receipt_number}/pdf`, `Receipt_${p.receipt_number}.pdf`)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-semibold transition"
                                      title="Download Official Receipt PDF"
                                    >
                                      <Download size={12} />
                                      Receipt PDF
                                    </button>
                                  )}
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                    Confirmed
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setRegisterModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Register New Patient</h2>
            <p className="text-xs text-gray-500 mb-5">
              Create a unique patient identity that will track all subsequent visits, regimens, and therapy sessions.
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="patient@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Known Allergies (Crucial for oils)</label>
                <input
                  type="text"
                  placeholder="e.g. Sesame, Mustard, Eucalyptus, Peanuts"
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Past Medical History</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Chronic back pain, Hypertension, Cervical Spondylosis"
                  value={form.medical_history}
                  onChange={(e) => setForm({ ...form, medical_history: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              {/* Portal account checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={form.create_portal_account}
                    onChange={(e) => setForm({ ...form, create_portal_account: e.target.checked })}
                    className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                  />
                  <span>Create Patient Wellness Portal Account</span>
                </label>
              </div>

              {form.create_portal_account && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Portal Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter patient portal password"
                    value={form.portal_password}
                    onChange={(e) => setForm({ ...form, portal_password: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {registerMutation.isPending ? 'Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Appointment Modal for Returning / Existing Patient */}
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
              <h2 className="text-xl font-bold text-gray-900">Book Next Visit / Appointment</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Schedule consultation for returning patient: <strong className="text-gray-800">{bookForm.patient_name}</strong>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!bookForm.doctor_id) {
                  alert('Please select a doctor')
                  return
                }
                bookAppointmentMutation.mutate(bookForm)
              }}
              className="space-y-4 text-sm"
            >
              {/* Patient Name (Read-Only) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Patient Profile</label>
                <input
                  type="text"
                  disabled
                  value={bookForm.patient_name}
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-gray-800 font-bold"
                />
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Visit Type</label>
                  <select
                    value={bookForm.consultation_type}
                    onChange={(e) => setBookForm({ ...bookForm, consultation_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                  >
                    <option value="followup">Follow-up Assessment / Return Visit</option>
                    <option value="initial">New Clinical Complaint / Protocol</option>
                  </select>
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current Complaint / Reason for Visit</label>
                <input
                  type="text"
                  placeholder="e.g. Follow-up after Basti cycle, renewed knee stiffness, dietary review"
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
                    <span className="text-xs text-gray-500">Standard consultation fee: ₹{bookForm.consultation_fee}</span>
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
                  {bookAppointmentMutation.isPending ? 'Booking...' : 'Confirm Visit & Collect Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
