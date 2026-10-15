import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Leaf, Clock, IndianRupee, Plus, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'

interface Therapy {
  id: string
  name: string
  description?: string
  default_duration_minutes: number
  suggested_price?: number
  required_facilities?: string
  is_active: boolean
}

export default function Therapies() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    default_duration_minutes: 60,
    suggested_price: 1200,
    required_facilities: '',
  })
  const [error, setError] = useState('')

  const { data: therapies = [], isLoading } = useQuery<Therapy[]>({
    queryKey: ['therapies'],
    queryFn: async () => {
      const res = await api.get('/therapies/')
      return res.data
    },
  })

  const addMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/therapies/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapies'] })
      setModalOpen(false)
      setForm({
        name: '',
        description: '',
        default_duration_minutes: 60,
        suggested_price: 1200,
        required_facilities: '',
      })
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to add therapy')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    addMutation.mutate(form)
  }

  const canAdd = user?.role === 'admin' || user?.role === 'doctor'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Therapy Catalogue</h1>
          <p className="text-sm text-gray-500">Panchakarma treatments, durations, and facility requirements</p>
        </div>
        {canAdd && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition"
          >
            <Plus size={16} />
            Add Therapy
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading catalogue...</div>
      ) : therapies.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
          No therapies listed yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {therapies.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Leaf size={20} />
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{t.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                  {t.description || 'Traditional Panchakarma therapy procedure.'}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Clock size={14} className="text-gray-400" />
                    Duration
                  </span>
                  <span className="font-semibold">{t.default_duration_minutes} mins</span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <IndianRupee size={14} className="text-gray-400" />
                    Suggested Price
                  </span>
                  <span className="font-semibold text-emerald-700">₹{t.suggested_price || 0}</span>
                </div>

                {t.required_facilities && (
                  <div className="pt-2 text-xs">
                    <span className="text-gray-400 block mb-1">Required Facilities:</span>
                    <div className="flex flex-wrap gap-1">
                      {t.required_facilities.split(',').map((f) => (
                        <span
                          key={f.trim()}
                          className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[11px]"
                        >
                          {f.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-4">New Therapy</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Therapy Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  placeholder="e.g. Takradhara"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Duration (mins) *</label>
                  <input
                    type="number"
                    required
                    value={form.default_duration_minutes}
                    onChange={(e) => setForm({ ...form, default_duration_minutes: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Suggested Price (₹)</label>
                  <input
                    type="number"
                    value={form.suggested_price}
                    onChange={(e) => setForm({ ...form, suggested_price: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Required Facilities</label>
                <input
                  type="text"
                  value={form.required_facilities}
                  onChange={(e) => setForm({ ...form, required_facilities: e.target.value })}
                  placeholder="comma separated, e.g. table,shirodhara_stand"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
                >
                  {addMutation.isPending ? 'Saving...' : 'Create Therapy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
