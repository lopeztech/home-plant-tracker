import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Card, Button, Alert } from 'react-bootstrap'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function LoginPage() {
  const { login, loginAsGuest } = useAuth()
  const [loginError, setLoginError] = useState(false)

  const handleError = () => {
    console.error('Google Sign-In failed')
    setLoginError(true)
  }

  const handleSuccess = (response) => {
    setLoginError(false)
    login(response)
  }

  const handleTryDifferentAccount = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
    setLoginError(false)
  }

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 px-3" style={{ background: 'var(--bs-body-bg)' }}>
      <div className="d-flex flex-column align-items-center gap-4 w-100" style={{ maxWidth: 400 }}>
        {/* Icon */}
        <div
          className="d-flex align-items-center justify-content-center rounded-3 bg-primary text-white"
          style={{ width: 80, height: 80, fontSize: '2.5rem' }}
        >
          <span role="img" aria-label="plant">🌿</span>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="h2 fw-500 mb-1">Plant Tracker</h1>
          <p className="text-muted">Your personal plant care companion</p>
        </div>

        {/* Sign-in card */}
        <Card className="w-100">
          <Card.Body className="d-flex flex-column align-items-center gap-4 p-4">
            <p className="text-muted text-center mb-0">Sign in to access your plants</p>

            {loginError && (
              <Alert variant="danger" className="w-100 text-center">
                <p className="fw-500 mb-1">Sign-in failed</p>
                <p className="fs-sm mb-2">Your account may not have access. Try signing in with a different account.</p>
                <button onClick={handleTryDifferentAccount} className="btn btn-link btn-sm text-danger p-0">
                  Try a different account
                </button>
              </Alert>
            )}

            {CLIENT_ID ? (
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                theme="outline"
                shape="rectangular"
                size="large"
                text="signin_with"
                width="280"
              />
            ) : (
              <Alert variant="warning" className="w-100 text-center fs-sm">
                <p className="fw-500 mb-1">Configuration required</p>
                <p className="mb-0">
                  Set <code>VITE_GOOGLE_CLIENT_ID</code> in your <code>.env.local</code> file.
                </p>
              </Alert>
            )}

            <div className="d-flex align-items-center gap-3 w-100">
              <hr className="flex-grow-1" />
              <span className="text-muted fs-sm">or</span>
              <hr className="flex-grow-1" />
            </div>

            <Button variant="outline-secondary" className="w-100" onClick={loginAsGuest}>
              Continue as Guest
            </Button>
          </Card.Body>
        </Card>

        <p className="text-muted fs-sm text-center">
          Guest mode uses sample data and does not save changes.
        </p>
      </div>
    </div>
  )
}
