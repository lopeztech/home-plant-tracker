import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CareCalendar from '../components/CareCalendar.jsx'

vi.mock('../utils/watering.js', () => ({
  getWateringStatus: vi.fn(() => ({ daysUntilDue: 2, isOverdue: false })),
  isOutdoor: vi.fn(() => false),
  OUTDOOR_ROOMS: new Set(),
}))

const now = new Date()
const currentMonthName = now.toLocaleDateString('en', { month: 'long', year: 'numeric' })

const mockPlants = [
  {
    id: '1', name: 'Fern', species: 'Boston Fern', health: 'Good',
    lastWatered: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
    frequencyDays: 3,
    wateringLog: [
      { date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(), note: '' },
      { date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(), note: '' },
    ],
  },
]

const defaultProps = {
  plants: mockPlants,
  weather: null,
  floors: [],
  onClose: vi.fn(),
}

describe('CareCalendar', () => {
  beforeEach(() => {
    defaultProps.onClose = vi.fn()
  })

  it('renders with current month name', () => {
    render(<CareCalendar {...defaultProps} />)
    expect(screen.getByText(currentMonthName)).toBeInTheDocument()
  })

  it('shows weekday headers', () => {
    render(<CareCalendar {...defaultProps} />)
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(day)).toBeInTheDocument()
    }
  })

  it('renders calendar day cells', () => {
    render(<CareCalendar {...defaultProps} />)
    // Should show day 1 and day 15 at minimum
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('navigates to previous month', () => {
    render(<CareCalendar {...defaultProps} />)
    const prevBtn = screen.getAllByRole('button').find(btn => btn.querySelector('svg') && btn.textContent === '')
    // Click the first navigation button (prev)
    const navButtons = screen.getByText(currentMonthName).parentElement.querySelectorAll('button')
    fireEvent.click(navButtons[0])

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1)
    const prevMonthName = prevMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })
    expect(screen.getByText(prevMonthName)).toBeInTheDocument()
  })

  it('navigates to next month', () => {
    render(<CareCalendar {...defaultProps} />)
    const navButtons = screen.getByText(currentMonthName).parentElement.querySelectorAll('button')
    fireEvent.click(navButtons[1])

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1)
    const nextMonthName = nextMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })
    expect(screen.getByText(nextMonthName)).toBeInTheDocument()
  })

  it('clicking a day shows selected day detail', () => {
    render(<CareCalendar {...defaultProps} />)
    fireEvent.click(screen.getByText('5'))
    // Should show the day detail section with the plant name
    expect(screen.getByText('Fern')).toBeInTheDocument()
  })

  it('shows "No watering events" for days without events', () => {
    render(<CareCalendar {...defaultProps} />)
    // Click a day that has no events
    fireEvent.click(screen.getByText('15'))
    expect(screen.getByText('No watering events')).toBeInTheDocument()
  })

  it('deselects day on second click', () => {
    render(<CareCalendar {...defaultProps} />)
    fireEvent.click(screen.getByText('15'))
    expect(screen.getByText('No watering events')).toBeInTheDocument()

    fireEvent.click(screen.getByText('15'))
    expect(screen.queryByText('No watering events')).not.toBeInTheDocument()
  })

  it('clicking backdrop calls onClose', () => {
    render(<CareCalendar {...defaultProps} />)
    // The outer div is the backdrop
    const backdrop = screen.getByText('Care Schedule').closest('.fixed')
    fireEvent.click(backdrop)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows legend with Watered and Due labels', () => {
    render(<CareCalendar {...defaultProps} />)
    expect(screen.getByText('Watered')).toBeInTheDocument()
    expect(screen.getByText('Due')).toBeInTheDocument()
  })

  it('shows watering events on days that have them', () => {
    render(<CareCalendar {...defaultProps} />)
    // Day 5 has a watering event - click it to verify
    fireEvent.click(screen.getByText('5'))
    expect(screen.getByText('Fern')).toBeInTheDocument()
    // "Watered" appears in both the legend and event detail
    expect(screen.getAllByText('Watered').length).toBeGreaterThanOrEqual(2)
  })
})
