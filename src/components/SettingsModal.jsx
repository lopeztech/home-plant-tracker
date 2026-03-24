import React, { useState, useCallback } from 'react'
import { X, Key, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'

export default function SettingsModal({ currentApiKey, onSave, onClose }) {
  const [key, setKey] = useState(currentApiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const masked = key ? key.slice(0, 7) + '•'.repeat(Math.min(24, key.length - 7)) : ''

  const handleSave = useCallback(() => {
    onSave(key.trim() || null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [key, onSave])

  const handleClear = useCallback(() => {
    setKey('')
  }, [])

  const isValid = key.trim().startsWith('sk-ant-')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-enter w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center">
              <Key size={14} className="text-gray-300" />
            </div>
            <h2 className="text-base font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Anthropic API Key
              </label>
              <p className="text-xs text-gray-500 leading-relaxed">
                Required for AI plant analysis. Your key is stored only in your browser's localStorage and never sent to any server other than Anthropic's API directly.
              </p>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
                placeholder="sk-ant-api03-..."
                value={key}
                onChange={e => setKey(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Validation indicator */}
            {key.trim() && (
              <div className={`flex items-center gap-1.5 text-xs ${isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isValid ? (
                  <>
                    <CheckCircle2 size={13} />
                    Key format looks valid
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} />
                    Key should start with "sk-ant-"
                  </>
                )}
              </div>
            )}

            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Get your API key at console.anthropic.com
              <ExternalLink size={11} />
            </a>
          </div>

          {/* Info box */}
          <div className="p-3 rounded-xl bg-gray-800 border border-gray-700">
            <p className="text-xs text-gray-400 font-medium mb-1">About AI Analysis</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              The AI analysis feature uses Claude Sonnet (claude-sonnet-4-6) to evaluate plant health, maturity, and provide personalised care recommendations from your plant photos. Each analysis uses a small number of API tokens.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800 gap-3">
          {key && (
            <button
              onClick={handleClear}
              className="px-3 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 border border-gray-700 transition-colors"
            >
              Clear Key
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                saved
                  ? 'bg-emerald-700 text-emerald-200'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle2 size={14} />
                  Saved!
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
