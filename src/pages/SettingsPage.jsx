import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router'
import { Button, Form, Table, Badge, Nav, InputGroup, FormControl } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import HelpTooltip from '../components/HelpTooltip.jsx'
import LeafletFloorplan from '../components/LeafletFloorplan.jsx'
import SettingSection from '../components/SettingSection.jsx'
import { YARD_AREAS } from '../utils/watering.js'
import { TIMEZONE_GROUPS } from '../hooks/useTimezone.js'
import { SUPPORTED_LANGUAGES } from '../i18n/index.js'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/index.js'
import { accountApi, exportApi, brandingApi, imagesApi, householdsApi, propertiesApi, oauthApi, reportsApi } from '../api/plants.js'
import { useHousehold } from '../context/HouseholdContext.jsx'
import { useProperty } from '../context/PropertyContext.jsx'
import { useProfile } from '../context/ProfileContext.jsx'

const TABS = [
  { id: 'property', label: 'Property', icon: 'layers', tags: 'floors zones floorplan rooms upload property' },
  { id: 'preferences', label: 'Preferences', icon: 'sliders', tags: 'theme dark mode light temperature celsius fahrenheit metric imperial units location city weather profile mode persona household landscaper gardener role' },
  { id: 'household', label: 'Household', icon: 'users', tags: 'household share invite member family roommate partner role viewer editor owner code' },
  { id: 'data', label: 'Data & export', icon: 'download', tags: 'export csv download backup data' },
  { id: 'client-properties', label: 'Properties', icon: 'home', tags: 'properties clients landscaper multi-property client management' },
  { id: 'linked-devices', label: 'Linked Devices', icon: 'mic', tags: 'voice alexa google home apple shortcuts assistant linked devices oauth integration' },
  { id: 'branding', label: 'Branding', icon: 'star', tags: 'branding logo colour color business name landscaper white label report pdf' },
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
            id={`floor-visible-${floor.id}`}
            checked={!floor.hidden}
            onChange={() => onChange({ ...floor, hidden: !floor.hidden })}
            label=""
            aria-label={`Show floor ${floor.name}`}
          />
        </td>
        <td>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm p-0 border-0" onClick={onToggle} title="Show rooms" aria-label={`${expanded ? 'Hide' : 'Show'} rooms in ${floor.name}`} aria-expanded={expanded}>
              <svg className="sa-icon" style={{ width: 14, height: 14, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} aria-hidden="true">
                <use href="/icons/sprite.svg#chevron-right"></use>
              </svg>
            </button>
            <Form.Control
              size="sm"
              value={floor.name}
              onChange={(e) => onChange({ ...floor, name: e.target.value })}
              className="border-0 bg-transparent"
              aria-label="Floor name"
            />
          </div>
        </td>
        <td>
          <Badge
            as="button"
            type="button"
            bg={floor.type === 'outdoor' ? 'success' : 'info'}
            style={{ cursor: 'pointer', border: 0 }}
            onClick={() => onChange({ ...floor, type: floor.type === 'outdoor' ? 'indoor' : 'outdoor' })}
            aria-label={`Toggle floor type, currently ${floor.type === 'outdoor' ? 'outdoor' : 'indoor'}`}
          >
            {floor.type === 'outdoor' ? 'outdoor' : 'indoor'}
          </Badge>
        </td>
        <td className="text-end">
          {confirmDelete ? (
            <div className="d-flex gap-1 justify-content-end">
              <Button variant="danger" size="sm" onClick={() => { onDelete(floor.id); setConfirmDelete(false) }} aria-label={`Confirm delete ${floor.name}`}>Yes</Button>
              <Button variant="light" size="sm" onClick={() => setConfirmDelete(false)} aria-label="Cancel delete">No</Button>
            </div>
          ) : (
            <Button variant="link" size="sm" className="text-danger p-0" onClick={() => setConfirmDelete(true)} aria-label={`Delete floor ${floor.name}`}>
              <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#trash-2"></use></svg>
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
                    <div key={i} className={room.hidden ? 'opacity-50 mb-2' : 'mb-2'}>
                      <div className="d-flex align-items-center gap-2">
                        <Form.Check
                          type="switch"
                          id={`room-visible-${floor.id}-${i}`}
                          checked={!room.hidden}
                          onChange={() => updateRoom(i, { hidden: !room.hidden })}
                          className="flex-shrink-0"
                          aria-label={`Show room ${room.name || `#${i + 1}`}`}
                        />
                        <Form.Control
                          size="sm"
                          value={room.name}
                          onChange={(e) => updateRoom(i, { name: e.target.value })}
                          aria-label="Room name"
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
                            aria-label="Yard area"
                          >
                            {YARD_AREAS.map((a) => (
                              <option key={a.id} value={a.id}>{a.label}</option>
                            ))}
                          </Form.Select>
                        )}
                        <Badge
                          as="button"
                          type="button"
                          bg={room.isBed ? 'warning' : 'secondary'}
                          style={{ cursor: 'pointer', fontSize: '0.65rem', border: 0, color: room.isBed ? '#000' : undefined }}
                          onClick={() => updateRoom(i, { isBed: !room.isBed })}
                          title="Use as raised bed"
                          aria-label={`Toggle raised bed, currently ${room.isBed ? 'raised bed' : 'not a raised bed'}`}
                          aria-pressed={!!room.isBed}
                        >
                          🌱 bed
                        </Badge>
                        <Button variant="link" size="sm" className="text-danger p-0 flex-shrink-0" onClick={() => deleteRoom(i)} aria-label={`Delete room ${room.name || `#${i + 1}`}`}>
                          <svg className="sa-icon" style={{ width: 12, height: 12 }} aria-hidden="true"><use href="/icons/sprite.svg#x"></use></svg>
                        </Button>
                      </div>
                      {room.isBed && (
                        <div className="ms-4 mt-1 d-flex align-items-center gap-2 fs-xs text-muted">
                          <span>Grid:</span>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={1}
                            max={20}
                            value={room.gridCellsX || 4}
                            onChange={(e) => updateRoom(i, { gridCellsX: Math.max(1, Math.min(20, parseInt(e.target.value) || 4)) })}
                            style={{ width: 52, fontSize: '0.7rem' }}
                            aria-label="Grid columns"
                            title="Columns"
                          />
                          <span>cols ×</span>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={1}
                            max={20}
                            value={room.gridCellsY || 4}
                            onChange={(e) => updateRoom(i, { gridCellsY: Math.max(1, Math.min(20, parseInt(e.target.value) || 4)) })}
                            style={{ width: 52, fontSize: '0.7rem' }}
                            aria-label="Grid rows"
                            title="Rows"
                          />
                          <span>rows</span>
                        </div>
                      )}
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
                  aria-label="New room name"
                />
                <Button variant="primary" size="sm" onClick={addRoom} disabled={!newRoomName.trim()} aria-label="Add room">
                  <svg className="sa-icon" style={{ width: 12, height: 12 }} aria-hidden="true"><use href="/icons/sprite.svg#plus"></use></svg>
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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
              onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
              aria-label="New zone name" />
            <Form.Select size="sm" value={newType} onChange={(e) => setNewType(e.target.value)} className="settings-fixed-w-120" aria-label="New zone type">
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </Form.Select>
            <Button variant="primary" size="sm" onClick={handleAddFloor} disabled={!newName.trim()} aria-label="Add zone">
              <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#plus"></use></svg>
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

const PROFILE_OPTIONS = [
  {
    value: 'household',
    label: 'Household',
    description: 'Track plants in your home, share with family, log watering and feeding.',
    icon: 'home',
  },
  {
    value: 'landscaper',
    label: 'Landscaper / gardener',
    description: 'Manage client properties, schedule visits, run a team, send branded reports.',
    icon: 'briefcase',
  },
  {
    value: 'both',
    label: 'Both',
    description: "I do both — show me everything.",
    icon: 'layers',
  },
]

function PreferencesTab({ search }) {
  const { tempUnit, unitSystem, location, setLocation, timezone, setTimezone } = usePlantContext()
  const { themeMode, changeThemeMode } = useLayoutContext()
  const { accountType, setAccountType } = useProfile()
  const { t } = useTranslation('settings')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationResults, setLocationResults] = useState([])
  const [locationSearching, setLocationSearching] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  const THEME_OPTIONS = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'auto', label: 'Auto', icon: 'monitor' },
  ]

  const onPickProfile = async (next) => {
    if (next === accountType || profileSaving) return
    setProfileSaving(true)
    try {
      await setAccountType(next)
    } catch { /* ProfileContext surfaces the error; no-op here */ }
    finally { setProfileSaving(false) }
  }

  return (
    <>
      <SettingSection id="profile-mode" title="Profile mode" icon="user" search={search}>
        <p className="text-muted small mb-3">
          Tailors which menus you see. Doesn&apos;t change what you can pay for —
          your plan still controls premium features and quotas.
        </p>
        <div className="d-flex flex-column flex-md-row gap-2" role="radiogroup" aria-label="Profile mode">
          {PROFILE_OPTIONS.map(({ value, label, description, icon }) => {
            const selected = accountType === value
            return (
              <div
                key={value}
                className={`flex-fill border rounded p-3 d-flex gap-2 ${selected ? 'border-primary bg-primary-subtle' : ''} ${profileSaving ? 'opacity-50' : ''}`}
                onClick={() => onPickProfile(value)}
                style={{ cursor: profileSaving ? 'wait' : 'pointer' }}
              >
                <Form.Check
                  type="radio"
                  id={`profile-${value}`}
                  name="profile-mode"
                  value={value}
                  checked={selected}
                  onChange={() => onPickProfile(value)}
                  disabled={profileSaving}
                  aria-label={label}
                  aria-describedby={`profile-${value}-desc`}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <div className="d-flex align-items-center gap-1 fw-500">
                    <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true">
                      <use href={`/icons/sprite.svg#${icon}`}></use>
                    </svg>
                    {label}
                  </div>
                  <div id={`profile-${value}-desc`} className="text-muted small">{description}</div>
                </div>
              </div>
            )
          })}
        </div>
      </SettingSection>

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

      {(tempUnit || unitSystem) && (
        <SettingSection id="units" title="Units" icon="thermometer" search={search}>
          <div className="d-flex flex-column gap-3">
            {tempUnit && (
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
            )}
            {unitSystem && (
              <div className="d-flex align-items-center justify-content-between">
                <span>Measurements</span>
                <Button variant="outline-default" size="sm" onClick={unitSystem.toggle}>
                  <svg className="sa-icon me-1" aria-hidden="true"><use href="/icons/sprite.svg#ruler"></use></svg>
                  {unitSystem.system === 'metric' ? 'Metric → Imperial' : 'Imperial → Metric'}
                </Button>
              </div>
            )}
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

      <SettingSection id="timezone" title="Timezone" icon="clock" search={search}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <div className="fw-500 fs-sm">{t('timezone.label', 'Timezone')}</div>
            <div className="text-muted fs-xs">{t('timezone.description', 'Used for overdue badges, calendar days, and watering schedules')}</div>
          </div>
          <Form.Select
            size="sm"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ maxWidth: 260 }}
            aria-label="Select timezone"
          >
            {TIMEZONE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.zones.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </optgroup>
            ))}
          </Form.Select>
        </div>
      </SettingSection>

      <SettingSection id="language" title="Language" icon="globe" search={search}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <div className="fw-500 fs-sm">{t('language.label', 'Language')}</div>
            <div className="text-muted fs-xs">{t('language.description', 'Sets the UI language. Content from AI may still be in English.')}</div>
          </div>
          <Form.Select
            size="sm"
            value={i18n.language?.split('-')[0] || 'en'}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            style={{ maxWidth: 200 }}
            aria-label="Select language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName}
              </option>
            ))}
          </Form.Select>
        </div>
      </SettingSection>
    </>
  )
}

