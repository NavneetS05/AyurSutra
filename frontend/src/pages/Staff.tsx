import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { UserCheck, Plus, Award, CalendarOff, X } from 'lucide-react'

interface StaffMember {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  role: string
  specialization?: string
  qualification?: string
  is_therapist: boolean
  is_doctor: boolean
  authorized_therapy_ids: string[]
}

export default function Staff() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)

  // Register staff form
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: 'Staff@123',
    role: 'therapist',
    specialization: 'Panchakarma Procedures',
    qualification: 'Certified Ayurvedic Panchakarma Therapist (CAPT)',
    is_therapist: true,
    is_doctor: false,
  })

  // Leave form
  const [leaveDate, setLeaveDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  )
  const [leaveNote, setLeaveNote] = useState('Medical Leave')

  // Auth therapy select
  const [selectedTherapyId, setSelectedTherapyId] = useState('')

  // Queries
  const { data: staffList = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get('/staff/')
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

  // Mutations
  const createStaffMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/staff/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setModalOpen(false)
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        password: 'Staff@123',
        role: 'therapist',
        specialization: 'Panchakarma Procedures',
        qualification: 'Certified Ayurvedic Panchakarma Therapist (CAPT)',
        is_therapist: true,
        is_doctor: false,
      })
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to register staff')
    },
  })

  const addLeaveMutation = useMutation({
    mutationFn: async ({ staffId, date, note }: any) => {
      const res = await api.post(`/staff/${staffId}/availability`, {
        leave_date: date,
        note: note,
      })
      return res.data
    },
    onSuccess: () => {
      alert('Approved leave registered! Any conflicting sessions will trigger automated reallocation.')
      setLeaveModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to record leave')
    },
  })

  const authorizeTherapyMutation = useMutation({
    mutationFn: async ({ staffId, therapyId }: any) => {
      const res = await api.post(`/staff/${staffId}/authorize-therapy/${therapyId}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setAuthModalOpen(false)
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to authorize therapy')
    },
  })

  const getTherapyName = (id: string) => {
    const t = therapies.find((x: any) => x.id === id)
    return t ? t.name : 'Authorized Therapy'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="text-[var(--color-brand)]" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">Clinical Staff & Vaidyas</h1>
          </div>
          <p className="text-sm text-gray-500">
            Manage Ayurvedic doctors, certified therapists, therapy qualifications, and leave schedules.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-semibold shadow-sm transition"
        >
          <Plus size={16} />
          Register Staff Member
        </button>
      </div>

      {/* Staff Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400">Loading staff directory...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {staffList.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h2 className="font-bold text-gray-900 text-base">
                      {member.is_doctor ? 'Dr. ' : ''}
                      {member.first_name} {member.last_name}
                    </h2>
                    <span className="text-xs text-gray-400 font-mono">{member.email}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                      member.role === 'doctor'
                        ? 'bg-purple-100 text-purple-800'
                        : member.role === 'therapist'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>

                <div className="text-xs text-gray-600 space-y-1 my-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                  <p>
                    <strong>Specialization:</strong> {member.specialization || 'Classical Ayurveda'}
                  </p>
                  <p>
                    <strong>Qualification:</strong> {member.qualification || 'BAMS'}
                  </p>
                </div>

                {/* Authorized Therapies */}
                {member.is_therapist && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                        <Award size={13} className="text-amber-600" />
                        Qualified Therapies ({member.authorized_therapy_ids.length})
                      </span>
                      <button
                        onClick={() => {
                          setSelectedStaff(member)
                          if (therapies.length > 0) setSelectedTherapyId(therapies[0].id)
                          setAuthModalOpen(true)
                        }}
                        className="text-[11px] font-bold text-[var(--color-brand)] hover:underline"
                      >
                        + Authorize
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {member.authorized_therapy_ids.length > 0 ? (
                        member.authorized_therapy_ids.map((tid) => (
                          <span
                            key={tid}
                            className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded text-[11px] font-medium"
                          >
                            {getTherapyName(tid)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No therapies authorized yet</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                <span className="text-gray-400 font-mono text-[11px]">ID: {member.id.slice(0, 8)}...</span>
                <button
                  onClick={() => {
                    setSelectedStaff(member)
                    setLeaveModalOpen(true)
                  }}
                  className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 transition"
                >
                  <CalendarOff size={13} />
                  Record Leave
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Register Clinical Staff</h2>
            <p className="text-xs text-gray-500 mb-4">
              Add a new physician, therapist, or receptionist to the clinic roster.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createStaffMutation.mutate(form)
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Role</label>
                <select
                  value={form.role}
                  onChange={(e) => {
                    const r = e.target.value
                    setForm({
                      ...form,
                      role: r,
                      is_doctor: r === 'doctor',
                      is_therapist: r === 'therapist',
                    })
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                >
                  <option value="therapist">Panchakarma Therapist</option>
                  <option value="doctor">Ayurvedic Physician (Vaidya)</option>
                  <option value="receptionist">Receptionist / Front Desk</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Specialization</label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStaffMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {createStaffMutation.isPending ? 'Registering...' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Leave Modal */}
      {leaveModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setLeaveModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-base font-bold text-gray-900 mb-1">Record Approved Leave</h2>
            <p className="text-xs text-gray-500 mb-4">
              Staff: <span className="font-semibold text-gray-800">{selectedStaff.first_name} {selectedStaff.last_name}</span>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                addLeaveMutation.mutate({
                  staffId: selectedStaff.id,
                  date: leaveDate,
                  note: leaveNote,
                })
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Leave Date *</label>
                <input
                  type="date"
                  required
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={leaveNote}
                  onChange={(e) => setLeaveNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLeaveMutation.isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Record Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Authorize Therapy Modal */}
      {authModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-base font-bold text-gray-900 mb-1">Authorize Therapy Certification</h2>
            <p className="text-xs text-gray-500 mb-4">
              Authorize <span className="font-semibold text-gray-800">{selectedStaff.first_name}</span> to deliver this clinical procedure.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!selectedTherapyId) return
                authorizeTherapyMutation.mutate({
                  staffId: selectedStaff.id,
                  therapyId: selectedTherapyId,
                })
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Therapy *</label>
                <select
                  value={selectedTherapyId}
                  onChange={(e) => setSelectedTherapyId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                >
                  {therapies.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.default_duration_minutes}m)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={authorizeTherapyMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold transition"
                >
                  Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
