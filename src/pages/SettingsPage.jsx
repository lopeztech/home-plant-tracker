import { useState, useCallback, useRef, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router'
import { Button, Form, Table, Badge, Nav, InputGroup, FormControl } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import HelpTooltip from '../components/HelpTooltip.jsx'
import LeafletFloorplan from '../components/LeafletFloorplan.jsx'
import { YARD_AREAS } from '../utils/watering.js'

const TABS = [
  { id: 'property', label: 'Property', icon: 'layers', tags: 'floors zones floorplan rooms upload property' },
  { id: 'preferences', label: 'Preferences', icon: 'sliders', tags: 'theme dark mode light temperature celsius fahrenheit location city weather' },
  { id: 'data', label: 'Data & export', icon: 'download', tags: 'export csv download backup data' },
  { id: 'advanced', label: 'Advanced', icon: 'tool', tags: 'reset onboarding developer version advanced' },
]

function FloorRow({ floor, onChange, onDelete, expanded, onToggle }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  const rooms = floor.rooms || []

  const addRoom = () => {
    if (!newRoomName.trim()) return
    const last = rooms[rooms.length - 1]
    const newY = last ? Math.min(last.y + last.height + 2, 90) : 5
    onChange({
      ...floor,
      rooms: [...rooms, { name: newRoomName.trim(), x: 5, y: newY, width: 90, height: Math.min(20, 95 - newY) }],
    })
    setNewRoomName('')
  }

  const updateRoom = (idx, updates) => {
    onChange({ ...floor, rooms: rooms.map((r, i) => (i === idx ? { ...r, ...updates } : r)) })
  }

  const deleteRoom = (idx) => {
    onChange({ ...floor, rooms: rooms.filter((_, i) => i !== idx) })
  }

  return (
    <>
      <tr className={`${floor.hidden ? 'opacity-50' : ''} ${expanded ? 'table-active' : ''}`}>
        <td>
          <Form.Check
            type="switch"
            checked={!floor.hidden}
            onChange={() => onChange({ ...floor, hidden: !floor.hidden })}
            label=""
          />
        </td>
        <td>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm p-0 border-0" onClick={onToggle} title="Show rooms">
              <svg className="sa-icon" style={{ width: 14, height: 14, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                <use href="/icons/sprite.svg#chevron-right"></use>
              </svg>
            </button>
            <Form.Control
              size="sm"
              value={floor.name}
              onChange={(e) => onChange({ ...floor, name: e.target.value })}
              className="border-0 bg-transparent"
            />
          </div>
        </td>
        <td>
          <Badge
            bg={floor.type === 'outdoor' ? 'success' : 'info'}
            style={{ cursor: 'pointer' }}
            onClick={() => onChange({ ...floor, type: floor.type === 'outdoor' ? 'indoor' : 'outdoor' })}
          >
            {floor.type === 'outdoor' ? 'outdoor' : 'indoor'}
          </Badge>
        </td>
        <td className="text-end">
          {confirmDelete ? (
            <div className="d-flex gap-1 justify-content-end">
              <Button variant="danger" size="sm" onClick={() => { onDelete(floor.id); setConfirmDelete(false) }}>Yes</Button>
              <Button variant="light" size="sm" onClick={() => setConfirmDelete(false)}>No</Button>
            </div>
          ) : (
            <Button variant="link" size="sm" className="text-danger p-0" onClick={() => setConfirmDelete(true)}>
              <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#trash-2"></use></svg>
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="p-0">
            <div className="bg-body-tertiary p-3">
              {/* Interactive zone map */}
              <div className="border rounded mb-3" style={{ height: 350, position: 'relative', overflow: 'hidden', background: floor.type === 'outdoor' ? '#f0fdf4' : '#f8f9fa' }}>
                <LeafletFloorplan
                  key={`edit-${floor.id}`}
                  floor={floor}
                  floors={[floor]}
                  plants={[]}
                  weather={null}
                  onFloorplanClick={() => {}}
                  onMarkerClick={() => {}}
                  onMarkerDrag={() => {}}
                  editMode={true}
                  onRoomsChange={(newRooms) => onChange({ ...floor, rooms: newRooms })}
                />
              </div>
              <ul className="text-muted fs-xs mb-3 ps-3">
                <li>Drag a room to move it.</li>
                <li>Drag the corners to resize.</li>
                <li>Click and drag on empty space to draw a new zone.</li>
              </ul>

              <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">
                Rooms / Zones ({rooms.length})
              </h6>

              {rooms.length === 0 ? (
                <p className="text-muted fs-sm mb-2">No rooms defined. Draw on the map above or add one below.</p>
              ) : (
                <div className="mb-3">
                  {rooms.map((room, i) => (
                    <div key={i} className={`d-flex align-items-center gap-2 mb-1 ${room.hidden ? 'opacity-50' : ''}`}>
                      <Form.Check
                        type="switch"
                        checked={!room.hidden}
                        onChange={() => updateRoom(i, { hidden: !room.hidden })}
                        className="flex-shrink-0"
                      />
                      <Form.Control
                        size="sm"
                        value={room.name}
                        onChange={(e) => updateRoom(i, { name: e.target.value })}
                      />
                      <Badge
                        as="button"
                        type="button"
                        bg={room.type === 'outdoor' ? 'success' : 'info'}
                        style={{ cursor: 'pointer', fontSize: '0.65rem', border: 0 }}
                        onClick={() => updateRoom(i, { type: room.type === 'outdoor' ? 'indoor' : 'outdoor' })}
                        title="Toggle indoor/outdoor"
                        aria-label={`Toggle room type, currently ${room.type === 'outdoor' ? 'outdoor' : 'indoor'}`}
                      >
                        <svg className="sa-icon me-1" style={{ width: 10, height: 10 }} aria-hidden="true">
                          <use href={`/icons/sprite.svg#${room.type === 'outdoor' ? 'sun' : 'home'}`}></use>
                        </svg>
                        {room.type === 'outdoor' ? 'outdoor' : 'indoor'}
                      </Badge>
                      {(room.type === 'outdoor' || floor.type === 'outdoor') && (
                        <Form.Select
                          size="sm"
                          value={room.area || 'frontyard'}
                          onChange={(e) => updateRoom(i, { area: e.target.value })}
                          className="settings-fixed-w-120"
                          style={{ fontSize: '0.7rem' }}
                          title="Yard area"
                        >
                          {YARD_AREAS.map((a) => (
                            <option key={a.id} value={a.id}>{a.label}</option>
                          ))}
                        </Form.Select>
                      )}
                      <Button variant="link" size="sm" className="text-danger p-0 flex-shrink-0" onClick={() => deleteRoom(i)}>
                        <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#x"></use></svg>
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add room */}
              <div className="d-flex gap-2">
                <Form.Control
                  size="sm"
                  placeholder="New room name..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRoom()}
                />
                <Button variant="primary" size="sm" onClick={addRoom} disabled={!newRoomName.trim()}>
                  <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#plus"></use></svg>
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function SettingSection({ id, title, icon, search, helpArticle, children }) {
  const visible = !search || title.toLowerCase().includes(search.toLowerCase())
  if (!visible) return null
  return (
    <div id={`settings-section-${id}`} className="mb-4">
      <div className="panel panel-icon">
        <div className="panel-hdr">
          <span className="d-flex align-items-center gap-1">
            {icon && (
              <svg className="sa-icon me-2" aria-hidden="true"><use href={`/icons/sprite.svg#${icon}`}></use></svg>
            )}
            {title}
            {helpArticle && <HelpTooltip articleId={helpArticle} label={`Help: ${title}`} />}
          </span>
        </div>
        <div className="panel-container"><div className="panel-content">
          {children}
        </div></div>
      </div>
    </div>
  )
}

function PropertyTab({ search }) {
  const { floors, handleSaveFloors, handleFloorplanUpload, isAnalysingFloorplan, isGuest } = usePlantContext()
  const fileInputRef = useRef(null)
  const [editableFloors, setEditableFloors] = useState(
    () => (floors || []).map((f) => ({ ...f, rooms: (f.rooms || []).map((r) => ({ ...r })) })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('indoor')
  const [expandedFloorId, setExpandedFloorId] = useState(null)

  const handleFloorChange = useCallback((updated) => {
    setEditableFloors((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
  }, [])

  const handleDeleteFloor = useCallback((id) => {
    setEditableFloors((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleAddFloor = () => {
    if (!newName.trim()) return
    const maxOrder = Math.max(...editableFloors.map((f) => f.order), -1)
    const id = newName.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    setEditableFloors((prev) => [...prev, { id, name: newName.trim(), type: newType, order: newType === 'outdoor' ? -1 : maxOrder + 1, imageUrl: null, rooms: [], hidden: false }])
    setNewName('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await handleSaveFloors(editableFloors)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <>
      <SettingSection id="floors" title="Floors & Zones" icon="layers" search={search}>
        <div className="p-0">
          <Table hover responsive className="mb-0 settings-floors-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Visible</th>
                <th>Name</th>
                <th style={{ width: 100 }}>Type</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {[...editableFloors].sort((a, b) => b.order - a.order).map((floor) => (
                <FloorRow
                  key={floor.id}
                  floor={floor}
                  onChange={handleFloorChange}
                  onDelete={handleDeleteFloor}
                  expanded={expandedFloorId === floor.id}
                  onToggle={() => setExpandedFloorId((prev) => (prev === floor.id ? null : floor.id))}
                />
              ))}
            </tbody>
          </Table>

          {/* Add zone */}
          <div className="d-flex gap-2 p-3 border-top">
            <Form.Control size="sm" placeholder="Zone name (e.g. Loft)" value={newName}
              onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()} />
            <Form.Select size="sm" value={newType} onChange={(e) => setNewType(e.target.value)} className="settings-fixed-w-120">
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </Form.Select>
            <Button variant="primary" size="sm" onClick={handleAddFloor} disabled={!newName.trim()}>
              <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#plus"></use></svg>
            </Button>
          </div>

          {/* Save floors */}
          <div className="p-3 border-top">
            <Button variant={saved ? 'success' : 'primary'} className="w-100" onClick={handleSave} disabled={saving}>
              {saved ? 'Saved!' : 'Save Floors'}
            </Button>
          </div>
        </div>
      </SettingSection>

      <SettingSection id="floorplan" title="Floorplan" icon="map" search={search} helpArticle="floorplan-ai">
        <Button
          variant="outline-primary"
          className="w-100"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAnalysingFloorplan || isGuest}
        >
          <svg className="sa-icon me-2" style={{ width: 16, height: 16 }}><use href="/icons/sprite.svg#upload"></use></svg>
          {isAnalysingFloorplan ? 'Analysing floorplan...' : 'Upload Floorplan'}
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="d-none"
          onChange={(e) => { if (e.target.files?.[0]) handleFloorplanUpload(e.target.files[0]); e.target.value = '' }} />
        <small className="text-muted d-block mt-2">Upload a photo of your floor plan — Gemini AI will identify rooms automatically</small>
      </SettingSection>
    </>
  )
}

function PreferencesTab({ search }) {
  const { tempUnit, location, setLocation } = usePlantContext()
  const { themeMode, changeThemeMode } = useLayoutContext()
  const [locationSearch, setLocationSearch] = useState('')
  const [locationResults, setLocationResults] = useState([])
  const [locationSearching, setLocationSearching] = useState(false)

  const THEME_OPTIONS = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'auto', label: 'Auto', icon: 'monitor' },
  ]

  return (
    <>
      <SettingSection id="appearance" title="Appearance" icon="sun" search={search}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span>Theme</span>
          <div className="d-flex gap-3" role="radiogroup" aria-label="Theme mode">
            {THEME_OPTIONS.map(({ value, label, icon }) => (
              <Form.Check
                key={value}
                type="radio"
                id={`theme-${value}`}
                name="theme-mode"
                label={
                  <span className="d-flex align-items-center gap-1">
                    <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true">
                      <use href={`/icons/sprite.svg#${icon}`}></use>
                    </svg>
                    {label}
                  </span>
                }
                checked={themeMode === value}
                onChange={() => changeThemeMode(value)}
              />
            ))}
          </div>
        </div>
      </SettingSection>

      {tempUnit && (
        <SettingSection id="units" title="Units" icon="thermometer" search={search}>
          <div className="d-flex align-items-center justify-content-between">
            <span className="d-flex align-items-center gap-1">
              Temperature
              <HelpTooltip articleId="temperature-units" label="What does temperature unit affect?" />
            </span>
            <Button variant="outline-default" size="sm" onClick={tempUnit.toggle}>
              <svg className="sa-icon me-1" aria-hidden="true"><use href="/icons/sprite.svg#thermometer"></use></svg>
              {tempUnit.unit === 'celsius' ? '°C → °F' : '°F → °C'}
            </Button>
          </div>
        </SettingSection>
      )}

      <SettingSection id="location" title="Location" icon="map-pin" search={search}>
        {location?.name && (
          <div className="d-flex align-items-center gap-2 mb-3">
            <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#map-pin"></use></svg>
            <span className="fw-500">{location.name}</span>
            {location.country && <small className="text-muted">({location.country})</small>}
            <Button variant="link" size="sm" className="p-0 text-danger ms-auto" onClick={() => setLocation(null)} title="Reset to GPS">
              <svg className="sa-icon" style={{ width: 12, height: 12 }} aria-hidden="true"><use href="/icons/sprite.svg#x"></use></svg>
            </Button>
          </div>
        )}
        <div className="d-flex gap-2">
          <Form.Control
            size="sm"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            placeholder="Search city..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!locationSearch.trim()) return
                setLocationSearching(true)
                fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationSearch.trim())}&count=5&language=en`)
                  .then((r) => r.json())
                  .then((data) => setLocationResults(data.results || []))
                  .catch(() => setLocationResults([]))
                  .finally(() => setLocationSearching(false))
              }
            }}
          />
          <Button
            variant="outline-primary"
            size="sm"
            className="flex-shrink-0"
            disabled={!locationSearch.trim() || locationSearching}
            onClick={() => {
              if (!locationSearch.trim()) return
              setLocationSearching(true)
              fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationSearch.trim())}&count=5&language=en`)
                .then((r) => r.json())
                .then((data) => setLocationResults(data.results || []))
                .catch(() => setLocationResults([]))
                .finally(() => setLocationSearching(false))
            }}
          >
            {locationSearching ? '...' : 'Search'}
          </Button>
        </div>
        {locationResults.length > 0 && (
          <div className="mt-2 border rounded">
            {locationResults.map((r) => (
              <button
                key={`${r.id}`}
                type="button"
                className="btn btn-sm w-100 text-start border-bottom d-flex justify-content-between align-items-center"
                onClick={() => {
                  setLocation({ name: r.name, country: r.country || '', lat: r.latitude, lon: r.longitude })
                  setLocationResults([])
                  setLocationSearch('')
                }}
              >
                <span>{r.name}{r.admin1 ? `, ${r.admin1}` : ''}</span>
                <small className="text-muted">{r.country}</small>
              </button>
            ))}
          </div>
        )}
      </SettingSection>
    </>
  )
}

function DataTab({ search }) {
  return (
    <SettingSection id="export" title="Data export" icon="download" search={search}>
      <p className="text-muted mb-0">
        CSV and PDF export of your plant inventory and care history is coming soon.
      </p>
    </SettingSection>
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

const VALID_TABS = TABS.map((t) => t.id)

export default function SettingsPage() {
  const { tab = 'property' } = useParams()
  const [search, setSearch] = useState('')

  if (!VALID_TABS.includes(tab)) {
    return <Navigate to="/settings/property" replace />
  }

  // Which tabs match the current search query (used to badge the tab links)
  const matchingTabs = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return new Set(TABS.filter((t) => t.tags.includes(q) || t.label.toLowerCase().includes(q)).map((t) => t.id))
  }, [search])

  return (
    <div className="content-wrapper">
      <h1 className="subheader-title mb-3">Settings</h1>

      {/* Tab bar + search */}
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <Nav variant="tabs" className="flex-grow-1" role="tablist">
          {TABS.map((t) => (
            <Nav.Item key={t.id}>
              <Nav.Link
                as={Link}
                to={`/settings/${t.id}`}
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
            placeholder="Search settings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search settings"
          />
          {search && (
            <Button variant="outline-secondary" size="sm" onClick={() => setSearch('')} aria-label="Clear search">
              <svg className="sa-icon" style={{ width: 10, height: 10 }}><use href="/icons/sprite.svg#x"></use></svg>
            </Button>
          )}
        </InputGroup>
      </div>

      <div className="main-content">
        {tab === 'property' && <PropertyTab search={search} />}
        {tab === 'preferences' && <PreferencesTab search={search} />}
        {tab === 'data' && <DataTab search={search} />}
        {tab === 'advanced' && <AdvancedTab search={search} />}
      </div>
    </div>
  )
}
