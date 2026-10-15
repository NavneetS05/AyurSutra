import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { LogOut, Users, Calendar, LayoutDashboard, Leaf, Stethoscope, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'receptionist', 'doctor', 'therapist'] },
  { to: '/portal', label: 'Wellness Portal', icon: Sparkles, roles: ['patient', 'admin', 'doctor'] },
  { to: '/patients', label: 'Patients', icon: Users, roles: ['admin', 'receptionist', 'doctor'] },
  { to: '/consultations', label: 'Consultations', icon: Stethoscope, roles: ['admin', 'receptionist', 'doctor'] },
  { to: '/schedule', label: 'Schedule', icon: Calendar, roles: ['admin', 'receptionist', 'doctor', 'therapist'] },
  { to: '/therapies', label: 'Therapies', icon: Leaf, roles: ['admin', 'doctor'] },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'patient' && location.pathname === '/') {
    return <Navigate to="/portal" replace />
  }

  const visibleNav = navItems.filter((n) => n.roles.includes(user.role))

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">AyurSutra</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
          <p className="text-xs text-gray-400 mt-2 px-3 truncate">{user.email}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
