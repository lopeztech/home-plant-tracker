import { useState, useCallback, useRef } from 'react'
import { Button, Form, Table, Badge, Card, Row, Col } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import LeafletFloorplan from '../components/LeafletFloorplan.jsx'

const THEMES = [
  { id: 'olive', label: 'Olive', color: '#556B2F' },
  { id: 'earth', label: 'Earth', color: '#8B7355' },
  { id: 'aurora', label: 'Aurora', color: '#9b2791' },
  { id: 'lunar', label: 'Lunar', color: '#557596' },
  { id: 'nebula', label: 'Nebula', color: '#5c6bc0' },
  { id: 'night', label: 'Night', color: '#37508a' },
  { id: 'solar', label: 'Solar', color: '#c97a1d' },
  { id: 'storm', label: 'Storm', color: '#4a6fa5' },
  { id: 'flare', label: 'Flare', color: '#c0392b' },
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

export default function SettingsPage() {
  const { floors, handleSaveFloors, handleFloorplanUpload, isAnalysingFloorplan, tempUnit, isGuest, location, setLocation } = usePlantContext()
  const { theme, changeTheme, selectedTheme, changeThemeStyle } = useLayoutContext()
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
    <div className="content-wrapper">
      <h1 className="subheader-title mb-4">Settings</h1>
      <div className="main-content">
        <Row>
          {/* Floors & Zones */}
          <Col xl={8} className="mb-4">
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
          </Col>

          {/* Preferences */}
          <Col xl={4} className="mb-4">
            <div className="panel panel-icon mb-4">
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
                  <div className="d-flex gap-2 align-items-center">
                    <Form.Control
                      size="sm"
                      value={location?.name || ''}
                      onChange={(e) => setLocation(e.target.value ? { ...location, name: e.target.value } : null)}
                      placeholder="Auto-detected from GPS"
                    />
                    {location?.name && (
                      <Button variant="outline-danger" size="sm" className="flex-shrink-0" onClick={() => setLocation(null)} title="Reset to GPS">
                        <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#x"></use></svg>
                      </Button>
                    )}
                  </div>
                  {location?.country && <small className="text-muted">{location.country}</small>}
                </div>
              </div></div>
            </div>

            {/* Theme selector */}
            <div className="panel panel-icon">
              <div className="panel-hdr"><span>Color Theme</span></div>
              <div className="panel-container"><div className="panel-content">
                <div className="d-flex flex-wrap gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => changeThemeStyle(t.id)}
                      className={`btn btn-sm d-flex align-items-center gap-2 ${selectedTheme === t.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                      title={t.label}
                    >
                      <span className="rounded-circle d-inline-block" style={{ width: 12, height: 12, background: t.color }} />
                      <span className="fs-xs">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div></div>
            </div>
          </Col>
        </Row>

        {/* Version */}
        <div className="text-muted fs-xs mt-2">
          Version: {__APP_VERSION__} &middot; Built: {new Date(__BUILD_TIME__).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
