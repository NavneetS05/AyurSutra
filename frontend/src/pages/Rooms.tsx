import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  DoorClosed,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Stethoscope,
  UserCheck,
  Trash2,
  Edit,
  X,
  RefreshCw,
} from 'lucide-react'

interface Room {
  id: string
  name: string
  facilities?: string
  capacity: number
  is_active: boolean
  status: string // active, maintenance, cleaning
  assigned_doctor_id?: string
  assigned_therapist_id?: string
  assigned_doctor_name?: string
  assigned_therapist_name?: string
}

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  is_doctor: boolean
  is_therapist: boolean
  specialization?: string
}

const standardFacilities = [
  { id: 'droni_wooden', label: 'Wooden Droni Table' },
  { id: 'shirodhara_stand', label: 'Shirodhara Apparatus' },
  { id: 'steam_chamber', label: 'Swedana Steam Chamber' },
  { id: 'basti_equipment', label: 'Basti Equipment' },
  { id: 'nasya_chair', label: 'Nasya Chair' },
  { id: 'attached_bath', label: 'Attached Bath' },
]

export default function Rooms() {
  const queryClient = useQueryClient()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  // Form State
  const [form, setForm] = useState({
    name: '',
    facilities: 'droni_wooden, shirodhara_stand',
    capacity: 1,
    is_active: true,
    status: 'active',
    assigned_doctor_id: '',
    assigned_therapist_id: '',
  })

  // Queries
  const { data: rooms = [], isLoading, refetch, isFetching } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await api.get('/rooms/?active_only=false')
      return res.data
    },
  })

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get('/staff/')
      return res.data
    },
  })

  const doctors = staffList.filter((s) => s.is_doctor)
  const therapists = staffList.filter((s) => s.is_therapist)

  // Mutations
  const createRoomMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await api.post('/rooms/', {
        ...payload,
        assigned_doctor_id: payload.assigned_doctor_id || null,
        assigned_therapist_id: payload.assigned_therapist_id || null,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setAddModalOpen(false)
      resetForm()
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to create room')
    },
  })

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof form> }) => {
      const res = await api.patch(`/rooms/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setEditModalOpen(false)
      setSelectedRoom(null)
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update room')
    },
  })

  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const res = await api.delete(`/rooms/${roomId}`)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      alert(data.message || 'Room removed successfully')
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to remove room')
    },
  })

  function resetForm() {
    setForm({
      name: '',
      facilities: 'droni_wooden, shirodhara_stand',
      capacity: 1,
      is_active: true,
      status: 'active',
      assigned_doctor_id: '',
      assigned_therapist_id: '',
    })
  }

  function openEditModal(room: Room) {
    setSelectedRoom(room)
    setForm({
      name: room.name,
      facilities: room.facilities || '',
      capacity: room.capacity,
      is_active: room.is_active,
      status: room.status || 'active',
      assigned_doctor_id: room.assigned_doctor_id || '',
      assigned_therapist_id: room.assigned_therapist_id || '',
    })
    setEditModalOpen(true)
  }

  function handleStatusToggle(room: Room, newStatus: string) {
    updateRoomMutation.mutate({
      id: room.id,
      data: { status: newStatus, is_active: newStatus === 'active' },
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Active & Available
          </span>
        )
      case 'cleaning':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            <Sparkles size={13} className="text-blue-600" />
            Sanitization & Cleaning
          </span>
        )
      case 'maintenance':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <AlertTriangle size={13} className="text-amber-600" />
            Maintenance
          </span>
        )
    }
  }

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
            Manage Panchakarma therapy suites, assign attending doctors and therapists, and track live room statuses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-xs"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => {
              resetForm()
              setAddModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-semibold shadow-xs transition"
          >
            <Plus size={16} />
            Add Suite
          </button>
        </div>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400">Loading therapy rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 text-gray-400">
          <DoorClosed className="mx-auto mb-2 text-gray-300" size={36} />
          <p className="font-semibold text-gray-700">No therapy rooms found</p>
          <p className="text-sm text-gray-500">Click &quot;Add Suite&quot; to configure your clinic rooms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => {
            const facilitiesList = room.facilities
              ? room.facilities.split(',').map((f) => f.trim()).filter(Boolean)
              : []

            return (
              <div
                key={room.id}
                className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Name & Status */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                        <DoorClosed size={20} />
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-900 text-base">{room.name}</h2>
                        <span className="text-xs text-gray-400">Capacity: {room.capacity} patient</span>
                      </div>
                    </div>
                    {getStatusBadge(room.status)}
                  </div>

                  {/* Staff Assignments */}
                  <div className="my-3 p-3 bg-gray-50/80 rounded-xl border border-gray-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                        <Stethoscope size={14} className="text-emerald-600" />
                        Assigned Doctor:
                      </span>
                      <span className="font-semibold text-gray-800">
                        {room.assigned_doctor_name || (
                          <span className="text-gray-400 italic font-normal">Unassigned</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                        <UserCheck size={14} className="text-amber-600" />
                        Assigned Therapist:
                      </span>
                      <span className="font-semibold text-gray-800">
                        {room.assigned_therapist_name || (
                          <span className="text-gray-400 italic font-normal">Unassigned</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Equipped Facilities */}
                  <div className="mt-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                      Equipped Facilities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {facilitiesList.length > 0 ? (
                        facilitiesList.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/70 rounded-md text-[11px] font-medium"
                          >
                            {tag.replace(/_/g, ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">Standard Room Facilities</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls: Quick Status & Actions */}
                <div className="mt-5 pt-3 border-t border-gray-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-medium text-gray-400">Quick Status:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStatusToggle(room, 'active')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                          room.status === 'active'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => handleStatusToggle(room, 'cleaning')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                          room.status === 'cleaning'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Clean
                      </button>
                      <button
                        onClick={() => handleStatusToggle(room, 'maintenance')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                          room.status === 'maintenance'
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Maint
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                    <button
                      onClick={() => openEditModal(room)}
                      className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-medium py-1 px-2 rounded hover:bg-gray-100 transition"
                    >
                      <Edit size={13} />
                      Edit / Assign
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove or deactivate room "${room.name}"?`)) {
                          deleteRoomMutation.mutate(room.id)
                        }
                      }}
                      className="flex items-center gap-1.5 text-red-600 hover:text-red-700 font-medium py-1 px-2 rounded hover:bg-red-50 transition"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Room Modal */}
      {(addModalOpen || editModalOpen) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setAddModalOpen(false)
                setEditModalOpen(false)
                setSelectedRoom(null)
              }}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {editModalOpen ? 'Edit & Assign Therapy Suite' : 'Add Therapy Suite'}
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Configure room details, operational status, and assign attending doctor and therapist.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (editModalOpen && selectedRoom) {
                  updateRoomMutation.mutate({
                    id: selectedRoom.id,
                    data: {
                      name: form.name,
                      facilities: form.facilities,
                      capacity: form.capacity,
                      status: form.status,
                      is_active: form.status === 'active',
                      assigned_doctor_id: form.assigned_doctor_id || undefined,
                      assigned_therapist_id: form.assigned_therapist_id || undefined,
                    },
                  })
                } else {
                  createRoomMutation.mutate(form)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Suite Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dhanvantari Sanctum - Suite 101"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Operational Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                  >
                    <option value="active">Active & Available</option>
                    <option value="cleaning">Sanitization / Cleaning</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Capacity (Patients)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Staff Assignments */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                  Staff Assignments
                </span>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Doctor (Vaidya)
                  </label>
                  <select
                    value={form.assigned_doctor_id}
                    onChange={(e) => setForm({ ...form, assigned_doctor_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                  >
                    <option value="">-- No Doctor Assigned --</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.first_name} {doc.last_name} {doc.specialization ? `(${doc.specialization})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Lead Therapist
                  </label>
                  <select
                    value={form.assigned_therapist_id}
                    onChange={(e) => setForm({ ...form, assigned_therapist_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                  >
                    <option value="">-- No Therapist Assigned --</option>
                    {therapists.map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.first_name} {th.last_name} {th.specialization ? `(${th.specialization})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Facilities */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Equipped Specialized Apparatus (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. droni_wooden, shirodhara_stand, steam_chamber"
                  value={form.facilities}
                  onChange={(e) => setForm({ ...form, facilities: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {standardFacilities.map((f) => {
                    const isSelected = form.facilities.includes(f.id)
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => {
                          const current = form.facilities
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean)
                          if (isSelected) {
                            setForm({
                              ...form,
                              facilities: current.filter((x) => x !== f.id).join(', '),
                            })
                          } else {
                            setForm({
                              ...form,
                              facilities: [...current, f.id].join(', '),
                            })
                          }
                        }}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition ${
                          isSelected
                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setAddModalOpen(false)
                    setEditModalOpen(false)
                    setSelectedRoom(null)
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoomMutation.isPending || updateRoomMutation.isPending}
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {createRoomMutation.isPending || updateRoomMutation.isPending
                    ? 'Saving...'
                    : editModalOpen
                    ? 'Save Changes'
                    : 'Create Suite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
