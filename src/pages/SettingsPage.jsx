import { useState, useCallback, useRef } from 'react'
import { Button, Form, Table, Badge, Card, Row, Col } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'

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

function FloorRow({ floor, onChange, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <tr className={floor.hidden ? 'opacity-50' : ''}>
      <td>
        <Form.Check
          type="switch"
          checked={!floor.hidden}
          onChange={() => onChange({ ...floor, hidden: !floor.hidden })}
          label=""
        />
      </td>
      <td>
        <Form.Control
          size="sm"
          value={floor.name}
          onChange={(e) => onChange({ ...floor, name: e.target.value })}
          className="border-0 bg-transparent"
        />
      </td>
      <td>
        <Badge
          bg={floor.type === 'outdoor' ? 'success' : 'info'}
          className="cursor-pointer"
          style={{ cursor: 'pointer' }}
          onClick={() => onChange({ ...floor, type: floor.type === 'outdoor' ? 'interior' : 'outdoor' })}
        >
          {floor.type === 'outdoor' ? 'outdoor' : 'interior'}
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
  )
}

export default function SettingsPage() {
  const { floors, handleSaveFloors, handleFloorplanUpload, isAnalysingFloorplan, tempUnit, isGuest } = usePlantContext()
  const { theme, changeTheme, selectedTheme, changeThemeStyle } = useLayoutContext()
  const fileInputRef = useRef(null)
  const [editableFloors, setEditableFloors] = useState(
    () => (floors || []).map((f) => ({ ...f, rooms: (f.rooms || []).map((r) => ({ ...r })) })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('interior')

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
                  <Button
                    variant="outline-default"
                    size="sm"
                    className="me-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalysingFloorplan || isGuest}
                  >
                    <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#upload"></use></svg>
                    {isAnalysingFloorplan ? 'Analysing...' : 'Upload Floorplan'}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="d-none"
                    onChange={(e) => { if (e.target.files?.[0]) handleFloorplanUpload(e.target.files[0]); e.target.value = '' }} />
                  <Button variant={saved ? 'success' : 'primary'} size="sm" onClick={handleSave} disabled={saving}>
                    {saved ? 'Saved!' : 'Save Floors'}
                  </Button>
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
                      <FloorRow key={floor.id} floor={floor} onChange={handleFloorChange} onDelete={handleDeleteFloor} />
                    ))}
                  </tbody>
                </Table>

                {/* Add zone */}
                <div className="d-flex gap-2 p-3 border-top">
                  <Form.Control size="sm" placeholder="Zone name (e.g. Loft)" value={newName}
                    onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()} />
                  <Form.Select size="sm" value={newType} onChange={(e) => setNewType(e.target.value)} style={{ width: 120 }}>
                    <option value="interior">Interior</option>
                    <option value="outdoor">Outdoor</option>
                  </Form.Select>
                  <Button variant="primary" size="sm" onClick={handleAddFloor} disabled={!newName.trim()}>
                    <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#plus"></use></svg>
                  </Button>
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
                  <div className="d-flex align-items-center justify-content-between">
                    <span>Temperature</span>
                    <Button variant="outline-default" size="sm" onClick={tempUnit.toggle}>
                      <svg className="sa-icon me-1"><use href="/icons/sprite.svg#thermometer"></use></svg>
                      {tempUnit.unit === 'celsius' ? '°C → °F' : '°F → °C'}
                    </Button>
                  </div>
                )}
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
      </div>
    </div>
  )
}
