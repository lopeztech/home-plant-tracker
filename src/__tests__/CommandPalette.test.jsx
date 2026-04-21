import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import CommandPalette from '../components/CommandPalette.jsx'
import { CommandPaletteProvider, useCommandPalette } from '../context/CommandPaletteContext.jsx'

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: vi.fn(() => ({
    plants: [
      { id: 'p1', name: 'Monstera', species: 'Monstera deliciosa', room: 'Living Room', frequencyDays: 7, lastWatered: '2026-04-01T00:00:00.000Z' },
      { id: 'p2', name: 'Basil',    species: 'Ocimum basilicum',   room: 'Kitchen',     frequencyDays: 3, lastWatered: '2026-04-19T00:00:00.000Z' },
      { id: 'p3', name: 'Cactus',   species: 'Cactaceae',          room: 'Bedroom',     frequencyDays: 14, lastWatered: '2026-03-01T00:00:00.000Z' },
    ],
    handleWaterPlant: vi.fn().mockResolvedValue({}),
  })),
}))

vi.mock('../context/LayoutContext.jsx', () => ({
  useLayoutContext: vi.fn(() => ({
    theme: 'light',
    changeTheme: vi.fn(),
    changeThemeStyle: vi.fn(),
  })),
}))

vi.mock('../utils/plantEmoji.js', () => ({
  getPlantEmoji: vi.fn(() => '🌿'),
}))

function OpenButton() {
  const { open } = useCommandPalette()
  return <button onClick={open}>Open</button>
}

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPaletteProvider>
        <OpenButton />
        <CommandPalette />
      </CommandPaletteProvider>
    </MemoryRouter>
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('is not visible when closed', () => {
    renderPalette()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens when the open button is clicked', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument()
  })

  it('closes when Escape is pressed', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when backdrop is clicked', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const backdrop = document.querySelector('.cmd-palette-backdrop')
    fireEvent.mouseDown(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows pages and actions when query is empty', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Pages')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('surfaces Monstera when typing "mon"', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'mon' } })
    expect(screen.getByText('Monstera')).toBeInTheDocument()
  })

  it('surfaces Monstera within 2 keystrokes', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'mo' } })
    expect(screen.getByText('Monstera')).toBeInTheDocument()
  })

  it('shows no results message for unmatched query', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'xyznotfound' } })
    expect(screen.getByText(/no results/i)).toBeInTheDocument()
  })

  it('navigates result list with arrow keys', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    const firstItem = () => document.querySelector('[data-selected="true"]')
    const firstLabel = firstItem()?.textContent

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.querySelector('[data-selected="true"]')?.textContent).not.toBe(firstLabel)
  })

  it('wraps selected index back to first item on ArrowUp from first', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const selected = document.querySelector('[data-selected="true"]')
    expect(selected).toBeInTheDocument()
  })

  it('has correct ARIA attributes on the search input', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-controls', 'cmd-palette-listbox')
  })

  it('shows Plants group when searching by plant name', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'bas' } })
    expect(screen.getByText('Plants')).toBeInTheDocument()
    expect(screen.getByText('Basil')).toBeInTheDocument()
  })

  it('shows themes in results when searching "theme"', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'olive' } })
    expect(screen.getByText(/olive theme/i)).toBeInTheDocument()
  })

  it('shows Add plant action', () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Add plant')).toBeInTheDocument()
  })

  it('resets query when reopened', async () => {
    renderPalette()
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'something' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    fireEvent.click(screen.getByText('Open'))
    const newInput = screen.getByRole('textbox', { name: /search/i })
    expect(newInput).toHaveValue('')
  })
})
