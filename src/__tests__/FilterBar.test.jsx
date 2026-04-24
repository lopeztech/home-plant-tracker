import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FilterBar from '../components/FilterBar.jsx'

const defaultFilters = { search: '', room: '', health: '', overdue: false }

describe('FilterBar', () => {
  it('renders the search input', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: /search plants/i })).toBeInTheDocument()
  })

  it('calls onChange with search patch when user types', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={defaultFilters} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox', { name: /search plants/i }), { target: { value: 'Monstera' } })
    expect(onChange).toHaveBeenCalledWith({ search: 'Monstera' })
  })

  it('shows room select when rooms are provided', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} rooms={['Kitchen', 'Bedroom']} />)
    expect(screen.getByRole('combobox', { name: /filter by room/i })).toBeInTheDocument()
  })

  it('does not show room select when only 0–1 rooms provided', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} rooms={['Kitchen']} />)
    expect(screen.queryByRole('combobox', { name: /filter by room/i })).toBeNull()
  })

  it('shows applied filter chips and result count', () => {
    render(
      <FilterBar
        filters={{ ...defaultFilters, search: 'Cactus', health: 'Good' }}
        onChange={vi.fn()}
        resultCount={3}
      />,
    )
    expect(screen.getByText(/"Cactus"/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remove filter: Good/i })).toBeInTheDocument()
    expect(screen.getByText(/3 plants/)).toBeInTheDocument()
  })

  it('calls onChange to clear all when Clear all is clicked', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        filters={{ ...defaultFilters, search: 'Fern' }}
        onChange={onChange}
        resultCount={2}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onChange).toHaveBeenCalledWith({ search: '', room: '', health: '', overdue: false })
  })

  it('shows the overdue toggle', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /overdue only/i })).toBeInTheDocument()
  })
})
