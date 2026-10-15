import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { DoorClosed, Plus, CheckCircle2, XCircle, X } from 'lucide-react'

interface Room {
  id: string
  name: string
  facilities?: string
  capacity: number
  is_active: boolean
}

export default function Rooms() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    facilities: 'droni_wooden, shirodhara_stand',
    capacity: 1,
    is_active: true,
  })

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await api.get('/rooms/?active_only=false')
      return res.data
    },
  })

  const createRoomMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/rooms/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setModalOpen(false)
      setForm({
        name: '',
        facilities: 'droni_wooden, shirodhara_stand',
        capacity: 1,
        is_active: true,
      })
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to create room')
    },
  })

  const standardFacilities = [
    { id: 'droni_wooden', label: 'Wooden Droni Table' },
    { id: 'shirodhara_stand', label: 'Shirodhara Apparatus' },
    { id: 'steam_chamber', label: 'Swedana Steam Chamber' },
    { id: 'basti_equipment', label: 'Basti Equipment' },
    { id: 'nasya_chair', label: 'Nasya Chair' },
    { id: 'attached_bath', label: 'Attached Bath' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DoorClosed className="text-[var(--color-brand)]" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">Treatment Rooms & Suites</h1>
          </div>
          <p className="text-sm text-gray-500">
            Manage Panchakarma therapy suites, specialized apparatus, and room facility constraints.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-semibold shadow-sm transition"
        >
          <Plus size={16} />
          Add Therapy Suite
        </button>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400">Loading therapy rooms...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => {
            const facilitiesList = room.facilities
              ? room.facilities.split(',').map((f) => f.trim()).filter(Boolean)
              : []

            return (
              <div
                key={room.id}
                className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                        <DoorClosed size={18} />
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-800 text-sm">{room.name}</h2>
                        <span className="text-[11px] text-gray-400">Capacity: {room.capacity} patient</span>
                      </div>
                    </div>
                    {room.is_active ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle2 size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                        <XCircle size={12} />
                        Maintenance
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-2">
                      Equipped Facilities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {facilitiesList.length > 0 ? (
                        facilitiesList.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-amber-50/70 text-amber-900 border border-amber-200/60 rounded-lg text-xs font-medium"
                          >
                            {tag.replace(/_/g, ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">Standard Room</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100/70 flex justify-between items-center text-xs text-gray-500">
                  <span>Room ID: <span className="font-mono text-[11px]">{room.id.slice(0, 8)}...</span></span>
                  <span className="text-emerald-700 font-medium">Ready for allocation</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Room Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Add Therapy Suite</h2>
            <p className="text-xs text-gray-500 mb-4">
              Register a new Panchakarma therapy room and declare its specialized apparatus.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createRoomMutation.mutate(form)
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Suite Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suite 104 - Shirodhara Suite"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Equipped Apparatus & Facilities (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="droni_wooden, shirodhara_stand, steam_chamber"
                  value={form.facilities}
                  onChange={(e) => setForm({ ...form, facilities: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {standardFacilities.map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => {
                        const current = form.facilities.split(',').map((x) => x.trim()).filter(Boolean)
                        if (!current.includes(f.id)) {
                          setForm({ ...form, facilities: [...current, f.id].join(', ') })
                        }
                      }}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-medium transition"
                    >
                      + {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 text-[var(--color-brand)] rounded"
                  />
                  <label htmlFor="is_active" className="text-xs font-semibold text-gray-700">
                    Active & Available
                  </label>
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
                  disabled={createRoomMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {createRoomMutation.isPending ? 'Saving...' : 'Add Suite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
