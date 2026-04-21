import { useLayoutContext } from '../../context/LayoutContext.jsx'
import { useHelp } from '../../context/HelpContext.jsx'

export default function Topbar() {
  const { showBackdrop, hideBackdrop } = useLayoutContext()
  const { open: openHelp } = useHelp()

  const toggleMobileMenu = () => {
    const isOpen = document.documentElement.classList.toggle('app-mobile-menu-open')
    if (isOpen) showBackdrop()
    else hideBackdrop()
  }

  return (
    <header className="app-header d-md-none">
      <div className="d-flex flex-grow-1 w-100 me-auto align-items-center">
        <button type="button" className="btn btn-system" onClick={toggleMobileMenu} aria-label="Toggle menu">
          <svg className="sa-icon sa-icon-2x">
            <use href="/icons/sprite.svg#menu"></use>
          </svg>
        </button>
      </div>
      <button
        type="button"
        className="btn btn-system"
        onClick={() => openHelp()}
        aria-label="Open help"
        title="Help"
      >
        <svg className="sa-icon sa-icon-2x" aria-hidden="true">
          <use href="/icons/sprite.svg#help-circle"></use>
        </svg>
      </button>
    </header>
  )
}
