import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  LogOut,
  Users,
  Calendar,
  LayoutDashboard,
  Leaf,
  Stethoscope,
  Sparkles,
  BarChart3,
  ShieldCheck,
  DoorClosed,
  UserCheck,
  Power,
  Clock,
  X,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  User as UserIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'receptionist', 'doctor', 'therapist'] },
  { to: '/portal', label: 'Wellness Portal', icon: Sparkles, roles: ['patient', 'admin', 'doctor'] },
  { to: '/patients', label: 'Patients', icon: Users, roles: ['admin', 'receptionist', 'doctor'] },
  { to: '/consultations', label: 'Consultations', icon: Stethoscope, roles: ['admin', 'receptionist', 'doctor'] },
  { to: '/schedule', label: 'Schedule', icon: Calendar, roles: ['admin', 'receptionist', 'doctor', 'therapist'] },
  { to: '/therapies', label: 'Therapies', icon: Leaf, roles: ['admin', 'doctor'] },
  { to: '/rooms', label: 'Rooms & Suites', icon: DoorClosed, roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/staff', label: 'Staff & Vaidyas', icon: UserCheck, roles: ['admin', 'doctor', 'receptionist'] },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'doctor'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck, roles: ['admin'] },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()
  const [hoursModalOpen, setHoursModalOpen] = useState(false)
  const [hoursForm, setHoursForm] = useState({ start: '09:00', end: '18:00' })
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [loginSearchTerm, setLoginSearchTerm] = useState('')

  // Live Indian Standard Time (IST) clock
  const [currentIstTime, setCurrentIstTime] = useState(() =>
    new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIstTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Query User Presence & Shift Hours
  const { data: presence, refetch: refetchPresence } = useQuery({
    queryKey: ['my-presence'],
    queryFn: async () => {
      const res = await api.get('/users/me/presence')
      return res.data
    },
    enabled: !!user,
  })

  // Query Login Logs for Admin Profile (Special Section)
  const {
    data: loginLogs = [],
    isLoading: loginLogsLoading,
    refetch: refetchLoginLogs,
    isFetching: isFetchingLoginLogs,
  } = useQuery({
    queryKey: ['admin-profile-login-logs'],
    queryFn: async () => {
      const res = await api.get('/audit-logs/login-logs')
      return res.data
    },
    enabled: profileModalOpen && user?.role === 'admin',
  })

  // Mutation to toggle presence and update hours
  const updatePresenceMutation = useMutation({
    mutationFn: async (payload: { is_online?: boolean; working_hours_start?: string; working_hours_end?: string }) => {
      const res = await api.patch('/users/me/presence', payload)
      return res.data
    },
    onSuccess: () => {
      refetchPresence()
      queryClient.invalidateQueries({ queryKey: ['my-presence'] })
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setHoursModalOpen(false)
    },
  })

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'patient' && location.pathname === '/') {
    return <Navigate to="/portal" replace />
  }

  const visibleNav = navItems.filter((n) => n.roles.includes(user.role))
  const isOnline = presence?.is_online ?? true
  const whStart = presence?.working_hours_start || '09:00'
  const whEnd = presence?.working_hours_end || '18:00'

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center shadow-xs">
              <span className="text-white text-base font-bold">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">AyurSutra</p>
              <p className="text-[11px] text-gray-400 capitalize font-medium">{user.role} Desk</p>
            </div>
          </div>

          {/* Live Indian Standard Time (IST) Clock */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono mt-3 bg-emerald-50/80 border border-emerald-200/70 px-2.5 py-1.5 rounded-xl justify-between shadow-2xs">
            <span className="flex items-center gap-1 text-emerald-800 font-semibold">
              <Clock size={12} className="text-emerald-700" />
              IST Clock
            </span>
            <span className="font-bold text-emerald-950">{currentIstTime}</span>
          </div>

          {/* Live Online / Offline Presence & Shift Controls */}
          {user.role !== 'patient' && (
            <div className="mt-3.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  {isOnline ? 'Online (On Duty)' : 'Offline (Away)'}
                </span>
                <button
                  onClick={() =>
                    updatePresenceMutation.mutate({ is_online: !isOnline })
                  }
                  title={isOnline ? 'Mark as Offline' : 'Mark as Online'}
                  className={`p-1 rounded-md transition ${
                    isOnline
                      ? 'text-emerald-700 hover:bg-emerald-100'
                      : 'text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Power size={13} />
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60">
                <span className="flex items-center gap-1">
                  <Clock size={11} className="text-gray-400" />
                  Hours: {whStart} - {whEnd}
                </span>
                <button
                  onClick={() => {
                    setHoursForm({ start: whStart, end: whEnd })
                    setHoursModalOpen(true)
                  }}
                  className="text-[var(--color-brand)] font-semibold hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-[var(--color-brand)] text-white shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 bg-white space-y-2">
          {/* Profile Trigger Button */}
          <button
            onClick={() => setProfileModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200/80 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-bold">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-semibold text-gray-900 truncate leading-tight">
                {user.role === 'admin' ? 'Admin Profile' : 'My Profile'}
              </p>
              <p className="text-[10px] text-gray-400 capitalize">{user.role} Desk</p>
            </div>
            {user.role === 'admin' && (
              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md font-bold">
                Logs
              </span>
            )}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>

      {/* EDIT WORKING HOURS MODAL */}
      {hoursModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setHoursModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-1 text-[var(--color-brand)]">
              <Clock size={18} />
              <h2 className="text-base font-bold text-gray-900">Set Account Working Hours</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Configure your daily shift hours to indicate your availability on the clinic roster.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                updatePresenceMutation.mutate({
                  working_hours_start: hoursForm.start,
                  working_hours_end: hoursForm.end,
                })
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Shift Start Time</label>
                <input
                  type="time"
                  required
                  value={hoursForm.start}
                  onChange={(e) => setHoursForm({ ...hoursForm, start: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Shift End Time</label>
                <input
                  type="time"
                  required
                  value={hoursForm.end}
                  onChange={(e) => setHoursForm({ ...hoursForm, end: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setHoursModalOpen(false)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePresenceMutation.isPending}
                  className="px-4 py-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  {updatePresenceMutation.isPending ? 'Saving...' : 'Update Hours'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN / USER PROFILE & SPECIAL LOGIN LOGS MODAL */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-bold text-lg">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {user.role === 'admin' ? 'Administrator Profile & Security' : 'Staff Profile'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Account credentials, shift availability, and clinic security access audit.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Account Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <UserIcon size={14} className="text-gray-400" />
                    <span>Account Identity</span>
                  </div>
                  <p className="font-bold text-gray-900 text-sm truncate">{user.email}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 capitalize">
                    {user.role} Role
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <Power size={14} className={isOnline ? 'text-emerald-500' : 'text-gray-400'} />
                    <span>Duty Presence</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-gray-900 text-sm">
                      {isOnline ? 'Active Online' : 'Offline (Away)'}
                    </span>
                    <button
                      onClick={() => updatePresenceMutation.mutate({ is_online: !isOnline })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                        isOnline
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {isOnline ? 'Mark Away' : 'Go Online'}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <Clock size={14} className="text-gray-400" />
                    <span>Shift Working Hours</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-gray-900 text-sm">
                      {whStart} - {whEnd}
                    </span>
                    <button
                      onClick={() => {
                        setHoursForm({ start: whStart, end: whEnd })
                        setHoursModalOpen(true)
                      }}
                      className="text-xs text-[var(--color-brand)] font-semibold hover:underline"
                    >
                      Edit Hours
                    </button>
                  </div>
                </div>
              </div>

              {/* SPECIAL SECTION: ACCOUNT LOGIN LOGS (EXCLUSIVELY FOR ADMIN PROFILE) */}
              {user.role === 'admin' && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="text-purple-600" size={18} />
                      <h3 className="font-bold text-gray-900 text-sm">Account Login Logs & Security History</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
                        <input
                          type="text"
                          placeholder="Filter login attempts..."
                          value={loginSearchTerm}
                          onChange={(e) => setLoginSearchTerm(e.target.value)}
                          className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none w-48 sm:w-60"
                        />
                      </div>
                      <button
                        onClick={() => refetchLoginLogs()}
                        disabled={isFetchingLoginLogs}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                        title="Refresh Logs"
                      >
                        <RefreshCw size={14} className={isFetchingLoginLogs ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {loginLogsLoading ? (
                    <div className="p-8 text-center text-xs text-gray-400">Loading live authentication logs...</div>
                  ) : (loginLogs as any[]).length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">No login records found.</div>
                  ) : (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Account</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">IP Address</th>
                            <th className="py-2.5 px-3">Timestamp</th>
                            <th className="py-2.5 px-3">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(loginLogs as any[])
                            .filter((log) => {
                              return (
                                !loginSearchTerm ||
                                log.user_email?.toLowerCase().includes(loginSearchTerm.toLowerCase()) ||
                                log.user_name?.toLowerCase().includes(loginSearchTerm.toLowerCase()) ||
                                log.user_role?.toLowerCase().includes(loginSearchTerm.toLowerCase()) ||
                                log.status?.toLowerCase().includes(loginSearchTerm.toLowerCase()) ||
                                (log.ip_address && log.ip_address.toLowerCase().includes(loginSearchTerm.toLowerCase())) ||
                                (log.detail && log.detail.toLowerCase().includes(loginSearchTerm.toLowerCase()))
                              )
                            })
                            .map((log: any) => {
                              const isSuccess = log.status === 'Success'
                              return (
                                <tr key={log.id} className="hover:bg-gray-50/70 transition">
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-gray-900">{log.user_name || 'Staff User'}</div>
                                    <div className="text-gray-400 font-mono text-[10px]">{log.user_email}</div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                                      {log.user_role || 'Staff'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                        isSuccess
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-rose-50 text-rose-700 border-rose-200'
                                      }`}
                                    >
                                      {isSuccess ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-gray-600 text-[10px]">
                                    {log.ip_address || '127.0.0.1'}
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-500 text-[11px] whitespace-nowrap">
                                    {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-600 text-[11px] max-w-xs truncate" title={log.detail}>
                                    {log.detail || '-'}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE LOCKOUT SCREEN (Blocks all features until marked online) */}
      {user.role !== 'patient' && !isOnline && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-8 text-center text-white shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Offline Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              OFFLINE • OFF DUTY
            </div>

            {/* Power / Lock Icon */}
            <div className="relative mx-auto w-20 h-20 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/20 animate-pulse" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
                <Power size={32} />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Account is Currently Offline</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Your account is marked as <strong className="text-slate-200">Offline</strong>. All clinical platform features, patient records, consultations, and operations are strictly locked out while you are away.
            </p>

            {/* Account Details */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 mb-6 text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Account:</span>
                <span className="font-semibold text-slate-200">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="font-semibold text-emerald-400 capitalize">{user.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Configured Shift:</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Clock size={12} className="text-slate-400" />
                  {whStart} - {whEnd}
                </span>
              </div>
            </div>

            {/* THE ONLY FEATURE / ACTION: GO ONLINE */}
            <button
              onClick={() => updatePresenceMutation.mutate({ is_online: true })}
              disabled={updatePresenceMutation.isPending}
              className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Power size={18} />
              {updatePresenceMutation.isPending ? 'Marking Account Online...' : 'Go Online (Start Duty & Unlock Platform)'}
            </button>

            {/* Sign Out Option */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex justify-center">
              <button
                onClick={logout}
                className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5"
              >
                <LogOut size={13} />
                Sign Out of Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
