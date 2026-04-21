import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Spinner } from 'react-bootstrap'
import { qrApi } from '../api/plants.js'

export default function ScanPage() {
  const { shortCode } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!shortCode) return
    qrApi.scan(shortCode)
      .then(({ plantId }) => {
        navigate('/', { state: { openPlantId: plantId }, replace: true })
      })
      .catch(err => setError(err.message || 'QR code not recognised'))
  }, [shortCode, navigate])

  if (error) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-center">
          <svg className="sa-icon sa-icon-5x text-danger mb-3"><use href="/icons/sprite.svg#leaf" /></svg>
          <h5 className="mb-1">QR Code Not Found</h5>
          <p className="text-muted fs-sm mb-3">{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      <div className="text-center">
        <Spinner className="mb-3" />
        <p className="text-muted fs-sm">Resolving plant…</p>
      </div>
    </div>
  )
}
