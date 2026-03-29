import React, { useRef } from 'react'
import { Upload, Leaf, Settings, Calendar } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Header({ onFloorplanUpload, isAnalysingFloorplan, onOpenSettings, onOpenCalendar }) {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    onFloorplanUpload(file)
    e.target.value = ''
  }

  const iconBtn = "p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"

  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <Leaf size={18} className="text-white" />
        </div>
        <h1 className="text-base font-bold text-white leading-tight">Plant Tracker</h1>
      </div>

      {user && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalysingFloorplan}
            className={`${iconBtn} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isAnalysingFloorplan ? 'Analysing…' : 'Upload floorplan'}
            aria-label="Upload floorplan"
          >
            <Upload size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={onOpenCalendar}
            className={iconBtn}
            title="Care schedule"
            aria-label="Care schedule"
          >
            <Calendar size={16} />
          </button>

          <button
            onClick={onOpenSettings}
            className={iconBtn}
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>

          {user.picture && (
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 rounded-full ring-1 ring-gray-600 ml-1"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      )}
    </header>
  )
}
