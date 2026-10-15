import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  TrendingUp,
  IndianRupee,
  Users,
  DoorOpen,
  PieChart as PieIcon,
  BarChart3,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const COLORS = ['#6b7f5e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981']

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const res = await api.get('/analytics/summary')
      return res.data
    },
    refetchInterval: 30000,
  })

  if (isLoading) {
    return <div className="p-12 text-center text-gray-400">Loading clinic utilization metrics...</div>
  }

  if (!analytics) {
    return <div className="p-8 text-center text-gray-400">No analytics data available.</div>
  }

  const { overview, therapy_popularity, therapist_workload, room_utilization, status_distribution } = analytics

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Clinic Analytics & Utilization</h1>
        <p className="text-sm text-gray-500">
          Resource occupancy, therapist workload, therapy demand distribution, and commercial tracking
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Attendance Rate</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{overview.attendance_rate}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {overview.completed_sessions} of {overview.total_sessions} completed
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Invoiced</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <IndianRupee size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800">₹{overview.total_invoiced.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Across customized packages</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Collected</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <IndianRupee size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700">₹{overview.total_collected.toLocaleString()}</p>
          <p className="text-xs text-emerald-600 mt-1">Realized revenue</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Balance</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <IndianRupee size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700">₹{overview.balance_pending.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Outstanding receivables</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Therapy Demand */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-emerald-700" />
            <h3 className="font-bold text-gray-800 text-sm">Therapy Catalogue Demand (Sessions Booked)</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={therapy_popularity} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill="#6b7f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Session Status Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon size={18} className="text-blue-600" />
            <h3 className="font-bold text-gray-800 text-sm">Session Status Distribution</h3>
          </div>
          <div className="h-64 w-full">
            {status_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={status_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {status_distribution.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No session data to display
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operational Utilization Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room Utilization */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <DoorOpen size={18} className="text-amber-600" />
            <h3 className="font-bold text-gray-800 text-sm">Room & Suite Occupancy Density</h3>
          </div>
          <div className="space-y-4">
            {room_utilization.map((room: any) => {
              const maxBookings = Math.max(...room_utilization.map((r: any) => r.bookings), 1)
              const pct = Math.round((room.bookings / maxBookings) * 100)
              return (
                <div key={room.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>{room.name}</span>
                    <span>{room.bookings} Bookings</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Therapist Workload */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-purple-600" />
            <h3 className="font-bold text-gray-800 text-sm">Therapist Workload & Performance</h3>
          </div>
          <div className="space-y-4">
            {therapist_workload.map((t: any) => {
              const compPct = t.assigned > 0 ? Math.round((t.completed / t.assigned) * 100) : 0
              return (
                <div key={t.name} className="p-3 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-800">{t.name}</span>
                    <span className="text-gray-500">
                      {t.completed} of {t.assigned} completed ({compPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${compPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
