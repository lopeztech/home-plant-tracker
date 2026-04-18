import { useEffect, useState } from 'react'

// Returns the natural aspect ratio (width / height) of the image at `url`,
// defaulting to 1 when no URL is provided or the image has not loaded yet.
export function useImageAspect(url) {
  const [aspect, setAspect] = useState(1)
  useEffect(() => {
    if (!url) { setAspect(1); return }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const w = img.naturalWidth, h = img.naturalHeight
      if (w > 0 && h > 0) setAspect(w / h)
    }
    img.onerror = () => { if (!cancelled) setAspect(1) }
    img.src = url
    return () => { cancelled = true }
  }, [url])
  return aspect
}