function HouseholdTab({ search }) {
  const { isGuest } = useAuth()
  const { activeHouseholdId, activeRole, refresh: refreshHouseholds } = useHousehold()
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(!isGuest)
  const [error, setError] = useState(null)
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteCode, setInviteCode] = useState(null)
  const [inviteExpiry, setInviteExpiry] = useState(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState(null)
  const [joining, setJoining] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [createName, setCreateName] = useState('')
  const [creatingHousehold, setCreatingHousehold] = useState(false)
  const isOwner = activeRole === 'owner'

  const reload = useCallback(async () => {
    if (isGuest) return
    setLoading(true)
    try {
      const data = await householdsApi.current()
      setCurrent(data)
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load household')
    } finally {
      setLoading(false)
    }
  }, [isGuest])

  useEffect(() => { reload() }, [reload, activeHouseholdId])

  if (isGuest) {
    return (
      <SettingSection id="household-info" title="Household sharing" icon="users" search={search}>
        <p className="text-muted mb-0">Sign in to share plants with family or housemates.</p>
      </SettingSection>
    )
  }

  const handleCreateInvite = async () => {
    if (!current?.id) return
    setCreatingInvite(true)
    setError(null)
    try {
      const result = await householdsApi.invite(current.id, inviteRole)
      setInviteCode(result.code)
      setInviteExpiry(result.expiresAt)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError(null)
    try {
      await householdsApi.join(joinCode.trim().toUpperCase())
      setJoinCode('')
      await refreshHouseholds()
      await reload()
    } catch (err) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  const handleRemove = async (userId) => {
    if (!current?.id || !window.confirm('Remove this member from the household?')) return
    setRemoving(userId)
    try {
      await householdsApi.removeMember(current.id, userId)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setRemoving(null)
    }
  }

  const handleSwitch = async (id) => {
    try {
      await householdsApi.switch(id)
      await refreshHouseholds()
      await reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCreateHousehold = async () => {
    if (!createName.trim()) return
    setCreatingHousehold(true)
    setError(null)
    try {
      await householdsApi.create(createName.trim())
      setCreateName('')
      await refreshHouseholds()
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingHousehold(false)
    }
  }

  return (
    <>
      <SettingSection id="household-current" title="Current household" icon="home" search={search}>
        {loading && <p className="text-muted mb-0">Loading…</p>}
        {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
        {!loading && current && (
          <>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <div className="fw-500">{current.name}</div>
                <small className="text-muted">
                  Your role: <Badge bg={current.role === 'owner' ? 'primary' : 'secondary'}>{current.role}</Badge>
                </small>
              </div>
            </div>
            <Table size="sm" hover responsive className="mb-0">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {(current.members || []).map((m) => (
                  <tr key={m.userId}>
                    <td>
                      {m.displayName || m.userId}
                      {m.isYou && <Badge bg="info" className="ms-2">You</Badge>}
                      {m.isOwner && <Badge bg="primary" className="ms-2">Owner</Badge>}
                    </td>
                    <td>{m.role}</td>
                    <td>{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}</td>
                    <td className="text-end">
                      {isOwner && !m.isOwner && !m.isYou && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={removing === m.userId}
                          onClick={() => handleRemove(m.userId)}
                        >
                          {removing === m.userId ? 'Removing…' : 'Remove'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </SettingSection>

      {isOwner && (
        <SettingSection id="household-invite" title="Invite a member" icon="user-plus" search={search}>
          <p className="text-muted mb-3">
            Generate a single-use share code valid for 7 days. The other person enters it on their Household
            settings page to join.
          </p>
          <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
            <Form.Group>
              <Form.Label className="mb-1 fs-sm">Role</Form.Label>
              <Form.Select
                size="sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{ width: 140 }}
              >
                <option value="viewer">Viewer (read-only)</option>
                <option value="editor">Editor</option>
              </Form.Select>
            </Form.Group>
            <Button variant="primary" size="sm" onClick={handleCreateInvite} disabled={creatingInvite}>
              {creatingInvite ? 'Generating…' : 'Generate share code'}
            </Button>
          </div>
          {inviteCode && (
            <div className="border rounded p-3 bg-light">
              <div className="fs-sm text-muted mb-1">Share code (single use)</div>
              <div className="d-flex align-items-center gap-2">
                <code className="fs-3 fw-bold">{inviteCode}</code>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => navigator.clipboard?.writeText(inviteCode)}
                >
                  Copy
                </Button>
              </div>
              <small className="text-muted d-block mt-1">
                Expires {inviteExpiry ? new Date(inviteExpiry).toLocaleString() : 'in 7 days'}
              </small>
            </div>
          )}
        </SettingSection>
      )}

      <SettingSection id="household-join" title="Join another household" icon="log-in" search={search}>
        <p className="text-muted mb-3">
          If someone shared a code with you, enter it here to join their household.
        </p>
        {joinError && <div className="alert alert-danger py-2 mb-3">{joinError}</div>}
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <Form.Group>
            <Form.Label className="mb-1 fs-sm">Share code</Form.Label>
            <Form.Control
              size="sm"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDEFGH"
              style={{ width: 160, fontFamily: 'monospace', textTransform: 'uppercase' }}
              maxLength={8}
            />
          </Form.Group>
          <Button variant="primary" size="sm" onClick={handleJoin} disabled={joining || !joinCode.trim()}>
            {joining ? 'Joining…' : 'Join household'}
          </Button>
        </div>
      </SettingSection>

      <SettingSection id="household-create" title="Create a new household" icon="plus-circle" search={search}>
        <p className="text-muted mb-3">
          You can keep multiple separate households (e.g. main home and holiday home). The new household
          becomes your active one.
        </p>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <Form.Group>
            <Form.Label className="mb-1 fs-sm">Name</Form.Label>
            <Form.Control
              size="sm"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Holiday home"
              style={{ width: 220 }}
              maxLength={60}
            />
          </Form.Group>
          <Button variant="outline-primary" size="sm" onClick={handleCreateHousehold} disabled={creatingHousehold || !createName.trim()}>
            {creatingHousehold ? 'Creating…' : 'Create household'}
          </Button>
        </div>
      </SettingSection>

      <HouseholdsListSection search={search} onSwitch={handleSwitch} />
    </>
  )
}

function HouseholdsListSection({ search, onSwitch }) {
  const { households, activeHouseholdId, loading } = useHousehold()
  if (loading || households.length <= 1) return null
  return (
    <SettingSection id="household-switch" title="Switch household" icon="repeat" search={search}>
      <Table size="sm" hover responsive className="mb-0">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Members</th>
            <th aria-label="Switch"></th>
          </tr>
        </thead>
        <tbody>
          {households.map((h) => (
            <tr key={h.id} className={h.isActive ? 'table-active' : ''}>
              <td>{h.name}</td>
              <td>{h.role}</td>
              <td>{h.memberCount}</td>
              <td className="text-end">
                {h.isActive ? (
                  <Badge bg="success">Active</Badge>
                ) : (
                  <Button size="sm" variant="outline-primary" onClick={() => onSwitch(h.id)}>
                    Switch
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {activeHouseholdId && <small className="text-muted d-block mt-2">Active: {households.find((h) => h.isActive)?.name}</small>}
    </SettingSection>
  )
}

function DataTab({ search }) {
  const { logout } = useAuth()
  const [exportLoading, setExportLoading] = useState(null)
  const [exportError, setExportError] = useState(null)
  const [deletePhase, setDeletePhase] = useState(0)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteError, setDeleteError] = useState(null)

  const handleExport = async () => {
    setExportLoading('json')
    setExportError(null)
    try {
      const data = await accountApi.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plant-tracker-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExportLoading(null)
    }
  }

  const handleCsvExport = async (type) => {
    setExportLoading(type)
    setExportError(null)
    try {
      if (type === 'plants-csv') await exportApi.downloadPlants('csv')
      else if (type === 'watering-csv') await exportApi.downloadWateringHistory('csv')
      else if (type === 'schedule-html') await exportApi.downloadCareSchedule()
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExportLoading(null)
    }
  }

  const handleDelete = async () => {
    setDeletePhase(3)
    setDeleteError(null)
    try {
      await accountApi.deleteAccount()
      logout()
    } catch (err) {
      setDeleteError(err.message)
      setDeletePhase(1)
    }
  }

  return (
    <>
      <SettingSection id="export" title="Data export" icon="download" search={search}>
        <p className="text-muted mb-3">
          Download your plant data in multiple formats. CSV files open in Excel or any spreadsheet app.
          The care schedule exports as a printable HTML page — open it in your browser and use File → Print to save as PDF.
        </p>
        {exportError && <div className="alert alert-danger py-2 mb-3">{exportError}</div>}
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-primary" onClick={handleExport} disabled={exportLoading !== null}>
            <svg className="sa-icon me-2" style={{ width: 14, height: 14 }} aria-hidden="true">
              <use href="/icons/sprite.svg#download"></use>
            </svg>
            {exportLoading === 'json' ? 'Exporting…' : 'All data (JSON)'}
          </Button>
          <Button variant="outline-secondary" onClick={() => handleCsvExport('plants-csv')} disabled={exportLoading !== null}>
            <svg className="sa-icon me-2" style={{ width: 14, height: 14 }} aria-hidden="true">
              <use href="/icons/sprite.svg#file-text"></use>
            </svg>
            {exportLoading === 'plants-csv' ? 'Exporting…' : 'Plant inventory (CSV)'}
          </Button>
          <Button variant="outline-secondary" onClick={() => handleCsvExport('watering-csv')} disabled={exportLoading !== null}>
            <svg className="sa-icon me-2" style={{ width: 14, height: 14 }} aria-hidden="true">
              <use href="/icons/sprite.svg#droplets"></use>
            </svg>
            {exportLoading === 'watering-csv' ? 'Exporting…' : 'Watering history (CSV)'}
          </Button>
          <Button variant="outline-secondary" onClick={() => handleCsvExport('schedule-html')} disabled={exportLoading !== null}>
            <svg className="sa-icon me-2" style={{ width: 14, height: 14 }} aria-hidden="true">
              <use href="/icons/sprite.svg#calendar"></use>
            </svg>
            {exportLoading === 'schedule-html' ? 'Exporting…' : 'Care schedule (printable)'}
          </Button>
        </div>
      </SettingSection>

      <SettingSection id="account-delete" title="Delete account" icon="trash-2" search={search}>
        <p className="text-muted mb-3">
          Permanently delete your account and all associated data. This cannot be undone and will purge
          all plant records, care history, and uploaded photos within 30 days (GDPR Article 17).
        </p>
        {deletePhase === 0 && (
          <Button variant="outline-danger" onClick={() => setDeletePhase(1)}>
            Delete my account
          </Button>
        )}
        {deletePhase >= 1 && (
          <div className="border border-danger rounded p-3">
            <p className="fw-500 text-danger mb-2">This action is irreversible.</p>
            <p className="text-muted fs-sm mb-3">
              Type <strong>DELETE</strong> to confirm account deletion.
            </p>
            <Form.Group controlId="delete-confirm" className="mb-3">
              <Form.Label visuallyHidden>Type DELETE to confirm</Form.Label>
              <Form.Control
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                disabled={deletePhase === 3}
              />
            </Form.Group>
            {deleteError && <div className="alert alert-danger py-2 mb-3">{deleteError}</div>}
            <div className="d-flex gap-2">
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleteInput !== 'DELETE' || deletePhase === 3}
              >
                {deletePhase === 3 ? 'Deleting…' : 'Delete account'}
              </Button>
              <Button
                variant="light"
                onClick={() => { setDeletePhase(0); setDeleteInput(''); setDeleteError(null) }}
                disabled={deletePhase === 3}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SettingSection>
    </>
  )
}

function BrandingTab({ search }) {
  const { isGuest } = useAuth()
  const [form, setForm] = useState({ businessName: '', brandColour: '#3a7d44', contactPhone: '', contactEmail: '', contactWebsite: '' })
  const [logoUrl, setLogoUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef(null)

  // Guests don't have a persisted branding config — skip the fetch so demo
  // and preview modes don't produce a spurious NetworkError.
  useEffect(() => {
    if (isGuest) return
    brandingApi.get().then((data) => {
      setForm({
        businessName: data.businessName || '',
        brandColour: data.brandColour || '#3a7d44',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        contactWebsite: data.contactWebsite || '',
      })
      if (data.logoUrl) setLogoUrl(data.logoUrl)
    }).catch(() => {})
  }, [isGuest])

  const handleLogoUpload = async (file) => {
    if (!file) return
    setUploadingLogo(true)
    setError(null)
    try {
      const url = await imagesApi.upload(file, 'branding')
      setLogoUrl(url)
      await brandingApi.save({ logoUrl: url })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await brandingApi.save(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SettingSection id="branding-identity" title="Business Identity" icon="star" search={search}>
        <Form.Group controlId="branding-business-name-input" className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Business name</Form.Label>
          <Form.Control
            data-testid="branding-business-name"
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            placeholder="e.g. Green Thumb Landscaping"
            maxLength={100}
          />
          <Form.Text className="text-muted">Shown in PDF report headers and client-facing views.</Form.Text>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="branding-colour-picker-input" className="fs-sm fw-semibold">Primary brand colour</Form.Label>
          <div className="d-flex align-items-center gap-2">
            <Form.Control
              id="branding-colour-picker-input"
              data-testid="branding-colour-picker"
              type="color"
              value={form.brandColour}
              onChange={(e) => setForm((f) => ({ ...f, brandColour: e.target.value }))}
              style={{ width: 48, height: 38, padding: 2, cursor: 'pointer' }}
              aria-label="Primary brand colour picker"
            />
            <Form.Control
              data-testid="branding-colour-hex"
              value={form.brandColour}
              onChange={(e) => setForm((f) => ({ ...f, brandColour: e.target.value }))}
              placeholder="#3a7d44"
              style={{ maxWidth: 120 }}
              aria-label="Primary brand colour hex value"
            />
          </div>
          <Form.Text className="text-muted">Applied to report headers and accent elements.</Form.Text>
        </Form.Group>
      </SettingSection>

      <SettingSection id="branding-logo" title="Logo" icon="image" search={search}>
        {logoUrl && (
          <div className="mb-3">
            <img
              data-testid="branding-logo-preview"
              src={logoUrl}
              alt="Business logo"
              style={{ maxWidth: 200, maxHeight: 60, objectFit: 'contain', borderRadius: 4 }}
            />
          </div>
        )}
        <div className="d-flex align-items-center gap-2">
          <Button
            data-testid="branding-upload-logo-btn"
            variant="outline-secondary"
            size="sm"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
          <span className="text-muted fs-xs">PNG, SVG or JPEG · max 2 MB · displayed at up to 200×60 px</span>
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/svg+xml,image/jpeg"
          style={{ display: 'none' }}
          data-testid="branding-logo-input"
          onChange={(e) => handleLogoUpload(e.target.files?.[0])}
        />
      </SettingSection>

      <SettingSection id="branding-contact" title="Contact Info" icon="phone" search={search}>
        <Form.Text className="text-muted d-block mb-3">Shown in PDF report footers and client-facing views.</Form.Text>
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Phone</Form.Label>
          <Form.Control
            data-testid="branding-contact-phone"
            value={form.contactPhone}
            onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            placeholder="+1 555 123 4567"
            maxLength={50}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Email</Form.Label>
          <Form.Control
            data-testid="branding-contact-email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            placeholder="hello@greenthumb.com"
            maxLength={254}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-semibold">Website</Form.Label>
          <Form.Control
            data-testid="branding-contact-website"
            type="url"
            value={form.contactWebsite}
            onChange={(e) => setForm((f) => ({ ...f, contactWebsite: e.target.value }))}
            placeholder="https://greenthumb.com"
            maxLength={2048}
          />
        </Form.Group>

        {error && <p className="text-danger fs-sm mb-2">{error}</p>}
        <Button
          data-testid="branding-save-btn"
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save branding'}
        </Button>
      </SettingSection>
    </>
  )
}

const VOICE_CLIENTS = [
  { id: 'alexa.lopezcloud.dev',          name: 'Amazon Alexa',    icon: 'mic' },
  { id: 'google-home.lopezcloud.dev',    name: 'Google Home',     icon: 'mic' },
  { id: 'apple-shortcuts.lopezcloud.dev', name: 'Apple Shortcuts', icon: 'mic' },
]

function LinkedDevicesTab({ search }) {
  const { isGuest } = useAuth()
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(!isGuest)
  const [error, setError] = useState(null)
  const [revoking, setRevoking] = useState(null)

  const loadGrants = useCallback(async () => {
    try {
      setLoading(true)
      const { grants: list } = await oauthApi.listGrants()
      setGrants(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!isGuest) loadGrants() }, [loadGrants, isGuest])

  const handleRevoke = async (id) => {
    setRevoking(id)
    setError(null)
    try {
      await oauthApi.revokeGrant(id)
      setGrants((prev) => prev.filter((g) => g.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <>
      <SettingSection id="linked-devices-intro" title="Linked Voice Assistants" icon="mic" search={search}>
        <p className="text-muted fs-sm mb-3">
          Connect your plant tracker to voice assistants like Amazon Alexa, Google Home, or Apple Shortcuts.
          Once linked, you can ask your assistant to water plants, check care schedules, and get weather alerts hands-free.
          Requires a <strong>Home Pro</strong> subscription.
        </p>
        <div className="row g-2">
          {VOICE_CLIENTS.map((client) => (
            <div key={client.id} className="col-12 col-md-4">
              <div className="border rounded p-3 d-flex flex-column align-items-center gap-2 text-center">
                <svg className="sa-icon sa-icon-2x" aria-hidden="true">
                  <use href="/icons/sprite.svg#mic"></use>
                </svg>
                <div className="fw-semibold fs-sm">{client.name}</div>
                <div className="text-muted fs-xs">Account linking coming soon</div>
              </div>
            </div>
          ))}
        </div>
      </SettingSection>

      <SettingSection id="linked-devices-active" title="Active Connections" icon="shield" search={search}>
        {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
        {loading ? (
          <p className="text-muted fs-sm">Loading…</p>
        ) : grants.length === 0 ? (
          <p className="text-muted fs-sm">No linked voice assistants yet.</p>
        ) : (
          <Table size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Device</th>
                <th>Connected</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>{g.clientName}</td>
                  <td className="text-muted fs-xs">{new Date(g.createdAt).toLocaleDateString()}</td>
                  <td className="text-muted fs-xs">{new Date(g.expiresAt).toLocaleDateString()}</td>
                  <td>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRevoke(g.id)}
                      disabled={revoking === g.id}
                      data-testid={`revoke-grant-${g.id}`}
                    >
                      {revoking === g.id ? 'Revoking…' : 'Revoke'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SettingSection>
    </>
  )
}

function ReportGenerateModal({ propertyId, propertyName, onClose }) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sections, setSections] = useState({ health: true, watering: true, feeding: true, photos: true })
  const [generating, setGenerating] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [error, setError] = useState(null)

  const toggleSection = (key) => setSections((s) => ({ ...s, [key]: !s[key] }))

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const result = await reportsApi.generate({
        propertyId,
        dateRange: { from: `${fromDate}T00:00:00.000Z`, to: `${toDate}T23:59:59.999Z` },
        includeSections: sections,
      })
      setDownloadUrl(result.downloadUrl)
    } catch (err) {
      setError(err.message || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="report-modal-title">Generate Care Report — {propertyName}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
            {downloadUrl ? (
              <div className="text-center py-3">
                <svg className="sa-icon sa-icon-2x mb-2 text-success" aria-hidden="true"><use href="/icons/sprite.svg#check-circle"></use></svg>
                <p className="mb-3">Your report is ready.</p>
                <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn btn-success">
                  <svg className="sa-icon me-1" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#download"></use></svg>
                  Download PDF
                </a>
              </div>
            ) : (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="fs-sm fw-semibold">Date range</Form.Label>
                  <div className="d-flex gap-2 align-items-center">
                    <Form.Control type="date" size="sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
                    <span className="text-muted fs-sm">to</span>
                    <Form.Control type="date" size="sm" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
                  </div>
                </Form.Group>
                <Form.Group>
                  <Form.Label className="fs-sm fw-semibold">Include sections</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {Object.entries(sections).map(([key, val]) => (
                      <Form.Check
                        key={key}
                        type="checkbox"
                        id={`section-${key}`}
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                        checked={val}
                        onChange={() => toggleSection(key)}
                      />
                    ))}
                  </div>
                </Form.Group>
              </>
            )}
          </div>
          {!downloadUrl && (
            <div className="modal-footer">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : 'Generate PDF'}
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose}></div>
    </div>
  )
}

function ReportsSection({ search }) {
  const { isGuest } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(!isGuest)
  const [error, setError] = useState(null)

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const { reports: list } = await reportsApi.list()
      setReports(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!isGuest) loadReports() }, [loadReports, isGuest])

  return (
    <SettingSection id="reports-history" title="Report History" icon="file-text" search={search}>
      {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
      {loading ? (
        <p className="text-muted fs-sm">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-muted fs-sm mb-0">No reports generated yet. Use the button above to generate your first report.</p>
      ) : (
        <Table size="sm" className="mb-0">
          <thead>
            <tr><th>Property</th><th>Period</th><th>Generated</th><th></th></tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.reportId}>
                <td className="fw-medium">{r.propertyName}</td>
                <td className="text-muted fs-xs">
                  {new Date(r.dateRange.from).toLocaleDateString()} – {new Date(r.dateRange.to).toLocaleDateString()}
                </td>
                <td className="text-muted fs-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  <a
                    href={reportsApi.downloadUrl(r.reportId)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline-secondary btn-sm"
                    data-testid={`download-report-${r.reportId}`}
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SettingSection>
  )
}

function ClientPropertiesTab({ search }) {
  const { properties, refresh } = useProperty()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('residential')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [reportModalProp, setReportModalProp] = useState(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await propertiesApi.create({ name: newName.trim(), type: newType })
      setNewName('')
      setCreating(false)
      await refresh()
    } catch (err) {
      setError(err.message || 'Failed to create property')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (id) => {
    try {
      await propertiesApi.archive(id)
      await refresh()
    } catch (err) {
      setError(err.message || 'Failed to archive property')
    }
  }

  return (
    <>
    {reportModalProp && (
      <ReportGenerateModal
        propertyId={reportModalProp.id}
        propertyName={reportModalProp.name}
        onClose={() => setReportModalProp(null)}
      />
    )}
    <SettingSection id="client-properties" title="Client Properties" icon="home" search={search}>
      <div className="p-0">
        <Table hover responsive className="mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id}>
                <td className="fw-medium">{p.name}</td>
                <td className="text-capitalize text-muted fs-sm">{p.type || 'residential'}</td>
                <td>
                  <div className="d-flex gap-1">
                    <Button variant="outline-primary" size="sm" onClick={() => setReportModalProp(p)} aria-label={`Generate report for ${p.name}`} data-testid={`report-btn-${p.id}`}>
                      Report
                    </Button>
                    {p.id !== 'primary' && (
                      <Button variant="outline-danger" size="sm" onClick={() => handleArchive(p.id)} aria-label={`Archive ${p.name}`}>
                        <svg className="sa-icon" style={{ width: 12, height: 12 }} aria-hidden="true"><use href="/icons/sprite.svg#trash"></use></svg>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {error && <p className="text-danger fs-sm px-3 pt-2 mb-0">{error}</p>}

        {creating ? (
          <div className="d-flex gap-2 p-3 border-top">
            <Form.Control size="sm" placeholder="Property name" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()} aria-label="New property name" autoFocus />
            <Form.Select size="sm" value={newType} onChange={(e) => setNewType(e.target.value)} style={{ maxWidth: 140 }} aria-label="Property type">
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="strata">Strata</option>
            </Form.Select>
            <Button size="sm" variant="primary" onClick={handleCreate} disabled={saving || !newName.trim()}>Save</Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="p-3 border-top">
            <Button size="sm" variant="outline-primary" onClick={() => setCreating(true)}>
              <svg className="sa-icon me-1" style={{ width: 12, height: 12 }} aria-hidden="true"><use href="/icons/sprite.svg#plus"></use></svg>
              Add property
            </Button>
          </div>
        )}
      </div>
    </SettingSection>
    <ReportsSection search={search} />
    </>
  )
}


const VALID_TABS = TABS.map((t) => t.id)
const ADMIN_TABS = new Set(['features', 'api-keys', 'advanced'])

export default function SettingsPage() {
  const { tab = 'property' } = useParams()
  const [search, setSearch] = useState('')

  // Which tabs match the current search query (used to badge the tab links)
  const matchingTabs = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return new Set(TABS.filter((t) => t.tags.includes(q) || t.label.toLowerCase().includes(q)).map((t) => t.id))
  }, [search])

  // Legacy URLs for tabs that have moved to the Admin page.
  if (ADMIN_TABS.has(tab)) {
    return <Navigate to={`/admin/${tab}`} replace />
  }
  if (!VALID_TABS.includes(tab)) {
    return <Navigate to="/settings/property" replace />
  }

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
        {tab === 'household' && <HouseholdTab search={search} />}
        {tab === 'data' && <DataTab search={search} />}
        {tab === 'client-properties' && <ClientPropertiesTab search={search} />}
        {tab === 'linked-devices' && <LinkedDevicesTab search={search} />}
        {tab === 'branding' && <BrandingTab search={search} />}
      </div>
    </div>
  )
}
