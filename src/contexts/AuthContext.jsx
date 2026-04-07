import React, { createContext, useContext, useState, useEffect } from 'react'
import { setApiCredential } from '../api/plants.js'

const STORAGE_KEY = 'plant_tracker_user'
const GUEST_USER = { name: 'Guest', email: '', picture: null, sub: 'guest', isGuest: true }

function isCredentialExpired(credential) {
  try {
    const payload = credential.split('.')[1]
    const padded = payload + '=='.slice(0, (4 - (payload.length % 4)) % 4)
    const decoded = JSON.parse(atob(padded))
    // Expired if `exp` is in the past (with 60s buffer)
    return !decoded.exp || decoded.exp * 1000 < Date.now() - 60_000
  } catch {
    return true
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.isGuest) {
          setUser(GUEST_USER)
        } else if (parsed.credential && !isCredentialExpired(parsed.credential)) {
          setApiCredential(parsed.credential)
          setUser(parsed)
        } else {
          // Credential missing or expired — clear stale session
          localStorage.removeItem(STORAGE_KEY)
        }
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
        credential: credentialResponse.credential,
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
      setApiCredential(credentialResponse.credential)
      setUser(userData)
    } catch (err) {
      console.error('Failed to decode Google credential:', err)
    }
  }

  function loginAsGuest() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(GUEST_USER))
    setUser(GUEST_USER)
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setApiCredential(null)

    // Clear Google's cached account selection so the account picker appears on next login
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }

    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginAsGuest,
        logout,
        isAuthenticated: !!user,
        isGuest: !!user?.isGuest,
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
