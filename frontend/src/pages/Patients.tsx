import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Search, UserPlus, Phone, Mail, Calendar, X } from 'lucide-react'

interface Patient {
  id: string
  first_name: string
  last_name: string
  phone: string
  email?: string
  date_of_birth?: string
  gender?: string
  address?: string
  registration_date: string
  has_portal_account: boolean
}

export default function Patients() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
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
    create_portal_account: false,
    portal_password: '',
  })
  const [formError, setFormError] = useState('')

  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ['patients', search],
    queryFn: async () => {
      const res = await api.get('/patients/', { params: search ? { search } : {} })
      return res.data
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/patients/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setModalOpen(false)
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
        create_portal_account: false,
        portal_password: '',
      })
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.detail || 'Registration failed')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    registerMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Patients Directory</h1>
          <p className="text-sm text-gray-500">Manage patient registrations and clinical profiles</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition"
        >
          <UserPlus size={16} />
          Register Patient
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by patient name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] shadow-sm"
        />
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-base font-medium text-gray-600 mb-1">No patients found</p>
            <p className="text-sm">Register a new patient to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Registration</th>
                  <th className="py-3 px-4">Portal Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-medium text-gray-800">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" />
                        <span>{p.phone}</span>
                      </div>
                      {p.email && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <Mail size={12} />
                          <span>{p.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-gray-600">{p.gender || '—'}</td>
                    <td className="py-3.5 px-4 text-gray-500">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{p.registration_date}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.has_portal_account ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active Account
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Offline Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Register New Patient</h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                    placeholder="9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  placeholder="patient@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.create_portal_account}
                    onChange={(e) => setForm({ ...form, create_portal_account: e.target.checked })}
                    className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                  />
                  <span>Create Patient Portal Account</span>
                </label>

                {form.create_portal_account && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Initial Password *</label>
                    <input
                      type="password"
                      required={form.create_portal_account}
                      value={form.portal_password}
                      onChange={(e) => setForm({ ...form, portal_password: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
                >
                  {registerMutation.isPending ? 'Registering...' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
