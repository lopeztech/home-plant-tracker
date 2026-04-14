import { useState, useCallback, useRef } from 'react'
import { Button, Form, Table, Badge } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import LeafletFloorplan from '../components/LeafletFloorplan.jsx'
import { YARD_AREAS } from '../utils/watering.js'


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
              <p className="text-muted fs-xs mb-3">
                <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#info"></use></svg>
                Drag rooms to move, drag corners to resize, or draw new zones by clicking and dragging on empty space.
              </p>

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
                        bg={room.type === 'outdoor' ? 'success' : 'info'}
                        style={{ cursor: 'pointer', fontSize: '0.65rem' }}
                        onClick={() => updateRoom(i, { type: room.type === 'outdoor' ? 'indoor' : 'outdoor' })}
                        title="Toggle indoor/outdoor"
                      >
                        {room.type === 'outdoor' ? '☀ outdoor' : '🏠 indoor'}
                      </Badge>
                      {(room.type === 'outdoor' || floor.type === 'outdoor') && (
                        <Form.Select
                          size="sm"
                          value={room.area || 'frontyard'}
                          onChange={(e) => updateRoom(i, { area: e.target.value })}
                          style={{ width: 120, fontSize: '0.7rem' }}
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

function LayoutPreview({ houseHeight, outdoorHeight, sideWidth, onChangeHouseHeight, onChangeOutdoorHeight, onChangeSideWidth }) {
  const SCALE = 0.4 // scale down for preview
  const MIN_HOUSE = 200, MAX_HOUSE = 800
  const MIN_OUTDOOR = 100, MAX_OUTDOOR = 500
  const MIN_SIDE = 80, MAX_SIDE = 300

  const dragRef = useRef(null)

  const onMouseDown = useCallback((type, e) => {
    e.preventDefault()
    dragRef.current = { type, startY: e.clientY, startX: e.clientX, startVal: type === 'house' ? houseHeight : type === 'outdoor' ? outdoorHeight : sideWidth }
    const onMouseMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      if (d.type === 'house') {
        const delta = (ev.clientY - d.startY) / SCALE
        onChangeHouseHeight(Math.round(Math.max(MIN_HOUSE, Math.min(MAX_HOUSE, d.startVal + delta)) / 25) * 25)
      } else if (d.type === 'outdoor') {
        const delta = (ev.clientY - d.startY) / SCALE
        onChangeOutdoorHeight(Math.round(Math.max(MIN_OUTDOOR, Math.min(MAX_OUTDOOR, d.startVal + delta)) / 25) * 25)
      } else {
        const delta = (ev.clientX - d.startX) / SCALE
        onChangeSideWidth(Math.round(Math.max(MIN_SIDE, Math.min(MAX_SIDE, d.startVal + delta)) / 10) * 10)
      }
    }
    const onMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [houseHeight, outdoorHeight, sideWidth, onChangeHouseHeight, onChangeOutdoorHeight, onChangeSideWidth])

  const hH = houseHeight * SCALE
  const oH = outdoorHeight * SCALE
  const sW = sideWidth * SCALE
  const houseW = 200 // fixed preview house width

  const handleStyle = {
    position: 'absolute', left: 0, right: 0, height: 8, cursor: 'ns-resize',
    background: 'var(--bs-primary)', opacity: 0.5, borderRadius: 4, zIndex: 10,
    transition: 'opacity 0.15s',
  }
  const handleHoverProps = {
    onMouseEnter: (e) => { e.currentTarget.style.opacity = '1' },
    onMouseLeave: (e) => { e.currentTarget.style.opacity = '0.5' },
  }

  return (
    <div className="d-flex flex-column align-items-center gap-1" style={{ userSelect: 'none' }}>
      {/* Backyard */}
      <div className="position-relative" style={{ width: houseW, height: oH, background: '#e8f5e9', border: '2px dashed #4caf50', borderRadius: 6 }}>
        <div className="d-flex align-items-center justify-content-center h-100">
          <small className="text-muted fw-500 fs-xs">Backyard ({outdoorHeight}px)</small>
        </div>
        <div style={{ ...handleStyle, bottom: -4 }} onMouseDown={(e) => onMouseDown('outdoor', e)} {...handleHoverProps} />
      </div>

      {/* House + sides row */}
      <div className="d-flex align-items-stretch gap-1">
        {/* Side Left */}
        <div className="position-relative" style={{ width: sW, height: hH, background: '#e8f5e9', border: '2px dashed #4caf50', borderRadius: 6 }}>
          <div className="d-flex align-items-center justify-content-center h-100">
            <small className="text-muted fw-500 fs-xs" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Side ({sideWidth}px)</small>
          </div>
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: -4, width: 8, cursor: 'ew-resize', background: 'var(--bs-primary)', opacity: 0.5, borderRadius: 4, zIndex: 10, transition: 'opacity 0.15s' }}
            onMouseDown={(e) => onMouseDown('side', e)}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
          />
        </div>

        {/* House */}
        <div className="position-relative" style={{ width: houseW, height: hH, background: 'var(--bs-body-bg)', border: '2px solid rgba(0,0,0,0.15)', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div className="d-flex align-items-center justify-content-center h-100">
            <small className="fw-600 fs-xs">House ({houseHeight}px)</small>
          </div>
          <div style={{ ...handleStyle, bottom: -4 }} onMouseDown={(e) => onMouseDown('house', e)} {...handleHoverProps} />
        </div>

        {/* Side Right */}
        <div style={{ width: sW, height: hH, background: '#e8f5e9', border: '2px dashed #4caf50', borderRadius: 6 }}>
          <div className="d-flex align-items-center justify-content-center h-100">
            <small className="text-muted fw-500 fs-xs" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Side ({sideWidth}px)</small>
          </div>
        </div>
      </div>

      {/* Frontyard */}
      <div className="position-relative" style={{ width: houseW, height: oH, background: '#e8f5e9', border: '2px dashed #4caf50', borderRadius: 6 }}>
        <div className="d-flex align-items-center justify-content-center h-100">
          <small className="text-muted fw-500 fs-xs">Front Yard ({outdoorHeight}px)</small>
        </div>
        <div style={{ ...handleStyle, bottom: -4 }} onMouseDown={(e) => onMouseDown('outdoor', e)} {...handleHoverProps} />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { floors, handleSaveFloors, handleFloorplanUpload, isAnalysingFloorplan, tempUnit, isGuest, location, setLocation } = usePlantContext()
  const { theme, changeTheme, houseHeight, outdoorHeight, sideWidth, toggleSetting } = useLayoutContext()
  const fileInputRef = useRef(null)
  const [editableFloors, setEditableFloors] = useState(
    () => (floors || []).map((f) => ({ ...f, rooms: (f.rooms || []).map((r) => ({ ...r })) })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('indoor')
  const [expandedFloorId, setExpandedFloorId] = useState(null)
  const [locationSearch, setLocationSearch] = useState('')
  const [locationResults, setLocationResults] = useState([])
  const [locationSearching, setLocationSearching] = useState(false)

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
    <div className="content-wrapper">
      <h1 className="subheader-title mb-4">Settings</h1>
      <div className="main-content">
        <div>
          {/* Floors & Zones */}
          <div className="mb-4">
            <div className="panel panel-icon">
              <div className="panel-hdr">
                <span>
                  <svg className="sa-icon me-2"><use href="/icons/sprite.svg#layers"></use></svg>
                  Floors & Zones
                </span>
                <div className="panel-toolbar">
                </div>
              </div>
              <div className="panel-container"><div className="panel-content p-0">
                <Table hover responsive className="mb-0">
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
                  <Form.Select size="sm" value={newType} onChange={(e) => setNewType(e.target.value)} style={{ width: 120 }}>
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

                {/* Upload floorplan */}
                <div className="p-3 border-top">
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
                  <small className="text-muted d-block mt-1">Upload a photo of your floor plan — Gemini AI will identify rooms automatically</small>
                </div>
              </div></div>
            </div>
          </div>

          {/* Preferences */}
          <div className="mb-4">
            <div className="panel panel-icon">
              <div className="panel-hdr"><span>Preferences</span></div>
              <div className="panel-container"><div className="panel-content">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span>Theme</span>
                  <Button variant="outline-default" size="sm" onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}>
                    <svg className="sa-icon me-1"><use href={`/icons/sprite.svg#${theme === 'dark' ? 'sun' : 'moon'}`}></use></svg>
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </Button>
                </div>
                {tempUnit && (
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span>Temperature</span>
                    <Button variant="outline-default" size="sm" onClick={tempUnit.toggle}>
                      <svg className="sa-icon me-1"><use href="/icons/sprite.svg#thermometer"></use></svg>
                      {tempUnit.unit === 'celsius' ? '°C → °F' : '°F → °C'}
                    </Button>
                  </div>
                )}
                <div>
                  <span className="d-block mb-1">Location</span>
                  {location?.name && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#map-pin"></use></svg>
                      <span className="fw-500">{location.name}</span>
                      {location.country && <small className="text-muted">({location.country})</small>}
                      <Button variant="link" size="sm" className="p-0 text-danger ms-auto" onClick={() => setLocation(null)} title="Reset to GPS">
                        <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#x"></use></svg>
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
                </div>
              </div></div>
            </div>

          </div>

          {/* Layout sizes — interactive preview */}
          <div className="mb-4">
            <div className="panel panel-icon">
              <div className="panel-hdr"><span>Layout Sizes</span></div>
              <div className="panel-container"><div className="panel-content">
                <p className="text-muted fs-xs mb-3">Drag the edges of each area to resize. Changes apply instantly.</p>
                <LayoutPreview
                  houseHeight={houseHeight || 500}
                  outdoorHeight={outdoorHeight || 200}
                  sideWidth={sideWidth || 140}
                  onChangeHouseHeight={(v) => toggleSetting('houseHeight', v)}
                  onChangeOutdoorHeight={(v) => toggleSetting('outdoorHeight', v)}
                  onChangeSideWidth={(v) => toggleSetting('sideWidth', v)}
                />
              </div></div>
            </div>
          </div>
        </div>

        {/* Version */}
        <div className="text-muted fs-xs mt-2">
          Version: {__APP_VERSION__} &middot; Built: {new Date(__BUILD_TIME__).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
