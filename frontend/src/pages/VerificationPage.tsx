import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import './VerificationPage.css'

export default function VerificationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { checkAuth } = useAuth()
  const token = searchParams.get('token')
  
  const [email, setEmail] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [sendingCode, setSendingCode] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<boolean>(!!token)
  const [emailEntered, setEmailEntered] = useState<boolean>(false)

  // Auto-verify if magic link token is present
  useEffect(() => {
    if (token) {
      handleVerifyLink(token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleVerifyLink = async (linkToken: string) => {
    setVerifying(true)
    setLoading(true)
    setError(null)

    try {
      await authApi.verifyLink(linkToken)
      await checkAuth()
      navigate('/study-builder')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify link')
      setVerifying(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendingCode(true)
    setError(null)

    try {
      await authApi.sendVerification(email, 'token')
      setEmailEntered(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await authApi.verifyToken(email, verificationCode)
      await checkAuth()
      navigate('/study-builder')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="verification-page">
        <div className="verification-container">
          <h1>Verifying...</h1>
          <p>Please wait while we verify your link.</p>
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="verification-page">
      <div className="verification-container">
        <h1>Login</h1>
        {!emailEntered ? (
          <form onSubmit={handleSendCode} className="verification-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={sendingCode}
                autoFocus
              />
            </div>
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}
            <button type="submit" className="submit-button" disabled={sendingCode || !email.trim()}>
              {sendingCode ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        ) : (
          <>
            <div className="verification-hint">
              <p>We've sent a verification email to <strong>{email}</strong>. You can either:</p>
              <ul>
                <li>Click the magic link in your email, or</li>
                <li>Enter the verification code from your email below</li>
              </ul>
            </div>
            <form onSubmit={handleVerifyToken} className="verification-form">
              <div className="form-group">
                <label htmlFor="email-display">Email</label>
                <div className="email-display-container">
                  <input
                    type="email"
                    id="email-display"
                    value={email}
                    disabled
                    className="email-display"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEmailEntered(false)
                      setVerificationCode('')
                      setError(null)
                    }}
                    className="change-email-button"
                  >
                    Change
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="code">Verification Code</label>
                <input
                  type="text"
                  id="code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                  disabled={loading}
                  pattern="[0-9]{6}"
                  autoFocus
                />
              </div>
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

