import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkeletonRect, SkeletonCircle, SkeletonText, SkeletonPlantCard, SkeletonCard } from '../components/Skeleton.jsx'

describe('Skeleton components', () => {
  it('SkeletonRect renders a presentation element with the given dimensions', () => {
    const { container } = render(<SkeletonRect width={200} height={24} />)
    const el = container.firstChild
    expect(el.getAttribute('role')).toBe('presentation')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('24px')
  })

  it('SkeletonCircle renders as a circle (50% border-radius)', () => {
    const { container } = render(<SkeletonCircle size={40} />)
    const el = container.firstChild
    expect(el.style.borderRadius).toBe('50%')
    expect(el.style.width).toBe('40px')
    expect(el.style.height).toBe('40px')
  })

  it('SkeletonText renders the specified number of lines', () => {
    const { container } = render(<SkeletonText lines={3} />)
    // Each line is a SkeletonRect (a span)
    const spans = container.querySelectorAll('span')
    expect(spans.length).toBe(3)
  })

  it('SkeletonText renders one line by default', () => {
    const { container } = render(<SkeletonText />)
    const spans = container.querySelectorAll('span')
    expect(spans.length).toBe(1)
  })

  it('SkeletonPlantCard renders a presentation block with avatar + text lines', () => {
    const { container } = render(<SkeletonPlantCard />)
    // avatar (circle) + two text rects + status rect = multiple spans
    const spans = container.querySelectorAll('span[role="presentation"]')
    expect(spans.length).toBeGreaterThanOrEqual(3)
  })

  it('SkeletonCard renders inside a panel shell', () => {
    const { container } = render(<SkeletonCard lines={2} />)
    expect(container.querySelector('.panel')).not.toBeNull()
  })

  it('all skeleton elements are hidden from assistive technology', () => {
    const { container } = render(
      <>
        <SkeletonRect />
        <SkeletonCircle />
        <SkeletonPlantCard />
      </>,
    )
    const visible = container.querySelectorAll('[aria-hidden="false"]')
    expect(visible.length).toBe(0)
  })
})
