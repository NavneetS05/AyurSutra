import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import AppLayout from '@/layouts/AppLayout'
import LoginPage from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Patients from '@/pages/Patients'
import Therapies from '@/pages/Therapies'
import Schedule from '@/pages/Schedule'
import Consultations from '@/pages/Consultations'
import PatientPortal from '@/pages/PatientPortal'
import Analytics from '@/pages/Analytics'
import AuditLogs from '@/pages/AuditLogs'
import Rooms from '@/pages/Rooms'
import Staff from '@/pages/Staff'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="portal" element={<PatientPortal />} />
              <Route path="patients" element={<Patients />} />
              <Route path="consultations" element={<Consultations />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="therapies" element={<Therapies />} />
              <Route path="rooms" element={<Rooms />} />
              <Route path="staff" element={<Staff />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="audit-logs" element={<AuditLogs />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
