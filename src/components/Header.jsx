import React, { useRef } from 'react'
import { Upload, Leaf, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Header({ onFloorplanUpload, isAnalysingFloorplan, onOpenSettings }) {
  const { user, logout } = useAuth()
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    onFloorplanUpload(file)
    e.target.value = ''
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shadow-md flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <Leaf size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Plant Tracker</h1>
          <p className="text-xs text-gray-400 leading-tight">Home plant management</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={isAnalysingFloorplan}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">
                {isAnalysingFloorplan ? 'Analysing…' : 'Upload Floorplan'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-7 h-7 rounded-full ring-1 ring-gray-600"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="hidden md:inline text-sm text-gray-300 max-w-[120px] truncate">
                {user.name}
              </span>
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700"
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700"
                title="Sign out"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
