import { useState, useEffect, useCallback } from 'react'
import { Button, Form, Badge, InputGroup, FormControl, Modal } from 'react-bootstrap'
import { useAuth } from '../contexts/AuthContext.jsx'
import { marketplaceApi } from '../api/plants.js'

const KIND_LABELS = { cutting: 'Cutting', division: 'Division', seed: 'Seed', mature: 'Mature plant', surplus: 'Surplus' }
const KIND_COLORS = { cutting: 'success', division: 'info', seed: 'warning', mature: 'primary', surplus: 'secondary' }

function ListingCard({ listing, onClaim, onReport }) {
  const [claimed, setClaimed] = useState(listing.status === 'claimed')
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)

  const handleClaim = async () => {
    try { await onClaim(listing.id); setClaimed(true) } catch {}
  }

  const handleReport = async () => {
    try { await onReport(listing.id, reportReason); setReportSent(true); setReporting(false) } catch {}
  }

  return (
    <div className="card h-100" data-testid={`listing-${listing.id}`}>
      {listing.imageUrls?.[0] && (
        <img src={listing.imageUrls[0]} className="card-img-top" alt={listing.species} style={{ height: 160, objectFit: 'cover' }} />
      )}
      <div className="card-body d-flex flex-column gap-2">
        <div className="d-flex justify-content-between align-items-start">
          <h6 className="mb-0 fw-semibold">{listing.species}</h6>
          <Badge bg={KIND_COLORS[listing.kind] || 'secondary'} className="fs-xs">{KIND_LABELS[listing.kind] || listing.kind}</Badge>
        </div>
        {listing.description && <p className="text-muted fs-sm mb-0">{listing.description}</p>}
        <div className="text-muted fs-xs">
          <svg className="sa-icon me-1" style={{ width: 10, height: 10 }} aria-hidden="true"><use href="/icons/sprite.svg#map-pin"></use></svg>
          {listing.outwardCode}
          {listing.ownerDisplayName && <span className="ms-2">· {listing.ownerDisplayName}</span>}
        </div>
        {listing.suggestedDonation && (
          <div className="fs-xs text-success fw-medium">Suggested donation: {listing.suggestedDonation}</div>
        )}
        <div className="d-flex gap-1 mt-auto">
          {!claimed ? (
            <Button size="sm" variant="primary" onClick={handleClaim} disabled={claimed} className="flex-grow-1">
              I&apos;m interested
            </Button>
          ) : (
            <span className="text-muted fs-sm">Claimed</span>
          )}
          {!reportSent && (
            <Button size="sm" variant="link" className="text-muted p-0 fs-xs" onClick={() => setReporting(true)}>
              Report
            </Button>
          )}
        </div>
      </div>

      {reporting && (
        <Modal show onHide={() => setReporting(false)} size="sm">
          <Modal.Header closeButton><Modal.Title className="fs-sm">Report listing</Modal.Title></Modal.Header>
          <Modal.Body>
            <Form.Control as="textarea" rows={3} placeholder="Reason for report" value={reportReason}
              onChange={(e) => setReportReason(e.target.value)} className="fs-sm" />
          </Modal.Body>
          <Modal.Footer>
            <Button size="sm" variant="secondary" onClick={() => setReporting(false)}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={handleReport} disabled={!reportReason.trim()}>Submit report</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
}

const EMPTY_FORM = { species: '', kind: 'cutting', description: '', outwardCode: '', contactEmail: '', suggestedDonation: '' }

function CreateListingModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await marketplaceApi.createListing({
        species: form.species,
        kind: form.kind,
        description: form.description,
        outwardCode: form.outwardCode,
        contactEmail: form.contactEmail || undefined,
        suggestedDonation: form.suggestedDonation || undefined,
      })
      onCreated(result)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create listing')
    } finally {
      setSaving(false)
    }
  }

  const valid = form.species.trim() && form.outwardCode.trim() && form.contactEmail.trim()

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton><Modal.Title>Offer a cutting or plant</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <div className="alert alert-danger py-2 fs-sm mb-3">{error}</div>}
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Plant / species *</Form.Label>
          <Form.Control size="sm" value={form.species} onChange={(e) => set('species', e.target.value)} placeholder="e.g. Monstera deliciosa" />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">What are you offering? *</Form.Label>
          <Form.Select size="sm" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Description</Form.Label>
          <Form.Control as="textarea" rows={3} size="sm" value={form.description}
            onChange={(e) => set('description', e.target.value)} placeholder="Age, size, condition, care notes..." />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Your postcode outward code (e.g. SW1A) *</Form.Label>
          <Form.Control size="sm" value={form.outwardCode} onChange={(e) => set('outwardCode', e.target.value.toUpperCase())} placeholder="SW1A" maxLength={4} />
          <Form.Text className="text-muted fs-xs">Only the first part of your postcode is shown — your full address is never published.</Form.Text>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Contact email *</Form.Label>
          <Form.Control type="email" size="sm" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="you@example.com" />
        </Form.Group>
        <Form.Group className="mb-0">
          <Form.Label className="fs-sm fw-semibold">Suggested donation (optional)</Form.Label>
          <Form.Control size="sm" value={form.suggestedDonation} onChange={(e) => set('suggestedDonation', e.target.value)} placeholder="e.g. £2 for postage" />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving || !valid}>
          {saving ? 'Submitting…' : 'List it'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default function CommunityPage() {
  const { isGuest, user } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [postcode, setPostcode] = useState('')
  const [species, setSpecies] = useState('')
  const [kind, setKind] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const loadListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (postcode.trim()) params.outwardCode = postcode.trim()
      if (species.trim()) params.species = species.trim()
      if (kind) params.kind = kind
      const { listings: list } = await marketplaceApi.listListings(params)
      setListings(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [postcode, species, kind])

  useEffect(() => { loadListings() }, [loadListings])

  const handleClaim = async (id) => {
    if (isGuest || !user) { setError('Sign in to claim listings'); return }
    await marketplaceApi.claimListing(id)
  }

  const handleReport = async (id, reason) => {
    if (isGuest || !user) { setError('Sign in to report listings'); return }
    await marketplaceApi.reportListing(id, reason)
  }

  return (
    <div className="content-wrapper">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="subheader-title mb-0">Community Cuttings Board</h1>
          <p className="text-muted fs-sm mb-0">Free plant swaps, cuttings, and divisions near you. UK only.</p>
        </div>
        <div className="d-flex gap-2">
          <a href="/community-guidelines" target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">Guidelines</a>
          {!isGuest && (
            <Button size="sm" variant="primary" onClick={() => setShowCreate(true)} data-testid="offer-cutting-btn">
              <svg className="sa-icon me-1" style={{ width: 12, height: 12 }} aria-hidden="true"><use href="/icons/sprite.svg#plus"></use></svg>
              Offer a cutting
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-3">
              <Form.Label className="fs-xs text-muted mb-1">Postcode area</Form.Label>
              <InputGroup size="sm">
                <FormControl placeholder="e.g. SW1A" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} maxLength={4} aria-label="Postcode filter" />
              </InputGroup>
            </div>
            <div className="col-6 col-md-3">
              <Form.Label className="fs-xs text-muted mb-1">Species</Form.Label>
              <FormControl size="sm" placeholder="e.g. Monstera" value={species} onChange={(e) => setSpecies(e.target.value)} aria-label="Species filter" />
            </div>
            <div className="col-6 col-md-3">
              <Form.Label className="fs-xs text-muted mb-1">Type</Form.Label>
              <Form.Select size="sm" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind filter">
                <option value="">All types</option>
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Form.Select>
            </div>
            <div className="col-6 col-md-3">
              <Button size="sm" variant="primary" onClick={loadListings} className="w-100">Search</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
      {loading ? (
        <p className="text-muted fs-sm">Loading listings…</p>
      ) : listings.length === 0 ? (
        <div className="text-center py-5">
          <svg className="sa-icon sa-icon-2x mb-2 text-muted" aria-hidden="true"><use href="/icons/sprite.svg#package"></use></svg>
          <p className="text-muted">No listings found. {!isGuest && 'Be the first to offer a cutting!'}</p>
        </div>
      ) : (
        <div className="row g-3">
          {listings.map((l) => (
            <div key={l.id} className="col-12 col-sm-6 col-lg-4">
              <ListingCard listing={l} onClaim={handleClaim} onReport={handleReport} />
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateListingModal
          onClose={() => setShowCreate(false)}
          onCreated={(newListing) => setListings((prev) => [newListing, ...prev])}
        />
      )}
    </div>
  )
}
