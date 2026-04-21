import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useCommandPalette } from '../context/CommandPaletteContext.jsx'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import { getPlantEmoji } from '../utils/plantEmoji.js'

const PAGES = [
  { id: 'page-dashboard',  label: 'Dashboard',     icon: 'home',        path: '/' },
  { id: 'page-today',      label: 'Today',          icon: 'sun',         path: '/today' },
  { id: 'page-analytics',  label: 'Analytics',      icon: 'bar-chart-2', path: '/analytics' },
  { id: 'page-calendar',   label: 'Calendar',       icon: 'calendar',    path: '/calendar' },
  { id: 'page-forecast',   label: 'Forecast',       icon: 'cloud-rain',  path: '/forecast' },
  { id: 'page-settings',   label: 'Settings',       icon: 'settings',    path: '/settings' },
  { id: 'page-bulk',       label: 'Bulk Upload',    icon: 'upload',      path: '/bulk-upload' },
  { id: 'page-pricing',    label: 'Pricing',        icon: 'tag',         path: '/pricing' },
]

const THEMES = ['olive', 'earth', 'aurora', 'lunar', 'nebula', 'night', 'solar', 'storm', 'flare']

function fuzzyMatch(text, query) {
  if (!query) return true
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  return t.includes(q)
}

function matchScore(text, query) {
  if (!query) return 0
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t.startsWith(q)) return 3
  if (t.includes(q)) return 2
  return 0
}

