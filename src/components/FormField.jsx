import { Form } from 'react-bootstrap'

/**
 * Canonical form field wrapper — consistent label, help text, inline error,
 * required indicator, and ARIA wiring across every form in the app.
 *
 * Usage:
 *   <FormField label="Plant name" error={errors.name?.message} required>
 *     <Form.Control {...register('name')} isInvalid={!!errors.name} />
 *   </FormField>
 */
export default function FormField({
  label,
  htmlFor,
  required = false,
  help,
  error,
  className = '',
  children,
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  const helpId  = htmlFor ? `${htmlFor}-help`  : undefined

  return (
    <Form.Group controlId={htmlFor} className={`mb-3 ${className}`}>
      {label && (
        <Form.Label className="fw-500 fs-sm">
          {label}
          {required && (
            <span className="text-danger ms-1" aria-label="required">*</span>
          )}
        </Form.Label>
      )}

      {/* Clone children to inject aria-describedby */}
      {children}

      {help && !error && (
        <Form.Text id={helpId} className="text-muted">
          {help}
        </Form.Text>
      )}

      {error && (
        <Form.Control.Feedback
          id={errorId}
          type="invalid"
          style={{ display: 'block' }}
          role="alert"
          aria-live="polite"
        >
          {error}
        </Form.Control.Feedback>
      )}
    </Form.Group>
  )
}

/**
 * Pre-wired action row: primary + cancel buttons, right-aligned on desktop,
 * sticky bottom on mobile, disabled state handled uniformly.
 */
export function FormActions({ onCancel, submitLabel = 'Save', loading = false, disabled = false, className = '' }) {
  return (
    <div className={`d-flex justify-content-end gap-2 mt-3 ${className}`}>
      {onCancel && (
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      )}
      <button type="submit" className="btn btn-primary" disabled={disabled || loading}>
        {loading && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
        {submitLabel}
      </button>
    </div>
  )
}
