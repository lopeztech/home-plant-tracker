import React, { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'plant_tracker_user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  function login(credentialResponse) {
    try {
      // Decode the JWT credential from Google (header.payload.signature)
      const payload = credentialResponse.credential.split('.')[1]
      // Pad base64 string to a multiple of 4 characters
      const padded = payload + '=='.slice(0, (4 - (payload.length % 4)) % 4)
      const decoded = JSON.parse(atob(padded))

      const userData = {
        name: decoded.name,
        email: decoded.email,
        picture: decoded.picture,
        sub: decoded.sub,
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
      setUser(userData)
    } catch (err) {
      console.error('Failed to decode Google credential:', err)
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)

    // Redirect to IAP logout endpoint in production
    if (window.location.hostname !== 'localhost') {
      window.location.href = '/_gcp_iap/clear_login_cookie'
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
