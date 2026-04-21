import React, { useState, useEffect, useRef } from 'react'
import { Button, Spinner } from 'react-bootstrap'
import QRCode from 'qrcode'
import { qrApi } from '../api/plants.js'

export default function PlantQRTag({ plant }) {
  const [shortCode, setShortCode] = useState(plant?.shortCode || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)

  const scanUrl = shortCode
    ? `${window.location.origin}/scan/${shortCode}`
    : null

  useEffect(() => {
    if (!shortCode && plant?.id) {
      setLoading(true)
      qrApi.getShortCode(plant.id)
        .then(({ shortCode: code }) => setShortCode(code))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [plant?.id, shortCode])

  useEffect(() => {
    if (scanUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, scanUrl, {
        width: 180,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#1a1a1a', light: '#ffffff' },
      }).catch(() => {})
    }
  }, [scanUrl])

  const handlePrint = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Tag — ${plant.name || plant.species}</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
            .tag { display: inline-flex; flex-direction: column; align-items: center;
                   border: 2px solid #333; border-radius: 8px; padding: 12px; gap: 8px; }
            img { width: 180px; height: 180px; }
            .name { font-size: 14px; font-weight: 600; text-align: center; max-width: 180px; }
            .species { font-size: 11px; color: #555; text-align: center; font-style: italic; max-width: 180px; }
            .code { font-size: 10px; font-family: monospace; color: #333; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="tag">
            <img src="${dataUrl}" alt="QR code" />
            <div class="name">${plant.name || plant.species}</div>
            ${plant.species ? `<div class="species">${plant.species}</div>` : ''}
            <div class="code">${shortCode}</div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `)
    win.document.close()
  }

  if (loading) return <div className="text-center py-3"><Spinner size="sm" /> Loading QR code…</div>
  if (error) return <div className="text-danger fs-xs py-2">{error}</div>

  return (
    <div className="d-flex flex-column align-items-center gap-2 py-2">
      <canvas ref={canvasRef} style={{ borderRadius: 8, border: '1px solid var(--bs-border-color)' }} />
      {shortCode && (
        <>
          <div className="d-flex align-items-center gap-2">
            <code className="fs-xs bg-light rounded px-2 py-1">{shortCode}</code>
            <Button
              variant="outline-secondary"
              size="sm"
              className="fs-xs"
              onClick={() => navigator.clipboard?.writeText(scanUrl)}
            >
              Copy link
            </Button>
          </div>
          <Button variant="outline-primary" size="sm" onClick={handlePrint}>
            Print QR tag
          </Button>
          <p className="text-muted fs-xs text-center mb-0" style={{ maxWidth: 220 }}>
            Scan with any QR reader or camera app to jump directly to this plant record.
          </p>
        </>
      )}
    </div>
  )
}
