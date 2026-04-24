import { useMemo } from 'react'
import { Form, InputGroup, FormControl, Button, Badge } from 'react-bootstrap'

/**
 * Shared filter bar used across the Dashboard plant list, Calendar, and Analytics.
 *
 * Props:
 *   filters     – { search, room, health, overdue } (controlled)
 *   onChange    – (patch) => void  — merges patch into filters
 *   rooms       – string[]         — available room names
 *   resultCount – number           — plants matching current filters
 *   className   – string
 */
export default function FilterBar({ filters = {}, onChange, rooms = [], resultCount, className = '' }) {
  const { search = '', room = '', health = '', overdue = false } = filters

  const hasFilters = search || room || health || overdue

  const appliedChips = useMemo(() => {
    const chips = []
    if (search) chips.push({ key: 'search', label: `"${search}"`, clear: () => onChange({ search: '' }) })
    if (room) chips.push({ key: 'room', label: room, clear: () => onChange({ room: '' }) })
    if (health) chips.push({ key: 'health', label: health, clear: () => onChange({ health: '' }) })
    if (overdue) chips.push({ key: 'overdue', label: 'Overdue only', clear: () => onChange({ overdue: false }) })
    return chips
  }, [search, room, health, overdue, onChange])

  return (
    <div className={`filter-bar d-flex flex-column gap-2 ${className}`} data-testid="filter-bar">
      {/* Search input */}
      <InputGroup size="sm">
        <InputGroup.Text aria-hidden="true">
          <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#search" /></svg>
        </InputGroup.Text>
        <FormControl
          placeholder="Search by name or species…"
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
          aria-label="Search plants"
        />
        {search && (
          <Button variant="outline-secondary" size="sm" onClick={() => onChange({ search: '' })} aria-label="Clear search">
            ×
          </Button>
        )}
      </InputGroup>

      {/* Predicate row */}
      <div className="d-flex gap-2 flex-wrap align-items-center">
        {rooms.length > 1 && (
          <Form.Select
            size="sm"
            style={{ width: 'auto', minWidth: 120 }}
            value={room}
            onChange={(e) => onChange({ room: e.target.value })}
            aria-label="Filter by room"
          >
            <option value="">All zones</option>
            {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
          </Form.Select>
        )}

        <Form.Select
          size="sm"
          style={{ width: 'auto', minWidth: 120 }}
          value={health}
          onChange={(e) => onChange({ health: e.target.value })}
          aria-label="Filter by health"
        >
          <option value="">All health</option>
          {['Excellent', 'Good', 'Fair', 'Poor'].map((h) => <option key={h} value={h}>{h}</option>)}
        </Form.Select>

        <Form.Check
          type="switch"
          id="filter-overdue"
          label={<small>Overdue only</small>}
          checked={overdue}
          onChange={(e) => onChange({ overdue: e.target.checked })}
          className="mb-0"
        />

        {hasFilters && (
          <Button
            variant="link"
            size="sm"
            className="text-muted p-0 ms-auto"
            onClick={() => onChange({ search: '', room: '', health: '', overdue: false })}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Applied filter chips */}
      {appliedChips.length > 0 && (
        <div className="d-flex gap-1 flex-wrap align-items-center">
          {appliedChips.map((chip) => (
            <Badge
              key={chip.key}
              bg="secondary"
              className="d-flex align-items-center gap-1 fw-400"
              style={{ cursor: 'pointer' }}
              onClick={chip.clear}
              role="button"
              aria-label={`Remove filter: ${chip.label}`}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && chip.clear()}
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </Badge>
          ))}
          {resultCount != null && (
            <small className="text-muted ms-1">{resultCount} plant{resultCount !== 1 ? 's' : ''}</small>
          )}
        </div>
      )}
    </div>
  )
}
