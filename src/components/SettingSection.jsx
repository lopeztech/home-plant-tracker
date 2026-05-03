import HelpTooltip from './HelpTooltip.jsx'

export default function SettingSection({ id, title, icon, search, helpArticle, children }) {
  const visible = !search || title.toLowerCase().includes(search.toLowerCase())
  if (!visible) return null
  return (
    <div id={`settings-section-${id}`} className="mb-4">
      <div className="panel panel-icon">
        <div className="panel-hdr">
          <span className="d-flex align-items-center gap-1">
            {icon && (
              <svg className="sa-icon me-2" aria-hidden="true"><use href={`/icons/sprite.svg#${icon}`}></use></svg>
            )}
            {title}
            {helpArticle && <HelpTooltip articleId={helpArticle} label={`Help: ${title}`} />}
          </span>
        </div>
        <div className="panel-container"><div className="panel-content">
          {children}
        </div></div>
      </div>
    </div>
  )
}