export default function CommandPalette() {
  const { isOpen, close, recentPlantIds, trackPlant } = useCommandPalette()
  const { plants = [], handleWaterPlant } = usePlantContext()
  const { theme, changeTheme, changeThemeStyle } = useLayoutContext()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  const recentPlants = useMemo(
    () => recentPlantIds.map(id => plants.find(p => p.id === id)).filter(Boolean),
    [recentPlantIds, plants],
  )

  const items = useMemo(() => {
    const q = query.trim()

    if (!q) {
      const groups = []

      if (recentPlants.length > 0) {
        groups.push({
          group: 'Recent Plants',
          items: recentPlants.map(p => ({
            id: `recent-${p.id}`,
            label: p.name || p.species,
            subtitle: p.room || p.species,
            icon: null,
            emoji: getPlantEmoji(p),
            action: 'plant',
            plant: p,
          })),
        })
      }

      groups.push({
        group: 'Pages',
        items: PAGES.map(p => ({
          id: p.id,
          label: p.label,
          icon: p.icon,
          action: 'navigate',
          path: p.path,
        })),
      })

      groups.push({
        group: 'Actions',
        items: [
          { id: 'act-add-plant',    label: 'Add plant',        icon: 'plus',          action: 'add-plant' },
          { id: 'act-water-all',    label: 'Water all overdue plants', icon: 'droplets', action: 'water-all' },
          { id: 'act-toggle-dark',  label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`, icon: theme === 'light' ? 'moon' : 'sun', action: 'toggle-dark' },
        ],
      })

      return groups
    }

    const plantMatches = plants
      .filter(p => fuzzyMatch(p.name || '', q) || fuzzyMatch(p.species || '', q) || fuzzyMatch(p.room || '', q))
      .sort((a, b) => {
        const sa = Math.max(matchScore(a.name || '', q), matchScore(a.species || '', q))
        const sb = Math.max(matchScore(b.name || '', q), matchScore(b.species || '', q))
        return sb - sa
      })
      .slice(0, 8)
      .map(p => ({
        id: `plant-${p.id}`,
        label: p.name || p.species,
        subtitle: `${p.species || ''}${p.room ? ` · ${p.room}` : ''}`,
        emoji: getPlantEmoji(p),
        action: 'plant',
        plant: p,
      }))

    const pageMatches = PAGES
      .filter(p => fuzzyMatch(p.label, q))
      .map(p => ({ id: p.id, label: p.label, icon: p.icon, action: 'navigate', path: p.path }))

    const themeMatches = THEMES
      .filter(t => fuzzyMatch(t, q))
      .map(t => ({ id: `theme-${t}`, label: `Switch to ${t} theme`, icon: 'palette', action: 'theme', theme: t }))

    const actionMatches = [
      { id: 'act-add-plant',    label: 'Add plant',        icon: 'plus',          action: 'add-plant' },
      { id: 'act-water-all',    label: 'Water all overdue plants', icon: 'droplets', action: 'water-all' },
      { id: 'act-toggle-dark',  label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`, icon: theme === 'light' ? 'moon' : 'sun', action: 'toggle-dark' },
    ].filter(a => fuzzyMatch(a.label, q))

    const groups = []
    if (plantMatches.length) groups.push({ group: 'Plants', items: plantMatches })
    if (pageMatches.length)  groups.push({ group: 'Pages',   items: pageMatches })
    if (themeMatches.length) groups.push({ group: 'Themes',  items: themeMatches })
    if (actionMatches.length) groups.push({ group: 'Actions', items: actionMatches })
    return groups
  }, [query, plants, recentPlants, theme])

  const flatItems = useMemo(() => items.flatMap(g => g.items), [items])

  const executeItem = useCallback((item) => {
    close()
    if (item.action === 'plant') {
      trackPlant(item.plant.id)
      navigate('/', { state: { openPlantId: item.plant.id } })
    } else if (item.action === 'navigate') {
      navigate(item.path)
    } else if (item.action === 'add-plant') {
      navigate('/', { state: { addPlant: true } })
    } else if (item.action === 'water-all') {
      const now = Date.now()
      for (const p of plants) {
        if (p.lastWatered && p.frequencyDays) {
          const overdue = (now - new Date(p.lastWatered).getTime()) / 86400000 > p.frequencyDays
          if (overdue) handleWaterPlant(p.id).catch(() => {})
        }
      }
    } else if (item.action === 'toggle-dark') {
      changeTheme(theme === 'light' ? 'dark' : 'light')
    } else if (item.action === 'theme') {
      changeThemeStyle(item.theme)
    }
  }, [close, navigate, plants, handleWaterPlant, theme, changeTheme, changeThemeStyle, trackPlant])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatItems[selectedIndex]) executeItem(flatItems[selectedIndex])
    }
  }, [close, flatItems, selectedIndex, executeItem])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector('[data-selected="true"]')
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  let globalIndex = 0

  return createPortal(
    <div
      className="cmd-palette-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="cmd-palette"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        <div className="cmd-palette-search">
          <svg className="sa-icon cmd-palette-search-icon" aria-hidden="true">
            <use href="/icons/sprite.svg#search" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Search plants, pages, actions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Command palette search"
            aria-autocomplete="list"
            aria-controls="cmd-palette-listbox"
            aria-activedescendant={flatItems[selectedIndex] ? `cmd-item-${flatItems[selectedIndex].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmd-palette-esc" aria-label="Press Escape to close">esc</kbd>
        </div>

        <div id="cmd-palette-listbox" role="listbox" ref={listRef} className="cmd-palette-results">
          {flatItems.length === 0 ? (
            <p className="cmd-palette-empty">No results for &ldquo;{query}&rdquo;</p>
          ) : items.map(group => (
            <div key={group.group} className="cmd-palette-group">
              <div className="cmd-palette-group-label" role="presentation">{group.group}</div>
              {group.items.map(item => {
                const idx = globalIndex++
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={item.id}
                    id={`cmd-item-${item.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    className={`cmd-palette-item${isSelected ? ' cmd-palette-item--selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onMouseDown={(e) => { e.preventDefault(); executeItem(item) }}
                  >
                    <span className="cmd-palette-item-icon" aria-hidden="true">
                      {item.emoji
                        ? <span style={{ fontSize: 16 }}>{item.emoji}</span>
                        : <svg className="sa-icon"><use href={`/icons/sprite.svg#${item.icon || 'circle'}`} /></svg>
                      }
                    </span>
                    <span className="cmd-palette-item-label">
                      {item.label}
                      {item.subtitle && <span className="cmd-palette-item-sub">{item.subtitle}</span>}
                    </span>
                    {item.action === 'plant' && (
                      <span className="cmd-palette-item-badge">plant</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="cmd-palette-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
