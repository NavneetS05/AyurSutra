import { createContext, useContext, useState, type ReactNode } from 'react'
import api from '@/lib/api'

interface AuthUser { id: string; email: string; role: string }
interface AuthCtx {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', res.data.access_token)
    localStorage.setItem('refresh_token', res.data.refresh_token)
    const me = await api.get('/auth/me')
    localStorage.setItem('user', JSON.stringify(me.data))
    setUser(me.data)
  }

  function logout() {
    localStorage.clear()
    setUser(null)
  }

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
