import React from 'react'
import { Button } from 'react-bootstrap'
import { toFriendlyError } from '../utils/errorMessages.js'

/**
 * Route-level error boundary. Catches render-time exceptions so a crashed
 * page doesn't blank the whole app — shows a friendly fallback with a retry
 * button that re-mounts the child tree.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep a diagnostic breadcrumb in the console — users only ever see
    // the friendly fallback above.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info?.componentStack)
  }

  handleReset() {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const friendly = toFriendlyError(this.state.error, { context: this.props.context })

    return (
      <div className="p-4">
        <div className="panel">
          <div className="panel-container">
            <div className="panel-content text-center py-5">
              <svg className="sa-icon sa-icon-5x text-muted mb-3" aria-hidden="true">
                <use href="/icons/sprite.svg#alert-triangle"></use>
              </svg>
              <h5 className="fw-500 mb-2">{friendly.title}</h5>
              <p className="text-muted mb-3">{friendly.message}</p>
              <div className="d-flex gap-2 justify-content-center">
                <Button variant="primary" onClick={this.handleReset}>{friendly.action}</Button>
                <Button variant="outline-secondary" onClick={() => window.location.reload()}>
                  Refresh page
                </Button>
              </div>
              {friendly.rawCode && (
                <details className="fs-xs text-muted mt-3">
                  <summary>Technical details</summary>
                  <code>{friendly.rawCode}</code>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
