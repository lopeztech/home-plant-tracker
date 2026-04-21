import { useHelp } from '../context/HelpContext.jsx'

export default function HelpTooltip({ articleId, label, className = '' }) {
  const { open } = useHelp()

  return (
    <button
      type="button"
      className={`btn btn-link p-0 d-inline-flex align-items-center text-muted ${className}`}
      style={{ fontSize: '0.75rem', verticalAlign: 'middle', lineHeight: 1 }}
      onClick={() => open(articleId)}
      aria-label={label ? `Help: ${label}` : 'Open help'}
      title={label || 'Help'}
    >
      <svg
        className="sa-icon"
        style={{ width: 14, height: 14 }}
        aria-hidden="true"
      >
        <use href="/icons/sprite.svg#help-circle"></use>
      </svg>
    </button>
  )
}
