import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, User } from '../services/api'

interface AuthContextType {
  user: User | null
  loading: boolean
  checkAuth: () => Promise<void>
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  
  // Wrapper to ensure loading state is updated when user is set directly
  const setUserWithLoading = (newUser: User | null) => {
    setUser(newUser)
    setLoading(false)
  }

  const checkAuth = async (retryCount = 0) => {
    try {
      const currentUser = await authApi.getCurrentUser()
      setUser(currentUser)
      setLoading(false)
    } catch (error) {
      // If we get a 401 and haven't retried yet, wait a bit and retry (cookie might not be ready)
      if (retryCount < 2 && error instanceof Error && error.message === 'Not authenticated') {
        // Wait 300ms, 600ms for retries to give cookie time to be processed
        await new Promise(resolve => setTimeout(resolve, 300 * (retryCount + 1)))
        return checkAuth(retryCount + 1)
      }
      setUser(null)
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    // Small delay on initial mount to avoid race conditions with cookie setting
    const timer = setTimeout(() => {
      checkAuth()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, checkAuth, setUser: setUserWithLoading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

