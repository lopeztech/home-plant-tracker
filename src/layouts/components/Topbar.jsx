import { useLayoutContext } from '../../context/LayoutContext.jsx'

export default function Topbar() {
  const { showBackdrop, hideBackdrop, navMinified, toggleSetting } = useLayoutContext()

  const toggleMobileMenu = () => {
    const isOpen = document.documentElement.classList.toggle('app-mobile-menu-open')
    if (isOpen) showBackdrop()
    else hideBackdrop()
  }

  const toggleDesktopNav = () => {
    toggleSetting('navMinified', !navMinified)
  }

  return (
    <header className="app-header">
      <div className="d-flex flex-grow-1 w-100 me-auto align-items-center">
        {/* Mobile: open/close sidebar overlay */}
        <button type="button" className="btn btn-system d-md-none" onClick={toggleMobileMenu} aria-label="Toggle menu">
          <svg className="sa-icon sa-icon-2x">
            <use href="/icons/sprite.svg#menu"></use>
          </svg>
        </button>
        {/* Desktop: collapse/expand sidebar */}
        <button type="button" className="btn btn-system d-none d-md-inline-flex" onClick={toggleDesktopNav} aria-label="Collapse sidebar">
          <svg className="sa-icon sa-icon-2x">
            <use href="/icons/sprite.svg#menu"></use>
          </svg>
        </button>
      </div>
    </header>
  )
}
