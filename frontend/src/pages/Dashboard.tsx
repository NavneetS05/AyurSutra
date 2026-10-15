import { useAuth } from '@/lib/auth'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Users,
  Calendar,
  ClipboardList,
  Sparkles,
  Leaf,
  Stethoscope,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth()

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => (await api.get('/patients/')).data,
  })

  const { data: therapies = [] } = useQuery({
    queryKey: ['therapies'],
    queryFn: async () => (await api.get('/therapies/')).data,
  })

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await api.get('/scheduling/sessions')).data,
  })

  const completedSessions = sessions.filter((s: any) => s.status === 'completed').length
  const completionRate = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#5a6e4d] to-[#6b7f5e] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white mb-2">
            <Sparkles size={13} />
            Ayurveda Clinical Platform
          </span>
          <h1 className="text-2xl font-bold">Welcome back, {user?.email}</h1>
          <p className="text-sm text-emerald-100 mt-1">
            Current Role: <span className="capitalize font-semibold">{user?.role}</span> • Panchakarma Centre Operations
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/consultations"
            className="px-4 py-2 bg-white text-[var(--color-brand-dark)] hover:bg-emerald-50 rounded-lg text-sm font-semibold transition shadow-sm"
          >
            Consultations
          </Link>
          <Link
            to="/schedule"
            className="px-4 py-2 bg-emerald-800/60 hover:bg-emerald-800 text-white rounded-lg text-sm font-medium transition"
          >
            Schedule
          </Link>
        </div>
      </div>

      {/* Dynamic Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-blue-50 text-blue-600">
            <Calendar size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{sessions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Scheduled Sessions</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-emerald-50 text-emerald-600">
            <Users size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{patients.length}</p>
          <p className="text-xs text-gray-500 mt-1">Registered Patients</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-amber-50 text-amber-600">
            <Leaf size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{therapies.length}</p>
          <p className="text-xs text-gray-500 mt-1">Active Therapies in Catalogue</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="inline-flex p-2.5 rounded-xl mb-3 bg-purple-50 text-purple-600">
            <ClipboardList size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {completionRate}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Session Attendance Rate</p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/patients"
          className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform">
              <Users size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Patient Management</h3>
            <p className="text-xs text-gray-500">
              Register patients, view medical history, allergies, and manage patient portal credentials.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:gap-2 transition-all">
            <span>View directory</span>
            <ArrowRight size={14} />
          </div>
        </Link>

        <Link
          to="/consultations"
          className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform">
              <Stethoscope size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Clinical Consultations</h3>
            <p className="text-xs text-gray-500">
              Record Prakriti/Vikriti notes, draft multi-therapy treatment plans, and define custom package pricing.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600 group-hover:gap-2 transition-all">
            <span>Manage plans</span>
            <ArrowRight size={14} />
          </div>
        </Link>

        <Link
          to="/schedule"
          className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl w-fit mb-4 group-hover:scale-105 transition-transform">
              <Clock size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Smart Scheduling Engine</h3>
            <p className="text-xs text-gray-500">
              Conflict-free multi-session allocation based on therapist qualifications, room facilities, and clinic hours.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-amber-600 group-hover:gap-2 transition-all">
            <span>Open schedule</span>
            <ArrowRight size={14} />
          </div>
        </Link>
      </div>
    </div>
  )
}
