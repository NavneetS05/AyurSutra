import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  UserCheck,
  Plus,
  Award,
  CalendarOff,
  X,
  KeyRound,
  Power,
  Trash2,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Stethoscope,
  Clock,
} from 'lucide-react'

interface UserAccount {
  id: string
  email: string
  phone?: string
  role: string
  is_active: boolean
  is_online?: boolean
  working_hours_start?: string
  working_hours_end?: string
  first_name?: string
  last_name?: string
  specialization?: string
  license_number?: string
  created_at: string
}

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
  is_online?: boolean
  working_hours_start?: string
  working_hours_end?: string
  authorized_therapy_ids: string[]
}

export default function Staff() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'accounts' | 'staff' | 'leave'>('accounts')
  const [searchAccount, setSearchAccount] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')

  // Modals
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false)
  const [resetPwModalOpen, setResetPwModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Staff profile modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)

  // Adjust Staff Working Hours modal (Admin Power)
  const [adjustHoursModalOpen, setAdjustHoursModalOpen] = useState(false)
  const [selectedStaffForHours, setSelectedStaffForHours] = useState<{
    id: string
    name: string
    user_id?: string
    start: string
    end: string
  } | null>(null)
  const [staffHoursForm, setStaffHoursForm] = useState({ start: '09:00', end: '18:00' })

  // Account creation form
  const [accountForm, setAccountForm] = useState({
    email: '',
    password: 'Password@123',
    role: 'therapist',
    phone: '',
    first_name: '',
    last_name: '',
    specialization: '',
    license_number: '',
  })

  // Leave form
  const [leaveDate, setLeaveDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  )
  const [leaveNote, setLeaveNote] = useState('Medical Leave')
  const [selectedTherapyId, setSelectedTherapyId] = useState('')

  // Queries
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<UserAccount[]>({
    queryKey: ['users', searchAccount, roleFilter],
    queryFn: async () => {
      const params: any = {}
      if (searchAccount) params.search = searchAccount
      if (roleFilter !== 'ALL') params.role = roleFilter
      const res = await api.get('/users', { params })
      return res.data
    },
  })

  const { data: staffList = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
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
  const createAccountMutation = useMutation({
    mutationFn: async (payload: typeof accountForm) => {
      const res = await api.post('/users', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setCreateAccountModalOpen(false)
      setAccountForm({
        email: '',
        password: 'Password@123',
        role: 'therapist',
        phone: '',
        first_name: '',
        last_name: '',
        specialization: '',
        license_number: '',
      })
      alert('User account created successfully')
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to create account')
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, is_active }: { userId: string; is_active: boolean }) => {
      const res = await api.patch(`/users/${userId}/status`, { is_active })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update account status')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const res = await api.post(`/users/${userId}/reset-password`, {
        new_password: newPassword,
      })
      return res.data
    },
    onSuccess: (data: any) => {
      setResetPwModalOpen(false)
      setSelectedUser(null)
      setNewPassword('')
      alert(data?.message || 'Password reset successfully')
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to reset password')
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.delete(`/users/${userId}`)
      return res.data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      alert(data?.message || 'Account removed')
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to delete account')
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
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setLeaveModalOpen(false)
      alert('Leave logged successfully')
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to log leave')
    },
  })

  const authorizeTherapyMutation = useMutation({
    mutationFn: async ({ staffId, therapyId }: any) => {
      const res = await api.post(`/staff/${staffId}/authorize-therapy`, {
        therapy_id: therapyId,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setAuthModalOpen(false)
      alert('Therapy authorization granted')
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to authorize therapy')
    },
  })

  // Admin adjust staff working hours mutation
  const adjustStaffHoursMutation = useMutation({
    mutationFn: async ({ id, isUserId, start, end }: { id: string; isUserId?: boolean; start: string; end: string }) => {
      const url = isUserId ? `/users/${id}/working-hours` : `/staff/${id}/working-hours`
      const res = await api.patch(url, {
        working_hours_start: start,
        working_hours_end: end,
      })
      return res.data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['my-presence'] })
      setAdjustHoursModalOpen(false)
      alert(`Working hours for ${selectedStaffForHours?.name || 'staff'} adjusted to ${data.working_hours_start} - ${data.working_hours_end}`)
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to adjust working hours')
    },
  })

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'doctor':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'therapist':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'receptionist':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'patient':
        return 'bg-teal-50 text-teal-700 border-teal-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="text-[var(--color-brand)]" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">User Accounts & Staff Roster</h1>
          </div>
          <p className="text-sm text-gray-500">
            Admin portal to manage system accounts, deactivate or reset credentials, and oversee Ayurvedic staff.
          </p>
        </div>
        <button
          onClick={() => setCreateAccountModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white rounded-lg text-sm font-semibold shadow-xs transition"
        >
          <Plus size={16} />
          Create New Account
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'accounts'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Users size={16} />
          User Accounts & Access ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'staff'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Award size={16} />
          Clinical Staff & Therapies ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'leave'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <CalendarOff size={16} />
          Leave & Roster Management
        </button>
      </div>

      {/* TAB 1: USER ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchAccount}
                onChange={(e) => setSearchAccount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-gray-500 font-medium">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option value="ALL">All Roles</option>
                <option value="admin">Admin</option>
                <option value="doctor">Doctor</option>
                <option value="therapist">Therapist</option>
                <option value="receptionist">Receptionist</option>
                <option value="patient">Patient</option>
              </select>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            {accountsLoading ? (
              <div className="p-8 text-center text-gray-400">Loading user accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Users className="mx-auto mb-2 text-gray-300" size={36} />
                <p className="font-semibold text-gray-700">No accounts match the criteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Account Holder</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-gray-50/50 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">
                            {acc.first_name || acc.last_name
                              ? `${acc.first_name || ''} ${acc.last_name || ''}`
                              : acc.email.split('@')[0]}
                          </div>
                          {acc.specialization && (
                            <span className="text-xs text-gray-500 block">{acc.specialization}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${getRoleBadge(
                              acc.role
                            )}`}
                          >
                            {acc.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          <div>{acc.email}</div>
                          {acc.phone && <div className="text-gray-400 mt-0.5">{acc.phone}</div>}
                        </td>
                        <td className="py-3.5 px-4">
                          {acc.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 size={12} />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              <XCircle size={12} />
                              Deactivated
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1">
                          {acc.role !== 'patient' && (
                            <button
                              onClick={() => {
                                setSelectedStaffForHours({
                                  id: acc.id,
                                  name: acc.first_name || acc.last_name ? `${acc.first_name || ''} ${acc.last_name || ''}`.trim() : acc.email,
                                  user_id: acc.id,
                                  start: acc.working_hours_start || '09:00',
                                  end: acc.working_hours_end || '18:00',
                                })
                                setStaffHoursForm({
                                  start: acc.working_hours_start || '09:00',
                                  end: acc.working_hours_end || '18:00',
                                })
                                setAdjustHoursModalOpen(true)
                              }}
                              title="Adjust Working Shift Hours"
                              className="p-1.5 text-gray-500 hover:text-[var(--color-brand)] hover:bg-gray-100 rounded-lg transition"
                            >
                              <Clock size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedUser(acc)
                              setResetPwModalOpen(true)
                            }}
                            title="Reset Password"
                            className="p-1.5 text-gray-500 hover:text-[var(--color-brand)] hover:bg-gray-100 rounded-lg transition"
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                userId: acc.id,
                                is_active: !acc.is_active,
                              })
                            }
                            title={acc.is_active ? 'Deactivate Account' : 'Activate Account'}
                            className={`p-1.5 rounded-lg transition ${
                              acc.is_active
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power size={15} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete or disable account "${acc.email}"?`)) {
                                deleteAccountMutation.mutate(acc.id)
                              }
                            }}
                            title="Delete / Remove Account"
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CLINICAL STAFF */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {staffLoading ? (
            <div className="col-span-3 p-12 text-center text-gray-400">Loading staff directory...</div>
          ) : (
            staffList.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                        {member.is_doctor ? <Stethoscope size={18} /> : <UserCheck size={18} />}
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-900 text-sm">
                          {member.is_doctor ? 'Dr. ' : ''}
                          {member.first_name} {member.last_name}
                        </h2>
                        <span className="text-xs text-gray-400">{member.email}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        member.is_doctor
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {member.is_doctor ? 'Doctor / Vaidya' : 'Panchakarma Therapist'}
                    </span>
                  </div>

                  {member.specialization && (
                    <p className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <span className="font-semibold text-gray-700">Specialization:</span> {member.specialization}
                    </p>
                  )}

                  {member.is_therapist && (
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Authorized Therapies
                        </span>
                        <button
                          onClick={() => {
                            setSelectedStaff(member)
                            setAuthModalOpen(true)
                          }}
                          className="text-xs text-[var(--color-brand)] hover:underline font-semibold"
                        >
                          + Authorize
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {member.authorized_therapy_ids.length > 0 ? (
                          member.authorized_therapy_ids.map((tid) => {
                            const th = (therapies as any[]).find((t) => t.id === tid)
                            return (
                              <span
                                key={tid}
                                className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[11px] font-medium border border-emerald-200"
                              >
                                {th ? th.name : tid.slice(0, 6)}
                              </span>
                            )
                          })
                        ) : (
                          <span className="text-xs text-gray-400 italic">No therapies authorized yet</span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Working Shift Hours & Admin Adjust Control */}
                  <div className="mt-3.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Clock size={13} className="text-[var(--color-brand)]" />
                      <span>Shift: <strong className="text-gray-900">{member.working_hours_start || '09:00'} - {member.working_hours_end || '18:00'}</strong></span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStaffForHours({
                          id: member.id,
                          name: `${member.is_doctor ? 'Dr. ' : ''}${member.first_name} ${member.last_name}`,
                          user_id: member.user_id,
                          start: member.working_hours_start || '09:00',
                          end: member.working_hours_end || '18:00',
                        })
                        setStaffHoursForm({
                          start: member.working_hours_start || '09:00',
                          end: member.working_hours_end || '18:00',
                        })
                        setAdjustHoursModalOpen(true)
                      }}
                      className="px-2 py-1 bg-white hover:bg-[var(--color-brand)] text-gray-700 hover:text-white rounded-lg text-[11px] font-semibold border border-gray-200 transition shadow-2xs"
                    >
                      Adjust Time
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                  <button
                    onClick={() => {
                      setSelectedStaff(member)
                      setLeaveModalOpen(true)
                    }}
                    className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-semibold"
                  >
                    <CalendarOff size={13} />
                    Log Leave
                  </button>
                  <span className="text-gray-400 font-mono text-[11px]">ID: {member.id.slice(0, 8)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: LEAVE MANAGEMENT */}
      {activeTab === 'leave' && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs max-w-2xl">
          <h2 className="text-base font-bold text-gray-900 mb-2">Staff Availability & Leave Calendar</h2>
          <p className="text-xs text-gray-500 mb-6">
            Log designated day-offs or emergency leaves for Vaidyas and therapists to automatically exclude them from the AI circadian scheduler.
          </p>
          <div className="space-y-4">
            {staffList.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold text-gray-800">
                    {s.is_doctor ? 'Dr. ' : ''}
                    {s.first_name} {s.last_name}
                  </h3>
                  <p className="text-xs text-gray-500 capitalize">{s.role} • {s.specialization || 'Clinical Staff'}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStaff(s)
                    setLeaveModalOpen(true)
                  }}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold shadow-2xs transition"
                >
                  Schedule Leave
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE ACCOUNT */}
      {createAccountModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setCreateAccountModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Create User Account</h2>
            <p className="text-xs text-gray-500 mb-5">
              Provision a new account with customized role permissions and clinical profile.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createAccountMutation.mutate(accountForm)
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.first_name}
                    onChange={(e) => setAccountForm({ ...accountForm, first_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.last_name}
                    onChange={(e) => setAccountForm({ ...accountForm, last_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="user@ayursutra.com"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Role *</label>
                  <select
                    value={accountForm.role}
                    onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                  >
                    <option value="doctor">Doctor / Vaidya</option>
                    <option value="therapist">Panchakarma Therapist</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">System Administrator</option>
                    <option value="patient">Patient Portal User</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={accountForm.phone}
                    onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              {(accountForm.role === 'doctor' || accountForm.role === 'therapist') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Clinical Specialization / Focus
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Panchakarma Kayachikitsa or Shirodhara"
                    value={accountForm.specialization}
                    onChange={(e) => setAccountForm({ ...accountForm, specialization: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreateAccountModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {resetPwModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setResetPwModalOpen(false)
                setSelectedUser(null)
              }}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 mb-2 text-amber-700">
              <KeyRound size={20} />
              <h2 className="text-lg font-bold text-gray-900">Reset Account Password</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Enter a new password for account <strong className="text-gray-800">{selectedUser.email}</strong>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                resetPasswordMutation.mutate({
                  userId: selectedUser.id,
                  newPassword,
                })
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Password (min 6 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setResetPwModalOpen(false)
                    setSelectedUser(null)
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {resetPasswordMutation.isPending ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LOG LEAVE */}
      {leaveModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setLeaveModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Schedule Staff Leave</h2>
            <p className="text-xs text-gray-500 mb-4">
              Log day off for <strong>{selectedStaff.first_name} {selectedStaff.last_name}</strong>.
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
              className="space-y-4"
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
                  required
                  value={leaveNote}
                  onChange={(e) => setLeaveNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLeaveMutation.isPending}
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold text-sm rounded-xl shadow-xs transition"
                >
                  {addLeaveMutation.isPending ? 'Saving...' : 'Record Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: AUTHORIZE THERAPY */}
      {authModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Authorize Panchakarma Therapy</h2>
            <p className="text-xs text-gray-500 mb-4">
              Authorize <strong>{selectedStaff.first_name} {selectedStaff.last_name}</strong> to perform specialized procedures.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Therapy Procedure</label>
                <select
                  value={selectedTherapyId}
                  onChange={(e) => setSelectedTherapyId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none bg-white"
                >
                  <option value="">-- Choose Therapy --</option>
                  {(therapies as any[]).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.default_duration_minutes} mins)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  disabled={!selectedTherapyId || authorizeTherapyMutation.isPending}
                  onClick={() =>
                    authorizeTherapyMutation.mutate({
                      staffId: selectedStaff.id,
                      therapyId: selectedTherapyId,
                    })
                  }
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {authorizeTherapyMutation.isPending ? 'Authorizing...' : 'Grant Authorization'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADJUST STAFF WORKING HOURS (ADMIN POWER) */}
      {adjustHoursModalOpen && selectedStaffForHours && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setAdjustHoursModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-1 text-[var(--color-brand)]">
              <Clock size={20} />
              <h2 className="text-lg font-bold text-gray-900">Adjust Staff Working Shift</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Admin control: define operational shift start and end times for{' '}
              <strong className="text-gray-900">{selectedStaffForHours.name}</strong>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                adjustStaffHoursMutation.mutate({
                  id: selectedStaffForHours.id,
                  isUserId: !!selectedStaffForHours.user_id && selectedStaffForHours.id === selectedStaffForHours.user_id,
                  start: staffHoursForm.start,
                  end: staffHoursForm.end,
                })
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    required
                    value={staffHoursForm.start}
                    onChange={(e) => setStaffHoursForm({ ...staffHoursForm, start: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shift End Time</label>
                  <input
                    type="time"
                    required
                    value={staffHoursForm.end}
                    onChange={(e) => setStaffHoursForm({ ...staffHoursForm, end: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Shift Templates */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Standard Shift Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStaffHoursForm({ start: '09:00', end: '18:00' })}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-xs font-medium border border-gray-200 transition"
                  >
                    Standard (09:00 - 18:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffHoursForm({ start: '08:00', end: '16:00' })}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-xs font-medium border border-gray-200 transition"
                  >
                    Morning (08:00 - 16:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffHoursForm({ start: '12:00', end: '20:00' })}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-xs font-medium border border-gray-200 transition"
                  >
                    Evening (12:00 - 20:00)
                  </button>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAdjustHoursModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustStaffHoursMutation.isPending}
                  className="px-5 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold text-sm rounded-xl shadow-xs transition"
                >
                  {adjustStaffHoursMutation.isPending ? 'Saving Shift...' : 'Save Working Hours'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
