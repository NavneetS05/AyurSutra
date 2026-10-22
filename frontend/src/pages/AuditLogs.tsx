import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Activity,
  Users,
  CreditCard,
  Calendar,
  Sparkles,
  ChevronRight,
  UserPlus,
  KeyRound,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface AuditLog {
  id: number
  user_id?: string
  user_email?: string
  user_name?: string
  user_role?: string
  action: string
  entity_type: string
  entity_id: string
  detail?: string
  ip_address?: string
  created_at: string
}

interface LoginLog {
  id: number
  user_id?: string
  user_email: string
  user_name: string
  user_role: string
  action: string
  status: string
  ip_address?: string
  detail?: string
  created_at: string
}

interface UserActivitySummary {
  user_id: string
  user_email: string
  user_name: string
  user_role: string
  total_actions: number
  patients_created: number
  consultations_booked: number
  payments_recorded: number
  sessions_recorded: number
  other_actions: number
  last_activity_at?: string
  recent_actions: Array<{
    id: number
    action: string
    entity_type: string
    detail?: string
    created_at?: string
  }>
}

export default function AuditLogs() {
  const [viewMode, setViewMode] = useState<'summary' | 'feed' | 'logins'>('summary')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState('ALL')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // 1. Fetch user activity summaries
  const {
    data: userSummaries = [],
    isLoading: summariesLoading,
    refetch: refetchSummaries,
    isFetching: isFetchingSummaries,
  } = useQuery<UserActivitySummary[]>({
    queryKey: ['audit-user-summary'],
    queryFn: async () => {
      const res = await api.get('/audit-logs/user-summary')
      return res.data
    },
  })

  // 2. Fetch detailed chronological audit logs
  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch: refetchLogs,
    isFetching: isFetchingLogs,
  } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', selectedUserId],
    queryFn: async () => {
      const params: any = { limit: 150 }
      if (selectedUserId) params.user_id = selectedUserId
      const res = await api.get('/audit-logs', { params })
      return res.data
    },
  })

  // 3. Fetch account login logs (Special Section)
  const {
    data: loginLogs = [],
    isLoading: loginLogsLoading,
    refetch: refetchLoginLogs,
    isFetching: isFetchingLoginLogs,
  } = useQuery<LoginLog[]>({
    queryKey: ['audit-login-logs'],
    queryFn: async () => {
      const res = await api.get('/audit-logs/login-logs')
      return res.data
    },
  })

  function refreshAll() {
    refetchSummaries()
    refetchLogs()
    refetchLoginLogs()
  }

  const isRefreshing = isFetchingSummaries || isFetchingLogs || isFetchingLoginLogs

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user_email && log.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.detail && log.detail.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesEntity = selectedEntity === 'ALL' || log.entity_type === selectedEntity
    return matchesSearch && matchesEntity
  })

  const filteredLoginLogs = loginLogs.filter((log) => {
    return (
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.detail && log.detail.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE_PATIENT') || action.includes('REGISTER')) {
      return 'bg-blue-50 text-blue-700 border-blue-200'
    }
    if (action.includes('PAYMENT') || action.includes('BILLING') || action.includes('RECEIPT')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    if (action.includes('CONSULTATION') || action.includes('APPOINTMENT') || action.includes('BOOK')) {
      return 'bg-purple-50 text-purple-700 border-purple-200'
    }
    if (action.includes('SESSION') || action.includes('COMPLETED')) {
      return 'bg-amber-50 text-amber-800 border-amber-200'
    }
    if (action.includes('USER') || action.includes('PASSWORD')) {
      return 'bg-rose-50 text-rose-700 border-rose-200'
    }
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'doctor':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'therapist':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'receptionist':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const entities = ['ALL', ...Array.from(new Set(logs.map((l) => l.entity_type)))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-[var(--color-brand)]" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">Account Activity & Audit Logs</h1>
          </div>
          <p className="text-sm text-gray-500">
            Track actions taken by Receptionists, Doctors, Therapists, and Admins (patients created, appointments booked, payments collected).
          </p>
        </div>
        <button
          onClick={refreshAll}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition shadow-xs disabled:opacity-50"
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh Logs
        </button>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setViewMode('summary')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            viewMode === 'summary'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Users size={16} />
          Account Activity Breakdown ({userSummaries.length} Accounts)
        </button>
        <button
          onClick={() => setViewMode('feed')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            viewMode === 'feed'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Activity size={16} />
          Chronological Event Feed ({filteredLogs.length})
        </button>
        <button
          onClick={() => setViewMode('logins')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-semibold border-b-2 transition ${
            viewMode === 'logins'
              ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <KeyRound size={16} />
          Account Login Logs ({loginLogs.length})
        </button>
      </div>

      {/* VIEW 1: ACCOUNT ACTIVITY SUMMARY */}
      {viewMode === 'summary' && (
        <div className="space-y-4">
          {summariesLoading ? (
            <div className="p-12 text-center text-gray-400">Aggregating account activities...</div>
          ) : userSummaries.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No account activity recorded yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {userSummaries.map((account) => (
                <div
                  key={account.user_id}
                  className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* User Profile Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{account.user_name}</h3>
                        <p className="text-xs text-gray-400">{account.user_email}</p>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${getRoleBadge(
                          account.user_role
                        )}`}
                      >
                        {account.user_role}
                      </span>
                    </div>

                    {/* Operational Activity Metrics */}
                    <div className="grid grid-cols-2 gap-2 my-3">
                      <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-blue-900 font-medium">
                          <UserPlus size={13} className="text-blue-700" />
                          <span>Patients Created</span>
                        </div>
                        <span className="font-bold text-sm text-blue-950">{account.patients_created}</span>
                      </div>

                      <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-purple-900 font-medium">
                          <Calendar size={13} className="text-purple-700" />
                          <span>Appointments Booked</span>
                        </div>
                        <span className="font-bold text-sm text-purple-950">{account.consultations_booked}</span>
                      </div>

                      <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-medium">
                          <CreditCard size={13} className="text-emerald-700" />
                          <span>Payments Logged</span>
                        </div>
                        <span className="font-bold text-sm text-emerald-950">{account.payments_recorded}</span>
                      </div>

                      <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-amber-900 font-medium">
                          <Sparkles size={13} className="text-amber-700" />
                          <span>Sessions Recorded</span>
                        </div>
                        <span className="font-bold text-sm text-amber-950">{account.sessions_recorded}</span>
                      </div>
                    </div>

                    {/* Total Actions & Last Active */}
                    <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
                      <div className="flex justify-between">
                        <span>Total Recorded Events:</span>
                        <strong className="text-gray-900 font-bold">{account.total_actions}</strong>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>Last Active:</span>
                        <span className="text-gray-600">
                          {account.last_activity_at
                            ? new Date(account.last_activity_at).toLocaleString()
                            : 'No recent activity'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Click to filter feed button */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedUserId(account.user_id)
                        setViewMode('feed')
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-gray-50 hover:bg-[var(--color-brand)] text-gray-700 hover:text-white rounded-xl text-xs font-semibold border border-gray-200 transition"
                    >
                      View Account Audit Trail
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CHRONOLOGICAL FEED */}
      {viewMode === 'feed' && (
        <div className="space-y-4">
          {/* Active Filter Pill if user selected */}
          {selectedUserId && (
            <div className="flex items-center justify-between bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
              <span>
                Filtered by User: <strong>{userSummaries.find((u) => u.user_id === selectedUserId)?.user_name || selectedUserId}</strong>
              </span>
              <button
                onClick={() => setSelectedUserId(null)}
                className="text-amber-800 hover:underline font-bold"
              >
                Clear User Filter
              </button>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search action, staff member, email, or detail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={16} className="text-gray-400" />
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {entities.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent === 'ALL' ? 'All Entities' : ent}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Log Stream */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
            {logsLoading ? (
              <div className="p-12 text-center text-gray-400">Loading audit feed...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No logs match your filter criteria.</div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50/60 transition flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-medium">
                        {log.entity_type} #{log.entity_id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                      </span>
                    </div>

                    {log.detail && (
                      <p className="text-xs text-gray-700 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 my-1.5 font-mono">
                        {log.detail}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Initiated by:</span>
                      <strong className="text-gray-800 font-semibold">{log.user_name || 'System'}</strong>
                      {log.user_role && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border capitalize ${getRoleBadge(log.user_role)}`}>
                          {log.user_role}
                        </span>
                      )}
                      {log.user_email && <span className="text-gray-400 font-normal">({log.user_email})</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: ACCOUNT LOGIN LOGS (SPECIAL SECTION) */}
      {viewMode === 'logins' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search by user email, name, role, IP or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
              />
            </div>
            <span className="text-xs text-gray-500">
              Showing {filteredLoginLogs.length} of {loginLogs.length} login attempts
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            {loginLogsLoading ? (
              <div className="p-12 text-center text-gray-400">Loading authentication logs...</div>
            ) : filteredLoginLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No login logs match the search query.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Account User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Authentication Status</th>
                      <th className="py-3 px-4">Client IP</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLoginLogs.map((log) => {
                      const isSuccess = log.status === 'Success'
                      return (
                        <tr key={log.id} className="hover:bg-gray-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">{log.user_name || 'Unknown User'}</div>
                            <div className="text-gray-400 font-mono text-[11px]">{log.user_email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold capitalize ${getRoleBadge(log.user_role)}`}>
                              {log.user_role || 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                isSuccess
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {isSuccess ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-600 text-[11px]">
                            {log.ip_address || '127.0.0.1'}
                          </td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                          </td>
                          <td className="py-3 px-4 text-gray-600 max-w-xs truncate" title={log.detail}>
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
        </div>
      )}
    </div>
  )
}
