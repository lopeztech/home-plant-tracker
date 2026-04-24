import { useEffect, useCallback } from 'react'
import { useBlocker } from 'react-router'
import { Modal, Button } from 'react-bootstrap'

/**
 * Blocks navigation when `isDirty` is true, shows a confirmation dialog.
 *
 * Usage:
 *   <UnsavedChangesGuard isDirty={form.isDirty} />
 *
 * The guard also prevents accidental browser tab close / refresh when dirty.
 */
export default function UnsavedChangesGuard({ isDirty }) {
  const blocker = useBlocker(
    useCallback(({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
    [isDirty]),
  )

  // Browser unload guard
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  if (blocker.state !== 'blocked') return null

  return (
    <Modal show centered size="sm" onHide={() => blocker.reset()}>
      <Modal.Header closeButton>
        <Modal.Title className="fs-base">Unsaved changes</Modal.Title>
      </Modal.Header>
      <Modal.Body className="fs-sm">
        You have unsaved changes. If you leave now, your changes will be lost.
      </Modal.Body>
      <Modal.Footer className="gap-2">
        <Button variant="outline-secondary" size="sm" onClick={() => blocker.reset()}>
          Stay and save
        </Button>
        <Button variant="danger" size="sm" onClick={() => blocker.proceed()}>
          Discard changes
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
