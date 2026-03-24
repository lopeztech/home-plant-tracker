import React from 'react'
import { Settings, Plus, Leaf } from 'lucide-react'

export default function Header({ onAddPlant, onOpenSettings, apiKeySet }) {
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
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
          title="Settings & API Key"
        >
          <Settings size={15} />
          <span className="hidden sm:inline">Settings</span>
          {!apiKeySet && (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="API key not set" />
          )}
        </button>

        <button
          onClick={onAddPlant}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-medium"
        >
          <Plus size={15} />
          <span>Add Plant</span>
        </button>
      </div>
    </header>
  )
}
