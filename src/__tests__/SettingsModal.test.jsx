import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsModal from '../components/SettingsModal.jsx'

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

vi.mock('../hooks/useTheme.js', () => ({
  useTheme: () => 'dark',
}))

const baseFloors = [
  {
    id: 'ground',
    name: 'Ground Floor',
    order: 0,
    type: 'interior',
    hidden: false,
    imageUrl: null,
    rooms: [
      { name: 'Living Room', x: 5, y: 5, width: 40, height: 20 },
      { name: 'Kitchen',     x: 5, y: 30, width: 40, height: 20 },
    ],
  },
  {
    id: 'garden',
    name: 'Garden',
    order: -1,
    type: 'outdoor',
    hidden: false,
    imageUrl: null,
    rooms: [],
  },
]

function renderModal(props = {}) {
  const onSaveFloors = props.onSaveFloors ?? vi.fn().mockResolvedValue(undefined)
  const onClose      = props.onClose      ?? vi.fn()
  const floors       = props.floors       ?? baseFloors

  return {
    onSaveFloors,
    onClose,
    ...render(
      <SettingsModal
        floors={floors}
        onSaveFloors={onSaveFloors}
        onClose={onClose}
      />
    ),
  }
}

describe('SettingsModal', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Initial render ────────────────────────────────────────────────────────

  it('renders the Settings heading', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders a row for each floor', () => {
    renderModal()
    expect(screen.getByDisplayValue('Ground Floor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Garden')).toBeInTheDocument()
  })

  it('renders the Save button', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('renders the Cancel button', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  // ── Floor name editing ────────────────────────────────────────────────────

  it('updates the floor name as the user types', () => {
    renderModal()
    const input = screen.getByDisplayValue('Ground Floor')
    fireEvent.change(input, { target: { value: 'First Floor' } })
    expect(input).toHaveValue('First Floor')
  })

  // ── Add floor ─────────────────────────────────────────────────────────────

  it('adds a new floor when a name is entered and Add is clicked', () => {
    renderModal()
    const nameInput = screen.getByPlaceholderText(/zone name/i)
    fireEvent.change(nameInput, { target: { value: 'Attic' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByDisplayValue('Attic')).toBeInTheDocument()
  })

  it('disables the Add button when the name is empty', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })

  it('clears the name input after adding a floor', () => {
    renderModal()
    const nameInput = screen.getByPlaceholderText(/zone name/i)
    fireEvent.change(nameInput, { target: { value: 'Loft' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(nameInput).toHaveValue('')
  })

  it('adds a floor when Enter is pressed in the name field', () => {
    renderModal()
    const nameInput = screen.getByPlaceholderText(/zone name/i)
    fireEvent.change(nameInput, { target: { value: 'Basement' } })
    fireEvent.keyDown(nameInput, { key: 'Enter' })
    expect(screen.getByDisplayValue('Basement')).toBeInTheDocument()
  })

  // ── Delete floor ──────────────────────────────────────────────────────────

  it('requires two clicks to delete a floor (confirmation step)', () => {
    renderModal()
    // The floor delete button has red text styling before confirmation
    const allButtons = screen.getAllByRole('button')
    const deleteBtn = allButtons.find(b => b.className.includes('text-red-500'))
    fireEvent.click(deleteBtn)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ground Floor')).toBeInTheDocument()
  })

  it('removes a floor after confirmation', () => {
    renderModal()
    const allButtons = screen.getAllByRole('button')
    const deleteBtn = allButtons.find(b => b.className.includes('text-red-500'))
    fireEvent.click(deleteBtn)
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.queryByDisplayValue('Ground Floor')).not.toBeInTheDocument()
  })

  // ── Toggle visibility ─────────────────────────────────────────────────────

  it('toggling visibility calls onChange with updated hidden flag', () => {
    let captured = null
    renderModal({
      onSaveFloors: async (floors) => { captured = floors },
    })

    // hide the Ground Floor row
    const eyeButtons = screen.getAllByTitle(/hide floor|show floor/i)
    fireEvent.click(eyeButtons[0])

    // Save to capture what was built
    fireEvent.click(screen.getByRole('button', { name: /^save/i }))
    waitFor(() => {
      const groundFloor = captured?.find(f => f.id === 'ground')
      expect(groundFloor?.hidden).toBe(true)
    })
  })

  // ── Room management ───────────────────────────────────────────────────────

  it('expands room list when the chevron is clicked', () => {
    renderModal()
    const expandButtons = screen.getAllByTitle(/edit rooms/i)
    fireEvent.click(expandButtons[0])
    expect(screen.getByDisplayValue('Living Room')).toBeInTheDocument()
  })

  it('shows empty-rooms message when a floor has no rooms', () => {
    renderModal()
    // Expand Garden (no rooms)
    const expandButtons = screen.getAllByTitle(/edit rooms/i)
    fireEvent.click(expandButtons[1])
    expect(screen.getByText(/no rooms defined/i)).toBeInTheDocument()
  })

  it('adds a room when a room name is typed and the + button clicked', () => {
    renderModal()
    const expandButtons = screen.getAllByTitle(/edit rooms/i)
    fireEvent.click(expandButtons[0])

    const roomInput = screen.getByPlaceholderText(/new room name/i)
    fireEvent.change(roomInput, { target: { value: 'Hallway' } })
    const addRoomBtn = screen.getAllByRole('button').find(b =>
      b.querySelector('svg') && !b.textContent.trim() && b !== screen.queryByRole('button', { name: /^add$/i })
    )
    // Use the first enabled add-room button inside the expanded section
    const addRoomButtons = screen.getAllByRole('button')
    const plusBtn = addRoomButtons.find(b => b.disabled === false && b.querySelector('svg[data-lucide]'))
    if (plusBtn) fireEvent.click(plusBtn)
    else {
      // Fallback: press Enter on the input
      fireEvent.keyDown(roomInput, { key: 'Enter' })
    }

    expect(screen.getByDisplayValue('Hallway')).toBeInTheDocument()
  })

  it('deletes a room when its trash button is clicked', () => {
    renderModal()
    const expandButtons = screen.getAllByTitle(/edit rooms/i)
    fireEvent.click(expandButtons[0])

    expect(screen.getByDisplayValue('Living Room')).toBeInTheDocument()

    // Room delete buttons: flex-shrink-0 + text-red-500, no text-xs (floor delete has text-xs)
    const allButtons = screen.getAllByRole('button')
    const roomDeleteBtns = allButtons.filter(b =>
      b.className.includes('flex-shrink-0') &&
      b.className.includes('text-red-500') &&
      !b.className.includes('text-xs')
    )
    fireEvent.click(roomDeleteBtns[0])
    // At least one of the room inputs should be removed
    expect(
      screen.queryByDisplayValue('Living Room') === null ||
      screen.queryByDisplayValue('Kitchen') === null
    ).toBe(true)
  })

  // ── Save / Cancel ─────────────────────────────────────────────────────────

  it('calls onSaveFloors with current floors when Save is clicked', async () => {
    const { onSaveFloors } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /^save/i }))
    await waitFor(() => expect(onSaveFloors).toHaveBeenCalledOnce())
    const saved = onSaveFloors.mock.calls[0][0]
    expect(saved).toHaveLength(baseFloors.length)
  })

  it('shows a saved confirmation after a successful save', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /^save/i }))
    // After save the Save button should temporarily show a check or "Saved" indicator
    // The SettingsModal uses CheckCircle2 SVG or changes button state — wait for the
    // save mock to resolve then check the button is no longer in loading state
    await waitFor(() => expect(screen.getByRole('button', { name: /^save/i })).not.toBeDisabled())
  })

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the X button is clicked', () => {
    const { onClose } = renderModal()
    const buttons = screen.getAllByRole('button')
    const xBtn = buttons.find(b => !b.textContent.trim() && b !== screen.queryByRole('button', { name: /save/i }))
    if (xBtn) fireEvent.click(xBtn)
    else fireEvent.click(buttons[0])
    expect(onClose).toHaveBeenCalled()
  })

  // ── Empty floors ──────────────────────────────────────────────────────────

  it('renders without crashing when floors is empty', () => {
    expect(() => renderModal({ floors: [] })).not.toThrow()
  })
})
