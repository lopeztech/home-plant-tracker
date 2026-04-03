import { Leaf, Settings, BarChart2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Header({ onOpenSettings, onOpenAnalytics }) {
  const { user } = useAuth()

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
            onClick={onOpenAnalytics}
            className={iconBtn}
            title="Analytics"
            aria-label="Analytics"
          >
            <BarChart2 size={16} />
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
