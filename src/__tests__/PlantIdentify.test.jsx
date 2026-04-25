import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../api/plants.js', () => ({
  analyseApi: { identify: vi.fn() },
}))

import PlantIdentify from '../components/PlantIdentify.jsx'

describe('PlantIdentify', () => {
  it('does not render dialog content when hidden', () => {
    render(<PlantIdentify show={false} onHide={() => {}} onIdentified={() => {}} />)
    expect(screen.queryByText(/Identify Plant from Photo/i)).not.toBeInTheDocument()
  })

  it('renders the modal with an accessible title when shown', () => {
    render(<PlantIdentify show onHide={() => {}} onIdentified={() => {}} />)

    // The title element carries the id wired to the modal's aria-labelledby,
    // so the dialog has a real accessible name (regression for a Playwright
    // failure where two modals were stacked and indistinguishable).
    const title = screen.getByText(/Identify Plant from Photo/i)
    expect(title).toBeInTheDocument()
    expect(title.id).toBe('plant-identify-title')

    // Initial dropzone copy is visible.
    expect(screen.getByText(/Click or drag photos here/i)).toBeInTheDocument()
    // Identify CTA renders disabled until a file is selected.
    expect(screen.getByRole('button', { name: /^Identify Plant$/i })).toBeDisabled()
    // Skip path is present.
    expect(screen.getByRole('button', { name: /Skip — enter manually/i })).toBeInTheDocument()
  })
})
