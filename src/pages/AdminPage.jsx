import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router'
import { Button, Form, Table, Badge, Nav, InputGroup, FormControl } from 'react-bootstrap'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useProfile } from '../context/ProfileContext.jsx'
import { apiKeysApi } from '../api/plants.js'
import { menuItems } from '../layouts/components/menuData.js'
import SettingSection from '../components/SettingSection.jsx'

const TABS = [
  { id: 'features', label: 'Features', icon: 'grid', tags: 'features admin menu visibility persona toggle hide show workspace' },
  { id: 'api-keys', label: 'API Keys', icon: 'key', tags: 'api keys rest integration home assistant automation developer' },
  { id: 'advanced', label: 'Advanced', icon: 'tool', tags: 'reset onboarding developer version advanced about' },
]
const VALID_TABS = TABS.map((t) => t.id)
const DEFAULT_TAB = 'features'

function describeStaticDefault(personas) {
  if (!personas) return 'Visible to all'
  const set = new Set(personas)
  if (set.has('both') || (set.has('household') && set.has('landscaper'))) return 'Visible to all'
  if (set.has('landscaper')) return 'Landscaper only'
  if (set.has('household')) return 'Household only'
  return 'Visible to all'
}

function flattenMenuForFeatures(items) {
  const rows = []
  for (const section of items) {
    rows.push({ key: section.key, label: section.label, isSection: true, personas: section.personas })
    for (const child of section.children || []) {
      rows.push({ key: child.key, label: child.label, isSection: false, personas: child.personas, parentKey: section.key })
    }
  }
  return rows
}

