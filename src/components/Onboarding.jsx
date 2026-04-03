import React, { useState, useEffect } from 'react'
import { Upload, Plus, Droplets, ChevronRight, X } from 'lucide-react'

const STEPS = [
  {
    id: 'upload',
    icon: Upload,
    title: 'Upload your floorplan',
    description: 'Start by uploading a photo of your floorplan. Our AI will identify rooms automatically.',
  },
  {
    id: 'add',
    icon: Plus,
    title: 'Add your plants',
    description: 'Click anywhere on the floorplan to place a plant, or use the Add Plant button.',
  },
  {
    id: 'water',
    icon: Droplets,
    title: 'Track watering',
    description: 'Keep your plants healthy by logging when you water them. We\'ll remind you when they\'re due.',
  },
]

const STORAGE_KEY = 'plant_tracker_onboarding_done'

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!visible) return null

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div className="animate-fade-in-up w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--tw-gray-900) 0%, var(--surface-gradient-end) 100%)' }}>
        {/* Progress bar */}
        <div className="flex gap-1 px-5 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-gray-800'}`}
            />
          ))}
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-900/60 to-emerald-950/60 border border-emerald-900/40 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-950/20">
              <Icon size={22} className="text-emerald-400" />
            </div>
            <button
              onClick={dismiss}
              className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
              aria-label="Skip onboarding"
            >
              <X size={16} />
            </button>
          </div>

          <h3 className="text-base font-semibold text-gray-100 mt-4">{current.title}</h3>
          <p className="text-sm text-gray-400 mt-1 leading-relaxed">{current.description}</p>
        </div>

        <div className="flex items-center justify-between px-5 pb-5">
          <button
            onClick={dismiss}
            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            {step < STEPS.length - 1 ? (
              <>Next <ChevronRight size={14} /></>
            ) : (
              'Get started'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
