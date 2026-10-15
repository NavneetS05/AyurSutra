import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ShieldCheck, Search, Filter, RefreshCw, Clock, UserCheck, Activity } from 'lucide-react'

interface AuditLog {
  id: number
  user_id?: string
  user_email?: string
  user_name?: string
  action: string
  entity_type: string
  entity_id: string
  detail?: string
  ip_address?: string
  created_at: string
}

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState('ALL')

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await api.get('/audit-logs?limit=100')
      return res.data
    },
  })

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user_email && log.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.detail && log.detail.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesEntity = selectedEntity === 'ALL' || log.entity_type === selectedEntity
    return matchesSearch && matchesEntity
  })

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN')) {
      return 'bg-blue-50 text-blue-700 border-blue-200'
    }
    if (action.includes('PAYMENT')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    if (action.includes('PLAN') || action.includes('FINALIZE')) {
      return 'bg-purple-50 text-purple-700 border-purple-200'
    }
    if (action.includes('RESCHEDULE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }
    if (action.includes('COMPLETED') || action.includes('CHECK_IN')) {
      return 'bg-teal-50 text-teal-700 border-teal-200'
    }
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const entities = ['ALL', ...Array.from(new Set(logs.map((l) => l.entity_type)))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-[var(--color-brand)]" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">System Audit Logs</h1>
          </div>
          <p className="text-sm text-gray-500">
            Immutable, compliance-ready audit trail for clinical operations, billing events, and security access.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          Refresh Feed
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Search by action, user email, staff name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={16} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity:</span>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-sm px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          >
            {entities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Activity className="mx-auto mb-2 text-gray-300" size={32} />
            No audit events matched your search filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Actor / User</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Target Entity</th>
                  <th className="px-5 py-3">Details / Context</th>
                  <th className="px-5 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock size={13} className="text-gray-400" />
                        {new Date(log.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {log.user_email ? (
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-[var(--color-brand)]" />
                          <div>
                            <span className="block font-semibold text-gray-800 text-xs">
                              {log.user_name || 'Staff User'}
                            </span>
                            <span className="block text-[11px] text-gray-400">{log.user_email}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">System Automation</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-gray-600">
                      <span className="font-semibold text-gray-700">{log.entity_type}</span>
                      <span className="text-gray-400 block text-[10px]">
                        ID: {log.entity_id?.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-700 max-w-xs truncate">
                      {log.detail || '—'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-gray-400">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
