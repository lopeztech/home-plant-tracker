import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])
const LINK_ID = 'bootstrap-rtl'
const RTL_HREF = '/css/bootstrap.rtl.min.css'

/**
 * Detects RTL languages from i18n and synchronises document.dir + Bootstrap
 * RTL stylesheet. Called once at the app root so the effect runs globally.
 */
export function useRtl() {
  const { i18n } = useTranslation()
  const lang = (i18n.language || 'en').split('-')[0]
  const isRtl = RTL_LANGS.has(lang)

  useEffect(() => {
    const html = document.documentElement
    html.dir = isRtl ? 'rtl' : 'ltr'
    html.lang = lang

    const existing = document.getElementById(LINK_ID)
    if (isRtl && !existing) {
      const link = document.createElement('link')
      link.id = LINK_ID
      link.rel = 'stylesheet'
      link.href = RTL_HREF
      document.head.appendChild(link)
    } else if (!isRtl && existing) {
      existing.remove()
    }
  }, [isRtl, lang])

  return { isRtl }
}

export { RTL_LANGS }
