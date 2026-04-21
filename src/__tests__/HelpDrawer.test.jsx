import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HelpProvider, useHelp } from '../context/HelpContext.jsx'
import HelpDrawer from '../components/HelpDrawer.jsx'
import HelpTooltip from '../components/HelpTooltip.jsx'

function HelpOpener({ articleId }) {
  const { open } = useHelp()
  return <button onClick={() => open(articleId)}>Open</button>
}

function Wrapper({ articleId } = {}) {
  return (
    <HelpProvider>
      <HelpOpener articleId={articleId} />
      <HelpDrawer />
    </HelpProvider>
  )
}

describe('HelpContext', () => {
  it('starts closed', () => {
    render(<Wrapper />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens when open() is called', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes when the close button is clicked', () => {
    const { container } = render(<Wrapper />)
    fireEvent.click(screen.getByText('Open'))
    const closeBtn = screen.getByLabelText('Close')
    fireEvent.click(closeBtn)
    // Offcanvas transitions on close; show class is removed immediately even though the element remains during animation
    expect(container.querySelector('.offcanvas.show')).toBeNull()
  })
})

describe('HelpDrawer', () => {
  it('shows all articles when open with no articleId', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Adding and editing plants')).toBeTruthy()
    expect(screen.getByText('Plant health grades')).toBeTruthy()
  })

  it('navigates to an article when clicked', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Plant health grades'))
    expect(screen.getByText('What do the health grades mean?')).toBeTruthy()
    expect(screen.queryByText('Adding and editing plants')).toBeNull()
  })

  it('returns to list when "All articles" is clicked', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Plant health grades'))
    fireEvent.click(screen.getByText(/All articles/i))
    expect(screen.getByText('Adding and editing plants')).toBeTruthy()
  })

  it('filters articles by search query', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByPlaceholderText('Search help…')
    fireEvent.change(input, { target: { value: 'heatmap' } })
    expect(screen.getByText('Understanding Analytics charts')).toBeTruthy()
    expect(screen.queryByText('Plant health grades')).toBeNull()
  })

  it('shows no-results message when search has no match', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByPlaceholderText('Search help…')
    fireEvent.change(input, { target: { value: 'xyznotfound' } })
    expect(screen.getByText(/No results for/i)).toBeTruthy()
  })

  it('opens directly to a specific article when articleId is passed', () => {
    render(<Wrapper articleId="analytics" />)
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Understanding Analytics charts')).toBeTruthy()
    expect(screen.getByText('Consistency score')).toBeTruthy()
  })
})

describe('HelpTooltip', () => {
  it('renders a button that opens the help drawer', () => {
    render(
      <HelpProvider>
        <HelpTooltip articleId="analytics" label="Explain chart" />
        <HelpDrawer />
      </HelpProvider>,
    )
    const btn = screen.getByLabelText('Help: Explain chart')
    fireEvent.click(btn)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('shows the correct article when opened via tooltip', () => {
    render(
      <HelpProvider>
        <HelpTooltip articleId="health-grades" label="Health grades" />
        <HelpDrawer />
      </HelpProvider>,
    )
    fireEvent.click(screen.getByLabelText('Help: Health grades'))
    expect(screen.getByText('Plant health grades')).toBeTruthy()
  })
})
