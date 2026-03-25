import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Loader2, Sparkles, AlertCircle, X, Camera } from 'lucide-react'

const HEALTH_COLORS = {
  Excellent: { bg: 'bg-emerald-900', text: 'text-emerald-300', border: 'border-emerald-700' },
  Good: { bg: 'bg-green-900', text: 'text-green-300', border: 'border-green-700' },
  Fair: { bg: 'bg-yellow-900', text: 'text-yellow-300', border: 'border-yellow-700' },
  Poor: { bg: 'bg-red-900', text: 'text-red-300', border: 'border-red-700' },
}

const MATURITY_COLORS = {
  Seedling: { bg: 'bg-cyan-900', text: 'text-cyan-300', border: 'border-cyan-700' },
  Young: { bg: 'bg-blue-900', text: 'text-blue-300', border: 'border-blue-700' },
  Mature: { bg: 'bg-violet-900', text: 'text-violet-300', border: 'border-violet-700' },
  Established: { bg: 'bg-purple-900', text: 'text-purple-300', border: 'border-purple-700' },
}

function Badge({ label, value, colorMap }) {
  const colors = colorMap[value] || { bg: 'bg-gray-800', text: 'text-gray-300', border: 'border-gray-600' }
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
      <span className="text-gray-500">{label}:</span>
      <span>{value}</span>
    </div>
  )
}

// Reads a File or fetches a URL and returns a base64 data URI for the Claude API
async function toBase64(fileOrUrl) {
  if (fileOrUrl instanceof File) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(fileOrUrl)
    })
  }
  // GCS URL — fetch the bytes then convert
  const res = await fetch(fileOrUrl)
  const blob = await res.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.readAsDataURL(blob)
  })
}

export default function ImageAnalyser({ apiKey, initialImage, onAnalysisComplete, onImageChange }) {
  // previewSrc: object URL (blob:) for newly selected files, or GCS URL for existing images
  const [previewSrc, setPreviewSrc] = useState(initialImage || null)
  const [imageFile, setImageFile] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  // Revoke object URLs when they're replaced or the component unmounts
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file.')
      return
    }
    setError(null)
    setAnalysisResult(null)
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setPreviewSrc(url)
    setImageFile(file)
    onImageChange?.(file)
  }, [onImageChange])

  const handleFileInput = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file)
    e.target.value = ''
  }, [loadImage])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadImage(file)
  }, [loadImage])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleAnalyse = useCallback(async () => {
    if (!previewSrc || !apiKey) return
    setIsAnalysing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const base64DataUri = await toBase64(imageFile || previewSrc)
      const [header, data] = base64DataUri.split(',')
      const mimeMatch = header.match(/data:([^;]+);/)
      const mediaType = mimeMatch ? mimeMatch[1] : 'image/jpeg'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data },
                },
                {
                  type: 'text',
                  text: `Analyse this plant image. Provide:
1. Health status: Excellent/Good/Fair/Poor with brief reason
2. Maturity: Seedling/Young/Mature/Established
3. Top 3 care recommendations

Respond ONLY with valid JSON in this exact format:
{"health": "Good", "healthReason": "Brief reason here", "maturity": "Mature", "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]}`,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.error?.message || `API error: ${response.status}`)
      }

      const result = await response.json()
      const text = result.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse AI response')

      const parsed = JSON.parse(jsonMatch[0])
      if (!parsed.health || !parsed.maturity) throw new Error('Incomplete response from AI')

      setAnalysisResult(parsed)
      onAnalysisComplete?.(parsed)
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.')
    } finally {
      setIsAnalysing(false)
    }
  }, [previewSrc, imageFile, apiKey, onAnalysisComplete])

  const handleRemoveImage = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setPreviewSrc(null)
    setImageFile(null)
    setAnalysisResult(null)
    setError(null)
    onImageChange?.(null)
  }, [onImageChange])

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
        Plant Photo
      </label>

      {!previewSrc ? (
        <div
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            isDragging
              ? 'border-emerald-500 bg-emerald-950/30'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
            <Camera size={18} className="text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-300">Drop a photo here</p>
            <p className="text-xs text-gray-500 mt-0.5">or click to browse</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
            <img
              src={previewSrc}
              alt="Plant"
              className="w-full h-40 object-contain"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-900/80 hover:bg-gray-900 flex items-center justify-center border border-gray-700 transition-colors"
              title="Remove image"
            >
              <X size={12} className="text-gray-300" />
            </button>
          </div>

          {!analysisResult && (
            <button
              onClick={handleAnalyse}
              disabled={isAnalysing || !apiKey}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isAnalysing || !apiKey
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              }`}
              title={!apiKey ? 'Set your Anthropic API key in Settings first' : ''}
            >
              {isAnalysing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Analyse with AI
                  {!apiKey && <span className="text-xs">(API key required)</span>}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950 border border-red-800">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {analysisResult && (
        <div className="space-y-3 p-3 rounded-xl bg-gray-800 border border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">AI Analysis</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge label="Health" value={analysisResult.health} colorMap={HEALTH_COLORS} />
            <Badge label="Maturity" value={analysisResult.maturity} colorMap={MATURITY_COLORS} />
          </div>

          {analysisResult.healthReason && (
            <p className="text-xs text-gray-400 leading-relaxed">{analysisResult.healthReason}</p>
          )}

          {analysisResult.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">Care recommendations:</p>
              <ul className="space-y-1">
                {analysisResult.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => { setAnalysisResult(null); setError(null) }}
            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            Re-analyse
          </button>
        </div>
      )}
    </div>
  )
}
