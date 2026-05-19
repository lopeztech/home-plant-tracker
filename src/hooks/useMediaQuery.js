import { useEffect, useState } from 'react'

// Subscribes to a CSS media query. Returns `false` during SSR / jsdom.
// Default-false on first paint avoids hydration flicker for content that
// should only appear on small screens — the post-mount effect upgrades to
// the real value within one tick.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}
