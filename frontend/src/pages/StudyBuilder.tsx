import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, studyApi, scenarioGroupApi, StudyResponse } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import './StudyBuilder.css'

export default function StudyBuilder() {
  const navigate = useNavigate()
  const { user, loading: authLoading, checkAuth } = useAuth()
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [emailSent, setEmailSent] = useState<boolean>(false)
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [verifying, setVerifying] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [studies, setStudies] = useState<StudyResponse[]>([])
  const [loadingStudies, setLoadingStudies] = useState<boolean>(false)
  const [studiesError, setStudiesError] = useState<string | null>(null)
  const [creatingStudy, setCreatingStudy] = useState<boolean>(false)
  const [deleteConfirmStudy, setDeleteConfirmStudy] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)

  // Load studies when user is authenticated - must be before any conditional returns
  useEffect(() => {
    if (user) {
      const loadStudies = async () => {
        setLoadingStudies(true)
        setStudiesError(null)
        try {
          const data = await studyApi.getAll()
          setStudies(data)
        } catch (err) {
          setStudiesError(err instanceof Error ? err.message : 'Failed to load studies')
        } finally {
          setLoadingStudies(false)
        }
      }
      loadStudies()
    }
  }, [user])

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEmailSent(false)

    try {
      await authApi.sendVerification(email, 'both')
      setEmailSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification email')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifying(true)
    setError(null)

    try {
      await authApi.verifyToken(email, verificationCode)
      await checkAuth()
      // User will be redirected automatically via auth context update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code')
    } finally {
      setVerifying(false)
    }
  }

  // Show login form if not authenticated
  if (!user && !authLoading) {
    return (
      <div className="study-builder">
        <div className="study-builder-container">
          <h1>Study Builder</h1>
          {emailSent ? (
            <div>
              <div className="success-message">
                <p>✓ Verification email sent! Check your inbox for the sign-in link or code.</p>
              </div>
              <form onSubmit={handleVerifyCode} className="study-builder-form" style={{ marginTop: '1.5rem' }}>
                <div className="form-group">
                  <label htmlFor="verify-email">Email</label>
                  <input
                    type="email"
                    id="verify-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    disabled={verifying}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="verify-code">Verification Code</label>
                  <input
                    type="text"
                    id="verify-code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                    disabled={verifying}
                    pattern="[0-9]{6}"
                  />
                  <p style={{ fontSize: '0.85rem', color: '#a0a0a0', marginTop: '0.25rem' }}>
                    Or click the magic link in your email
                  </p>
                </div>
                {error && (
                  <div className="error-message">
                    <p>{error}</p>
                  </div>
                )}
                <button type="submit" className="submit-button" disabled={verifying}>
                  {verifying ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSendEmail} className="study-builder-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Sending...' : 'Send me a signup/login link'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // Show loading state
  if (authLoading) {
    return (
      <div className="study-builder">
        <div className="study-builder-container">
          <h1>Study Builder</h1>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  const handleCreateStudy = async () => {
    if (!user || creatingStudy) return

    setCreatingStudy(true)
    setStudiesError(null)

    try {
      // Create an empty scenario group first
      const scenarioGroup = await scenarioGroupApi.create({ items: [] })

      // Create the study with "Untitled Study" title
      const newStudy = await studyApi.create({
        title: 'Untitled Study',
        description: undefined,
        email: user.email,
        scenario_group_id: scenarioGroup.id,
      })

      // Navigate to the newly created study
      navigate(`/study-builder/${newStudy.id}`)
    } catch (err) {
      setStudiesError(err instanceof Error ? err.message : 'Failed to create study')
      setCreatingStudy(false)
    }
  }

  // Handle deleting a study
  const handleDeleteStudy = async (studyId: number, studyTitle: string) => {
    setDeleteConfirmStudy({ id: studyId, title: studyTitle })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmStudy) return

    setDeleting(true)
    setStudiesError(null)

    try {
      await studyApi.delete(deleteConfirmStudy.id)
      
      // Remove the study from the local state
      setStudies(studies.filter(study => study.id !== deleteConfirmStudy.id))
      
      setDeleteConfirmStudy(null)
    } catch (err) {
      setStudiesError(err instanceof Error ? err.message : 'Failed to delete study')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmStudy(null)
  }

  return (
    <div className="study-builder">
      <div className="study-builder-container">
        <h1>Study Builder</h1>
        {loadingStudies ? (
          <p>Loading studies...</p>
        ) : studiesError ? (
          <div className="error-message">
            <p>{studiesError}</p>
          </div>
        ) : (
          <div className="studies-grid">
            {/* Create new study card (first position) */}
            <div 
              className="study-card study-card-create" 
              onClick={handleCreateStudy}
              style={{ opacity: creatingStudy ? 0.6 : 1, cursor: creatingStudy ? 'not-allowed' : 'pointer' }}
            >
              <div className="study-card-content">
                <div className="study-card-plus">{creatingStudy ? '...' : '+'}</div>
                <h3>{creatingStudy ? 'Creating...' : 'Create New Study'}</h3>
              </div>
            </div>
            {/* Existing studies */}
            {studies.map((study) => (
              <div 
                key={study.id} 
                className="study-card"
                onClick={() => navigate(`/study-builder/${study.id}`)}
              >
                <button
                  className="study-card-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteStudy(study.id, study.title)
                  }}
                  aria-label="Delete study"
                >
                  ×
                </button>
                <div className="study-card-content">
                  <h3>{study.title}</h3>
                  {study.description && (
                    <p className="study-card-description">{study.description}</p>
                  )}
                  <p className="study-card-email">{study.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Delete Confirmation Dialog */}
      {deleteConfirmStudy && (
        <div className="delete-confirm-overlay" onClick={cancelDelete}>
          <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Study?</h3>
            <p>Are you sure you want to delete "{deleteConfirmStudy.title}"? This action cannot be undone.</p>
            <div className="delete-confirm-buttons">
              <button 
                className="delete-confirm-cancel"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="delete-confirm-delete"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