function FeaturesTab({ search }) {
  const { featureOverrides, saveFeatureOverrides, canEditFeatureFlags } = useProfile()
  const [draft, setDraft] = useState(() => ({ ...featureOverrides }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => { setDraft({ ...featureOverrides }) }, [featureOverrides])

  const rows = useMemo(() => flattenMenuForFeatures(menuItems), [])
  const dirty = useMemo(() => {
    const a = featureOverrides
    const b = draft
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) if (a[k] !== b[k]) return true
    return false
  }, [featureOverrides, draft])

  const setRow = (key, value) => {
    setDraft((prev) => {
      const next = { ...prev }
      if (value === '__default__') delete next[key]
      else next[key] = value
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveFeatureOverrides(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => setDraft({})

  if (!canEditFeatureFlags) {
    return (
      <SettingSection id="features-locked" title="Features" icon="grid" search={search}>
        <p className="text-muted mb-0">Only the workspace admin (household owner or landscaper manager) can change feature visibility.</p>
      </SettingSection>
    )
  }

  return (
    <SettingSection id="features" title="Feature visibility" icon="grid" search={search}>
      <p className="text-muted mb-3">
        Override which menu items each persona sees. Items left as <em>Default</em> follow the built-in persona rules.
      </p>
      <Table hover responsive size="sm" className="mb-3">
        <thead>
          <tr>
            <th>Feature</th>
            <th style={{ width: 200 }}>Default</th>
            <th style={{ width: 220 }}>Override</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const value = draft[row.key] || '__default__'
            return (
              <tr key={row.key} className={row.isSection ? 'table-active fw-500' : ''}>
                <td>
                  {row.isSection ? row.label : (<span className="ps-3">{row.label}</span>)}
                </td>
                <td><span className="text-muted small">{describeStaticDefault(row.personas)}</span></td>
                <td>
                  <Form.Select
                    size="sm"
                    value={value}
                    onChange={(e) => setRow(row.key, e.target.value)}
                    aria-label={`Override for ${row.label}`}
                  >
                    <option value="__default__">Default</option>
                    <option value="both">Visible to all</option>
                    <option value="household">Household only</option>
                    <option value="landscaper">Landscaper only</option>
                    <option value="hidden">Hidden</option>
                  </Form.Select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <div className="d-flex align-items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={handleReset} disabled={saving || Object.keys(draft).length === 0}>
          Reset to defaults
        </Button>
        {saved && <span className="text-success small ms-2">Saved</span>}
        {saveError && <span className="text-danger small ms-2">{saveError}</span>}
      </div>
    </SettingSection>
  )
}

function ApiKeysTab({ search }) {
  const { isGuest } = useAuth()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(!isGuest)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState(null)
  const [revoking, setRevoking] = useState(null)

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true)
      const { keys: list } = await apiKeysApi.list()
      setKeys(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!isGuest) loadKeys() }, [loadKeys, isGuest])

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const result = await apiKeysApi.create(newKeyName.trim())
      setNewKeyValue(result.key)
      setNewKeyName('')
      await loadKeys()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id) => {
    setRevoking(id)
    setError(null)
    try {
      await apiKeysApi.revoke(id)
      setKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <>
      <SettingSection id="api-keys-intro" title="Public REST API" icon="key" search={search}>
        <p className="text-muted fs-sm mb-3">
          Use API keys to integrate your plant data with external tools — Home Assistant, custom dashboards, and smart irrigation systems.
          API keys are available on <strong>Home Pro</strong> and <strong>Landscaper Pro</strong> plans. Each key is shown <strong>once</strong> at creation.
        </p>
        <div className="alert alert-info py-2 fs-sm mb-0">
          <strong>Base URL:</strong> <code>{import.meta.env.VITE_API_BASE_URL || 'https://api.plants.lopezcloud.dev'}/api/v1</code>
          {' · '}
          Pass the key as <code>x-plant-api-key: pt_live_...</code>
        </div>
      </SettingSection>

      <SettingSection id="api-keys-manage" title="Your API Keys" icon="shield" search={search}>
        {error && <div className="alert alert-danger py-2 mb-3" data-testid="api-key-error">{error}</div>}

        {newKeyValue && (
          <div className="alert alert-success mb-3" data-testid="new-key-banner">
            <strong>Copy your new API key — it won&apos;t be shown again:</strong>
            <div className="d-flex align-items-center gap-2 mt-2">
              <code className="flex-grow-1 text-break" data-testid="new-key-value">{newKeyValue}</code>
              <Button size="sm" variant="outline-success" onClick={() => { navigator.clipboard?.writeText(newKeyValue); }}>
                Copy
              </Button>
            </div>
            <Button size="sm" variant="link" className="p-0 mt-1 text-muted" onClick={() => setNewKeyValue(null)}>Dismiss</Button>
          </div>
        )}

        {loading ? (
          <p className="text-muted fs-sm">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-muted fs-sm mb-3" data-testid="no-keys-message">No API keys yet. Create one below.</p>
        ) : (
          <Table size="sm" className="mb-3" data-testid="api-keys-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Created</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td><code>{k.key}</code></td>
                  <td className="text-muted fs-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="text-muted fs-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      data-testid={`revoke-key-${k.id}`}
                    >
                      {revoking === k.id ? 'Revoking…' : 'Revoke'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {keys.length < 3 && (
          <div className="d-flex gap-2 align-items-end">
            <Form.Group controlId="new-key-name" className="flex-grow-1">
              <Form.Label className="fs-sm fw-500 mb-1">New key name</Form.Label>
              <Form.Control
                size="sm"
                placeholder="e.g. Home Assistant"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                maxLength={64}
                data-testid="new-key-name-input"
              />
            </Form.Group>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              data-testid="create-key-btn"
            >
              {creating ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        )}
        {keys.length >= 3 && (
          <p className="text-muted fs-xs mb-0">Maximum of 3 active API keys reached. Revoke one to create a new key.</p>
        )}
      </SettingSection>
    </>
  )
}

function AdvancedTab({ search }) {
  return (
    <SettingSection id="version" title="About" icon="info" search={search}>
      <p className="text-muted fs-sm mb-0">
        Version: {__APP_VERSION__} &middot; Built: {new Date(__BUILD_TIME__).toLocaleString()}
      </p>
    </SettingSection>
  )
}

export default function AdminPage() {
  const { tab = DEFAULT_TAB } = useParams()
  const [search, setSearch] = useState('')
  const { canEditFeatureFlags, loading } = useProfile()

  const matchingTabs = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return new Set(TABS.filter((t) => t.tags.includes(q) || t.label.toLowerCase().includes(q)).map((t) => t.id))
  }, [search])

  if (!loading && !canEditFeatureFlags) {
    return <Navigate to="/settings/property" replace />
  }

  if (!VALID_TABS.includes(tab)) {
    return <Navigate to={`/admin/${DEFAULT_TAB}`} replace />
  }

  return (
    <div className="content-wrapper">
      <h1 className="subheader-title mb-3">Admin</h1>

      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <Nav variant="tabs" className="flex-grow-1" role="tablist">
          {TABS.map((t) => (
            <Nav.Item key={t.id}>
              <Nav.Link
                as={Link}
                to={`/admin/${t.id}`}
                active={tab === t.id}
                className="d-flex align-items-center gap-1"
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true">
                  <use href={`/icons/sprite.svg#${t.icon}`}></use>
                </svg>
                <span className="d-none d-sm-inline">{t.label}</span>
                <span className="d-inline d-sm-none">{t.label.split(' ')[0]}</span>
                {matchingTabs?.has(t.id) && (
                  <Badge bg="primary" pill className="ms-1" style={{ fontSize: '0.6rem' }}>
                    match
                  </Badge>
                )}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <InputGroup size="sm" style={{ maxWidth: 200 }}>
          <InputGroup.Text aria-hidden="true">
            <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#search"></use></svg>
          </InputGroup.Text>
          <FormControl
            placeholder="Search admin…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search admin"
          />
          {search && (
            <Button variant="outline-secondary" size="sm" onClick={() => setSearch('')} aria-label="Clear search">
              <svg className="sa-icon" style={{ width: 10, height: 10 }}><use href="/icons/sprite.svg#x"></use></svg>
            </Button>
          )}
        </InputGroup>
      </div>

      <div className="main-content">
        {tab === 'features' && <FeaturesTab search={search} />}
        {tab === 'api-keys' && <ApiKeysTab search={search} />}
        {tab === 'advanced' && <AdvancedTab search={search} />}
      </div>
    </div>
  )
}
