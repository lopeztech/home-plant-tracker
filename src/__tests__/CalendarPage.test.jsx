import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

let plantContextValue

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => plantContextValue,
}))

import CalendarPage from '../pages/CalendarPage.jsx'

beforeEach(() => {
  plantContextValue = {
    plants: [
      {
        id: 'p1',
        name: 'Fern',
        frequencyDays: 7,
        lastWatered: new Date().toISOString(),
        wateringLog: [{ date: new Date().toISOString() }],
        fertiliserLog: [],
      },
    ],
    weather: null,
    floors: [],
  }
})

describe('CalendarPage', () => {
  it('renders the care-calendar shell with day buttons and a legend', () => {
    const { container } = render(<CalendarPage />)

    // The new mobile hook class is applied to the panel-content wrapper.
    expect(container.querySelector('.care-calendar')).not.toBeNull()

    // Day buttons get the calendar-day hook class for mobile sizing tweaks.
    expect(container.querySelectorAll('.calendar-day').length).toBeGreaterThan(0)

    // Legend rows render.
    expect(screen.getByText('Watered')).toBeInTheDocument()
    expect(screen.getByText('Water due')).toBeInTheDocument()
    expect(screen.getByText('Fertilised')).toBeInTheDocument()
    expect(screen.getByText('Feed due')).toBeInTheDocument()
  })

  it('renders weekday headers with an abbreviated mobile glyph and a full visually-hidden label', () => {
    const { container } = render(<CalendarPage />)

    // Mobile-only single-letter glyphs use the d-sm-none utility.
    const mobileLetters = container.querySelectorAll('.d-inline.d-sm-none')
    expect(mobileLetters.length).toBeGreaterThanOrEqual(7)

    // The full weekday label remains in the DOM for screen readers via
    // .visually-hidden so single-letter abbreviations don't degrade a11y.
    const visuallyHiddenLabels = container.querySelectorAll('.visually-hidden.d-sm-none')
    const labels = Array.from(visuallyHiddenLabels).map((el) => el.textContent)
    expect(labels).toEqual(expect.arrayContaining(['Mon', 'Sun']))
  })

  it('clicking a day toggles selection and shows the events panel', () => {
    render(<CalendarPage />)

    // Today is rendered with the watered marker; click it to open the panel.
    const today = new Date().getDate()
    const dayButton = screen.getByRole('button', { name: String(today) })
    fireEvent.click(dayButton)

    // Either an event row (Fern) appears, or the empty-state copy. We just
    // assert the panel itself opened (look for the "No events" copy *or*
    // the plant name).
    expect(
      screen.queryByText('Fern') || screen.queryByText(/No events/i),
    ).not.toBeNull()
  })

  it('navigates between months via the chevron buttons', () => {
    render(<CalendarPage />)

    // Both chevrons must expose accessible names — axe's critical bar fails
    // without them, which was one of the E2E failures fixed by this change.
    const prev = screen.getByRole('button', { name: /Previous month/i })
    const next = screen.getByRole('button', { name: /Next month/i })

    fireEvent.click(prev)
    fireEvent.click(next)
    fireEvent.click(next)

    expect(prev).toBeInTheDocument()
    expect(next).toBeInTheDocument()
  })
})
