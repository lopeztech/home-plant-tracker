import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BulkPlantCard from '../components/BulkPlantCard.jsx'

const floors = [
  { id: 'ground', name: 'Ground Floor', rooms: [{ name: 'Kitchen' }, { name: 'Living Room' }] },
  { id: 'first', name: 'First Floor', rooms: [{ name: 'Bedroom' }] },
]

const rooms = ['Kitchen', 'Living Room', 'Bedroom']

function makeEntry(overrides = {}) {
  return {
    id: 'entry-1',
    file: new File(['data'], 'plant.jpg', { type: 'image/jpeg' }),
    previewUrl: 'blob:fake-url',
    status: 'ready',
    stageIndex: 0,
    error: null,
    form: {
      name: 'Monstera - Kitchen',
      species: 'Monstera deliciosa',
      room: 'Kitchen',
      floor: 'ground',
      frequencyDays: 7,
      health: 'Good',
      maturity: 'Mature',
      plantedIn: 'pot',
      waterAmount: '200ml',
      waterMethod: 'jug',
      potSize: '',
      soilType: '',
    },
    ...overrides,
  }
}

describe('BulkPlantCard', () => {
  let onChange, onRemove, onRetry

  beforeEach(() => {
    onChange = vi.fn()
    onRemove = vi.fn()
    onRetry = vi.fn()
  })

  function renderCard(entryOverrides = {}) {
    const entry = makeEntry(entryOverrides)
    return render(
      <BulkPlantCard
        entry={entry}
        floors={floors}
        rooms={rooms}
        onChange={onChange}
        onRemove={onRemove}
        onRetry={onRetry}
      />,
    )
  }

  it('renders the species field when ready', () => {
    renderCard()
    expect(screen.getByDisplayValue('Monstera deliciosa')).toBeInTheDocument()
  })

  it('renders health and maturity badges', () => {
    renderCard()
    const badges = document.querySelectorAll('.badge')
    const badgeTexts = Array.from(badges).map((b) => b.textContent)
    expect(badgeTexts).toContain('Good')
    expect(badgeTexts).toContain('Mature')
  })

  it('renders frequency badge', () => {
    renderCard()
    expect(screen.getByText('Every 7d')).toBeInTheDocument()
  })

  it('calls onChange when species is edited', () => {
    renderCard()
    const speciesInput = screen.getByDisplayValue('Monstera deliciosa')
    fireEvent.change(speciesInput, { target: { value: 'Monstera adansonii' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({ species: 'Monstera adansonii' }),
      }),
    )
  })

  it('calls onRemove when X button is clicked', () => {
    renderCard()
    // The remove button is the small X button on the image
    const buttons = screen.getAllByRole('button')
    const removeBtn = buttons.find((b) => b.querySelector('use[href*="x"]'))
    fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalled()
  })

  it('shows analysing state with spinner', () => {
    renderCard({ status: 'analysing' })
    expect(screen.getByText('Analysing photo...')).toBeInTheDocument()
  })

  it('shows pending state', () => {
    renderCard({ status: 'pending' })
    expect(screen.getByText('Waiting...')).toBeInTheDocument()
  })

  it('shows saving overlay', () => {
    renderCard({ status: 'saving' })
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('shows saved overlay with check icon', () => {
    renderCard({ status: 'saved' })
    const checkIcon = document.querySelector('use[href*="check-circle"]')
    expect(checkIcon).toBeInTheDocument()
  })

  it('shows error message with retry button', () => {
    renderCard({ status: 'error', error: 'Analysis failed: timeout' })
    expect(screen.getByText(/Analysis failed: timeout/)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalled()
  })

  it('shows floor and room dropdowns', () => {
    renderCard()
    const selects = screen.getAllByRole('combobox')
    // floor, room, plantedIn
    expect(selects.length).toBeGreaterThanOrEqual(3)
  })

  it('toggles advanced options', () => {
    renderCard()
    const toggleBtn = screen.getByText(/more options/i)
    expect(toggleBtn.textContent).toMatch(/more/i)
    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toMatch(/hide/i)
  })

  it('shows pot size and soil type when plantedIn is pot', () => {
    renderCard()
    fireEvent.click(screen.getByText(/more options/i))
    // Should show pot size and soil type selects
    const options = screen.getAllByRole('combobox')
    const potSizeSelect = options.find((s) => Array.from(s.options).some((o) => o.textContent.includes('Small')))
    expect(potSizeSelect).toBeTruthy()
  })

  it('hides remove button when saving', () => {
    renderCard({ status: 'saving' })
    const removeBtn = document.querySelector('use[href*="#x"]')
    expect(removeBtn).not.toBeInTheDocument()
  })

  it('hides remove button when saved', () => {
    renderCard({ status: 'saved' })
    const removeBtn = document.querySelector('use[href*="#x"]')
    expect(removeBtn).not.toBeInTheDocument()
  })

  it('auto-updates room when floor changes to a floor without the current room', () => {
    renderCard()
    // Change floor from 'ground' (Kitchen, Living Room) to 'first' (Bedroom)
    const selects = screen.getAllByRole('combobox')
    const floorSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.textContent === 'First Floor'),
    )
    fireEvent.change(floorSelect, { target: { value: 'first' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({ floor: 'first', room: 'Bedroom' }),
      }),
    )
  })

  it('keeps room when switching to a floor that has the same room', () => {
    // Entry has room 'Kitchen' on floor 'ground'
    // Switching to a floor that also has 'Kitchen' should keep it
    const floorsWithShared = [
      { id: 'ground', name: 'Ground Floor', rooms: [{ name: 'Kitchen' }, { name: 'Living Room' }] },
      { id: 'first', name: 'First Floor', rooms: [{ name: 'Kitchen' }, { name: 'Bedroom' }] },
    ]
    const entry = makeEntry()
    render(
      <BulkPlantCard
        entry={entry}
        floors={floorsWithShared}
        rooms={rooms}
        onChange={onChange}
        onRemove={onRemove}
        onRetry={onRetry}
      />,
    )
    const selects = screen.getAllByRole('combobox')
    const floorSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.textContent === 'First Floor'),
    )
    fireEvent.change(floorSelect, { target: { value: 'first' } })
    // Room should stay as 'Kitchen' since 'first' floor also has it
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({ floor: 'first', room: 'Kitchen' }),
      }),
    )
  })
})
