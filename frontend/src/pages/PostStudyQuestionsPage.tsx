import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { postStudyQuestionApi, PostStudyQuestionResponse, postStudyQuestionResponseApi, PostStudyQuestionResponseCreate, studyApi, StudyResponse } from '../services/api'
import { getSessionId } from '../utils/session'
import { useAuth } from '../contexts/AuthContext'
import StudyProgressBar from '../components/StudyProgressBar'
import './PostStudyQuestionsPage.css'
import '../components/StatisticsView.css'

export default function PostStudyQuestionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const studyId = id ? parseInt(id, 10) : null
  
  const [study, setStudy] = useState<StudyResponse | null>(null)
  const [questions, setQuestions] = useState<PostStudyQuestionResponse[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [questionResponses, setQuestionResponses] = useState<Map<number, { freeText: string; selectedTagIds: number[] }>>(new Map())

  // Load questions and existing responses
  useEffect(() => {
    if (!studyId || isNaN(studyId)) {
      setError('Invalid study ID')
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const sessionId = getSessionId()
        
        // Load study, questions and existing responses in parallel
        const [studyData, questionsData, responsesData] = await Promise.all([
          studyApi.getPublic(studyId).catch(() => null), // Public endpoint for participant view
          postStudyQuestionApi.getAll(studyId),
          postStudyQuestionResponseApi.getBySession(studyId, sessionId).catch(() => []) // Ignore errors if no responses exist
        ])
        
        setStudy(studyData)
        setQuestions(questionsData)
        
        // Initialize question responses from existing data or empty
        const initialResponses = new Map<number, { freeText: string; selectedTagIds: number[] }>()
        
        questionsData.forEach(q => {
          const existingResponse = responsesData.find(r => r.post_study_question_id === q.id)
          if (existingResponse) {
            initialResponses.set(q.id, {
              freeText: existingResponse.free_text_response || '',
              selectedTagIds: existingResponse.selected_tags.map(t => t.id)
            })
          } else {
            initialResponses.set(q.id, { freeText: '', selectedTagIds: [] })
          }
        })
        
        setQuestionResponses(initialResponses)
      } catch (err) {
        console.error('Failed to load post-study questions:', err)
        setError(err instanceof Error ? err.message : 'Failed to load questions')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [studyId])

  // Check if all required questions are answered
  const areRequiredQuestionsAnswered = useMemo(() => {
    for (const question of questions) {
      if (question.is_required) {
        const response = questionResponses.get(question.id)
        if (!response) return false
        
        const hasFreeText = response.freeText && response.freeText.trim().length > 0
        const hasTags = response.selectedTagIds.length > 0
        
        // If question allows both free text and tags, at least one must be provided
        if (question.question.allows_free_text && question.question.allows_tags && question.tags.length > 0) {
          if (!hasFreeText && !hasTags) return false
        }
        // If question only allows free text, it must be provided
        else if (question.question.allows_free_text && !question.question.allows_tags) {
          if (!hasFreeText) return false
        }
        // If question only allows tags (or has tags available), at least one must be selected
        else if (question.question.allows_tags && question.tags.length > 0) {
          if (!hasTags) return false
        }
        // If question doesn't allow either, it's considered answered if response exists
      }
    }
    return true
  }, [questions, questionResponses])

  // Handle question response changes
  const handleQuestionFreeTextChange = (questionId: number, value: string) => {
    const updated = new Map(questionResponses)
    const current = updated.get(questionId) || { freeText: '', selectedTagIds: [] }
    updated.set(questionId, { ...current, freeText: value })
    setQuestionResponses(updated)
  }

  const handleQuestionTagToggle = (questionId: number, tagId: number) => {
    const updated = new Map(questionResponses)
    const current = updated.get(questionId) || { freeText: '', selectedTagIds: [] }
    const wasSelected = current.selectedTagIds.includes(tagId)
    const allowsMultiple = questions.find(q => q.id === questionId)?.question.allows_multiple_tags ?? true
    
    const tagIds = wasSelected
      ? current.selectedTagIds.filter(id => id !== tagId)
      : allowsMultiple
        ? [...current.selectedTagIds, tagId]
        : [tagId] // Radio button behavior - replace selection
    
    updated.set(questionId, { ...current, selectedTagIds: tagIds })
    setQuestionResponses(updated)
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!studyId) return
    
    try {
      setSubmitting(true)
      setError(null)
      
      const sessionId = getSessionId()
      const responses: PostStudyQuestionResponseCreate[] = Array.from(questionResponses.entries()).map(([questionId, response]) => ({
        post_study_question_id: questionId,
        free_text_response: response.freeText || undefined,
        selected_tag_ids: response.selectedTagIds
      }))
      
      await postStudyQuestionResponseApi.create(studyId, responses, sessionId, user?.id ? String(user.id) : undefined)
      
      // Scroll to top and show completion message
      window.scrollTo({ top: 0, behavior: 'smooth' })
      
      // For now, just show a success message - could navigate to a completion page later
      alert('Thank you for completing the study!')
    } catch (err) {
      console.error('Failed to submit responses:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit responses')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="App">
        {studyId && <StudyProgressBar studyId={studyId} />}
        <main className="App-main">
          <div className="main-header">
            <h1>Loading...</h1>
          </div>
        </main>
      </div>
    )
  }

  if (error && !questions.length) {
    return (
      <div className="App">
        {studyId && <StudyProgressBar studyId={studyId} />}
        <main className="App-main">
          <div className="main-header">
            <h1>Error</h1>
            <p>{error}</p>
            <button onClick={() => navigate('/')}>Go to Home</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="App">
      {studyId && <StudyProgressBar studyId={studyId} />}
      <main className="App-main">
        <div className="main-header">
          <h1>{study?.title || 'Study'}</h1>
          {study?.description && (
            <p style={{ color: '#d7dadc', marginTop: '0.5rem', marginBottom: '1.5rem', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
              {study.description}
            </p>
          )}
          {questions.length > 0 && (
            <p style={{ color: '#a0a0a0', marginTop: study?.description ? '0.5rem' : '0.5rem', marginBottom: '1.5rem' }}>
              Please answer the following questions to complete the study.
            </p>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ color: '#ff6b6b', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#3a1a1a', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        {questions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#d7dadc' }}>
            <p>No post-study questions for this study.</p>
            <p style={{ marginTop: '1rem', fontSize: '1.1rem', color: '#4a90e2' }}>
              Thank you for completing the study!
            </p>
          </div>
        ) : (
          <div className="questions-response-section">
            {questions.map((question) => {
              const response = questionResponses.get(question.id) || { freeText: '', selectedTagIds: [] }
              const isRequired = question.is_required
              const isFreeTextValid = !question.question.allows_free_text || (response.freeText && response.freeText.trim().length > 0)
              const isTagsValid = !question.question.allows_tags || question.tags.length === 0 || response.selectedTagIds.length > 0
              const isValid = !isRequired || (isFreeTextValid && isTagsValid)
              
              return (
                <div key={question.id} className={`question-response-item ${!isValid ? 'question-invalid' : ''}`}>
                  <label className="question-label">
                    {question.question.question_text}
                    {isRequired && <span className="required-indicator"> *</span>}
                  </label>
                  {question.question.allows_tags && question.tags.length > 0 && (
                    <div className="question-tags-selection">
                      <div className="tags-selection-grid">
                        {question.tags.map((tag) => {
                          const allowsMultiple = question.question.allows_multiple_tags ?? true
                          return (
                            <label key={tag.id} className={allowsMultiple ? "tag-selection-checkbox" : "tag-selection-radio"}>
                              <input
                                type={allowsMultiple ? "checkbox" : "radio"}
                                name={`question-${question.id}`}
                                checked={response.selectedTagIds.includes(tag.id)}
                                onChange={() => handleQuestionTagToggle(question.id, tag.id)}
                              />
                              <span>{tag.tag_text}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {question.question.allows_free_text && (
                    <textarea
                      value={response.freeText}
                      onChange={(e) => handleQuestionFreeTextChange(question.id, e.target.value)}
                      placeholder={isRequired && question.question.allows_free_text ? "This field is required" : "Optional free text response"}
                      className="question-free-text"
                      rows={3}
                      required={isRequired && question.question.allows_free_text}
                    />
                  )}
                  {!isValid && (
                    <p className="question-error-message">
                      {isRequired && question.question.allows_free_text && (!response.freeText || !response.freeText.trim())
                        ? 'Free text response is required'
                        : isRequired && question.question.allows_tags && question.tags.length > 0 && response.selectedTagIds.length === 0
                          ? 'At least one tag must be selected'
                          : 'This question is required'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
      <footer className="App-footer">
        {questions.length > 0 && (
          <button 
            className="continue-button" 
            onClick={handleSubmit}
            disabled={!areRequiredQuestionsAnswered || submitting}
            title={!areRequiredQuestionsAnswered ? 'Please answer all required questions' : ''}
          >
            {submitting ? 'Submitting...' : 'Complete Study'}
          </button>
        )}
      </footer>
    </div>
  )
}

