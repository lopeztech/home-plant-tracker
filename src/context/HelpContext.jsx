import { createContext, useCallback, useContext, useState } from 'react'

const HelpContext = createContext(undefined)

export function useHelp() {
  const ctx = useContext(HelpContext)
  if (!ctx) throw new Error('useHelp must be used within HelpProvider')
  return ctx
}

export function HelpProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [articleId, setArticleId] = useState(null)

  const open = useCallback((id = null) => {
    setArticleId(id)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  return (
    <HelpContext.Provider value={{ isOpen, articleId, open, close }}>
      {children}
    </HelpContext.Provider>
  )
}
