import React from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext.jsx'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function LoginPage() {
  const { login, loginAsGuest } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 px-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Icon */}
        <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/40">
          <span role="img" aria-label="plant" className="text-4xl select-none">
            🌿
          </span>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">Plant Tracker</h1>
          <p className="mt-1 text-gray-400 text-sm">Your personal plant care companion</p>
        </div>

        {/* Sign-in card */}
        <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center gap-5 shadow-xl">
          <p className="text-gray-400 text-sm text-center">Sign in to access your plants</p>

          {CLIENT_ID ? (
            <GoogleLogin
              onSuccess={login}
              onError={() => console.error('Google Sign-In failed')}
              theme="filled_black"
              shape="rectangular"
              size="large"
              text="signin_with"
              width="280"
            />
          ) : (
            <div className="text-center p-4 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-300 text-xs leading-relaxed">
              <p className="font-semibold mb-1">Configuration required</p>
              <p>
                Set <code className="font-mono bg-amber-900/50 px-1 py-0.5 rounded">VITE_GOOGLE_CLIENT_ID</code> in
                your <code className="font-mono bg-amber-900/50 px-1 py-0.5 rounded">.env.local</code> file.
              </p>
            </div>
          )}

          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-gray-600 text-xs">or</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <button
            onClick={loginAsGuest}
            className="w-full py-2.5 px-4 rounded-lg border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-800 hover:border-gray-600 transition-colors"
          >
            Continue as Guest
          </button>
        </div>

        <p className="text-gray-600 text-xs text-center">
          Guest mode uses sample data and does not save changes.
        </p>
      </div>
    </div>
  )
}
