import { useLayoutContext } from '../../context/LayoutContext.jsx'
import { usePlantContext } from '../../context/PlantContext.jsx'
import SeasonBadge from '../../components/SeasonBadge.jsx'

export default function Topbar() {
  const { showBackdrop, hideBackdrop } = useLayoutContext()
  const { weather, tempUnit } = usePlantContext()

  const toggleMobileMenu = () => {
    const isOpen = document.documentElement.classList.toggle('app-mobile-menu-open')
    if (isOpen) showBackdrop()
    else hideBackdrop()
  }

  return (
    <header className="app-header">
      <div className="d-flex flex-grow-1 w-100 me-auto align-items-center">
        {/* Mobile menu toggle only */}
        <button type="button" className="btn btn-system d-md-none" onClick={toggleMobileMenu} aria-label="Toggle menu">
          <svg className="sa-icon sa-icon-2x">
            <use href="/icons/sprite.svg#menu"></use>
          </svg>
        </button>

        {/* Weather widget + season */}
        {weather && (
          <div className="d-flex align-items-center gap-2 ms-2">
            <span className="fs-4">{weather.current.condition.emoji}</span>
            <span className="fw-500">{weather.current.temp}°{tempUnit.unit === 'fahrenheit' ? 'F' : 'C'}</span>
            <span className="text-muted fs-sm hidden-mobile">{weather.current.condition.label}</span>
            <SeasonBadge lat={weather.location?.lat} />
          </div>
        )}
      </div>
    </header>
  )
}
