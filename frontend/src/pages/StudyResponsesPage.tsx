import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  studyApi, 
  StudyResponse, 
  preStudyQuestionResponseApi, 
  PreStudyQuestionAnswerResponse,
  postStudyQuestionResponseApi,
  PostStudyQuestionAnswerResponse,
  preStudyQuestionApi,
  PreStudyQuestionResponse,
  postStudyQuestionApi,
  PostStudyQuestionResponse,
  trainConfigApi,
  QuestionResponseResponse,
  TrainConfigurationResponse,
  PostResponseQuestionResponse
} from '../services/api'
import { SubwayGrid } from '../classes/SubwayGrid'
import StatisticsView from '../components/StatisticsView'
import { useAuth } from '../contexts/AuthContext'
import './StudyResponsesPage.css'

export default function StudyResponsesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [study, setStudy] = useState<StudyResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  
  // Pre-study data
  const [preStudyQuestions, setPreStudyQuestions] = useState<PreStudyQuestionResponse[]>([])
  const [preStudyResponses, setPreStudyResponses] = useState<Record<number, PreStudyQuestionAnswerResponse[]>>({})
  const [expandedPreStudyQuestions, setExpandedPreStudyQuestions] = useState<Set<number>>(new Set())
  
  // Post-study data
  const [postStudyQuestions, setPostStudyQuestions] = useState<PostStudyQuestionResponse[]>([])
  const [postStudyResponses, setPostStudyResponses] = useState<Record<number, PostStudyQuestionAnswerResponse[]>>({})
  const [expandedPostStudyQuestions, setExpandedPostStudyQuestions] = useState<Set<number>>(new Set())
  
  // Scenario data
  const [scenarios, setScenarios] = useState<TrainConfigurationResponse[]>([])
  const [scenarioStatistics, setScenarioStatistics] = useState<Record<number, any>>({})
  const [scenarioQuestionResponses, setScenarioQuestionResponses] = useState<Record<number, Record<number, QuestionResponseResponse[]>>>({})
  const [scenarioQuestions, setScenarioQuestions] = useState<Record<number, PostResponseQuestionResponse[]>>({})
  const [expandedScenarioQuestions, setExpandedScenarioQuestions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user && !authLoading) {
      navigate('/study-builder', { replace: true })
      return
    }

    if (user && id) {
      const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
          const studyId = parseInt(id, 10)
          if (isNaN(studyId)) {
            throw new Error('Invalid study ID')
          }
          
          // Load study
          const studyData = await studyApi.getById(studyId)
          setStudy(studyData)
          
          // Load pre-study questions and responses
          const [preQuestions, preResponses] = await Promise.all([
            preStudyQuestionApi.getAll(studyId),
            preStudyQuestionResponseApi.getAll(studyId)
          ])
          setPreStudyQuestions(preQuestions)
          setPreStudyResponses(preResponses)
          
          // Load post-study questions and responses
          const [postQuestions, postResponses] = await Promise.all([
            postStudyQuestionApi.getAll(studyId),
            postStudyQuestionResponseApi.getAll(studyId)
          ])
          setPostStudyQuestions(postQuestions)
          setPostStudyResponses(postResponses)
          
          // Load scenarios and their data
          if (studyData.scenario_group?.items) {
            const scenarioList: TrainConfigurationResponse[] = []
            const statsMap: Record<number, any> = {}
            const questionResponsesMap: Record<number, Record<number, QuestionResponseResponse[]>> = {}
            const questionsMap: Record<number, PostResponseQuestionResponse[]> = {}
            
            for (const item of studyData.scenario_group.items) {
              if (item.train_configuration) {
                const scenario = item.train_configuration
                scenarioList.push(scenario)
                
                // Load statistics, question responses, and questions for each scenario
                try {
                  const [stats, questionResponses, questions] = await Promise.all([
                    trainConfigApi.getStatistics(scenario.id),
                    trainConfigApi.getQuestionResponses(scenario.id),
                    trainConfigApi.getQuestions(scenario.id)
                  ])
                  statsMap[scenario.id] = stats
                  questionResponsesMap[scenario.id] = questionResponses
                  questionsMap[scenario.id] = questions
                } catch (err) {
                  console.error(`Failed to load data for scenario ${scenario.id}:`, err)
                }
              }
            }
            
            setScenarios(scenarioList)
            setScenarioStatistics(statsMap)
            setScenarioQuestionResponses(questionResponsesMap)
            setScenarioQuestions(questionsMap)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load study responses')
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [user, authLoading, id, navigate])

  const togglePreStudyQuestionExpansion = (questionId: number) => {
    const newExpanded = new Set(expandedPreStudyQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedPreStudyQuestions(newExpanded)
  }

  const togglePostStudyQuestionExpansion = (questionId: number) => {
    const newExpanded = new Set(expandedPostStudyQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedPostStudyQuestions(newExpanded)
  }

  // Helper function to map gender tag text to gender value
  const mapGenderTagToValue = (tagText: string): string | null => {
    const normalized = tagText.toLowerCase().trim()
    if (normalized === 'man' || normalized === 'male') {
      return 'man'
    } else if (normalized === 'woman' || normalized === 'female') {
      return 'woman'
    } else if (normalized === 'non-binary' || normalized === 'nonbinary') {
      return 'neutral'
    } else if (normalized === 'prefer not to say' || normalized.includes('prefer not')) {
      return 'prefer-not-to-say'
    }
    return null
  }

  // Create a mapping from user_session_id to gender from pre-study responses
  const getGenderFromPreStudyResponses = (userSessionId?: string): string | null => {
    if (!userSessionId) return null
    
    // Find the gender identity question (case-insensitive, flexible matching)
    const genderQuestion = preStudyQuestions.find(q => {
      const questionText = q.question.question_text.toLowerCase()
      return questionText.includes('gender identity') || 
             questionText.includes('what is your gender') ||
             (questionText.includes('gender') && questionText.includes('identity'))
    })
    
    if (!genderQuestion) return null
    
    // Find the response for this session and question
    const responses = preStudyResponses[genderQuestion.id] || []
    const response = responses.find(r => r.user_session_id === userSessionId)
    
    if (!response || !response.selected_tags || response.selected_tags.length === 0) {
      return null
    }
    
    // Get the first selected tag and map it to gender value
    const tagText = response.selected_tags[0].tag_text
    return mapGenderTagToValue(tagText)
  }

  // Get gender for a scenario question response, checking pre-study responses if needed
  const getGenderForResponse = (response: QuestionResponseResponse): string | null => {
    // First check if gender is already in the response
    if (response.gender) {
      return response.gender
    }
    
    // If not, try to get it from pre-study responses
    if (response.user_session_id) {
      return getGenderFromPreStudyResponses(response.user_session_id)
    }
    
    return null
  }

  const toggleScenarioQuestionExpansion = (scenarioId: number, questionId: number) => {
    const key = `${scenarioId}-${questionId}`
    const newExpanded = new Set(expandedScenarioQuestions)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedScenarioQuestions(newExpanded)
  }

  if (authLoading || loading) {
    return (
      <div className="study-responses-page">
        <div className="study-responses-container">
          <h1>Loading...</h1>
        </div>
      </div>
    )
  }

  if (error || !study) {
    return (
      <div className="study-responses-page">
        <div className="study-responses-container">
          <h1>Study Responses</h1>
          <div className="error-message">
            <p>{error || 'Study not found'}</p>
          </div>
          <button onClick={() => navigate(`/study-builder/${id}`)} className="back-button">
            Back to Study Detail
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="study-responses-page">
      <div className="study-responses-container">
        <div className="study-responses-header">
          <button onClick={() => navigate(`/study-builder/${study.id}`)} className="back-button">
            ← Back to Study Detail
          </button>
          <h1>{study.title} - All Responses</h1>
        </div>

        {/* Pre-Study Question Responses */}
        {preStudyQuestions.length > 0 && (
          <section className="responses-section">
            <h2>Pre-Study Question Responses</h2>
            <div className="question-responses-list">
              {preStudyQuestions.map((question) => {
                const responses = preStudyResponses[question.id] || []
                const isExpanded = expandedPreStudyQuestions.has(question.id)
                const INITIAL_DISPLAY = 5
                const displayedResponses = isExpanded ? responses : responses.slice(0, INITIAL_DISPLAY)
                const hasMore = responses.length > INITIAL_DISPLAY
                
                return (
                  <div key={question.id} className="question-response-group">
                    <h3 className="question-response-title">{question.question.question_text}</h3>
                    <p className="response-count">{responses.length} response{responses.length !== 1 ? 's' : ''}</p>
                    {responses.length === 0 ? (
                      <p className="no-responses-message">No responses yet.</p>
                    ) : (
                      <>
                        <div className="question-response-items">
                          {displayedResponses.map((response) => (
                            <div key={response.id} className="question-response-item">
                              {response.free_text_response && (
                                <div className="response-free-text">
                                  {response.free_text_response}
                                </div>
                              )}
                              {response.selected_tags.length > 0 && (
                                <div className="response-tags">
                                  {response.selected_tags.map((tag) => (
                                    <span key={tag.id} className="response-tag">
                                      {tag.tag_text}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {!response.free_text_response && response.selected_tags.length === 0 && (
                                <div className="response-empty">No response provided</div>
                              )}
                            </div>
                          ))}
                        </div>
                        {hasMore && (
                          <button
                            onClick={() => togglePreStudyQuestionExpansion(question.id)}
                            className="view-more-button"
                          >
                            {isExpanded ? 'Show Less' : `View More (${responses.length - INITIAL_DISPLAY} more)`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Scenario Responses */}
        {scenarios.length > 0 && (
          <section className="responses-section">
            <h2>Scenario Responses</h2>
            {scenarios.map((scenario) => {
              const stats = scenarioStatistics[scenario.id]
              const questionResponses = scenarioQuestionResponses[scenario.id] || {}
              
              return (
                <div key={scenario.id} className="scenario-responses-group">
                  <h3>{scenario.title || scenario.name || 'Untitled Scenario'}</h3>
                  
                  {/* Heatmap */}
                  {stats && (
                    <div className="scenario-heatmap">
                      <h4>Selection Heatmap</h4>
                      <div className="heatmap-container">
                        <StatisticsView
                          grid={new SubwayGrid(scenario.height, scenario.width, scenario.tiles as any)}
                          scenarioId={scenario.id}
                          statistics={stats}
                          onStatisticsUpdate={(newStats) => {
                            setScenarioStatistics({
                              ...scenarioStatistics,
                              [scenario.id]: newStats
                            })
                          }}
                          userSelection={null}
                          userResponseId={undefined}
                        />
                      </div>
                      <div className="heatmap-stats">
                        <p>Total Responses: {stats.total_responses || 0}</p>
                        <p>Seat Selections: {stats.seat_selections || 0}</p>
                        <p>Floor Selections: {stats.floor_selections || 0}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Scenario Question Responses */}
                  {(() => {
                    const questions = scenarioQuestions[scenario.id] || []
                    const questionIds = Object.keys(questionResponses).map(id => parseInt(id, 10))
                    
                    if (questionIds.length === 0) {
                      return null
                    }
                    
                    return (
                      <div className="scenario-questions">
                        <h4>Question Responses</h4>
                        {questionIds.map((questionId) => {
                          const responses = questionResponses[questionId] || []
                          const question = questions.find(q => q.id === questionId)
                          const key = `${scenario.id}-${questionId}`
                          const isExpanded = expandedScenarioQuestions.has(key)
                          const INITIAL_DISPLAY = 5
                          const displayedResponses = isExpanded ? responses : responses.slice(0, INITIAL_DISPLAY)
                          const hasMore = responses.length > INITIAL_DISPLAY
                          
                          return (
                            <div key={questionId} className="question-response-group">
                              <h5 className="question-response-title">
                                {question ? question.question.question_text : `Question ID: ${questionId}`}
                              </h5>
                              <p className="response-count">{responses.length} response{responses.length !== 1 ? 's' : ''}</p>
                            {responses.length === 0 ? (
                              <p className="no-responses-message">No responses yet.</p>
                            ) : (
                              <>
                                <div className="question-response-items">
                                  {displayedResponses.map((response) => {
                                    const gender = getGenderForResponse(response)
                                    return (
                                    <div key={response.id} className="question-response-item">
                                      <div className="response-metadata">
                                        {(response.row !== undefined && response.col !== undefined) && (
                                          <span className="response-location">
                                            Position: Row {response.row}, Col {response.col}
                                          </span>
                                        )}
                                        {gender && (
                                          <span className={`response-gender ${!response.gender ? 'gender-from-pre-study' : ''}`}>
                                            Gender: {gender}
                                            {!response.gender && <span className="gender-source-indicator" title="Gender extracted from pre-study question response">*</span>}
                                          </span>
                                        )}
                                      </div>
                                      {response.free_text_response && (
                                        <div className="response-free-text">
                                          {response.free_text_response}
                                        </div>
                                      )}
                                      {response.selected_tags.length > 0 && (
                                        <div className="response-tags">
                                          {response.selected_tags.map((tag) => (
                                            <span key={tag.id} className="response-tag">
                                              {tag.tag_text}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {!response.free_text_response && response.selected_tags.length === 0 && (
                                        <div className="response-empty">No response provided</div>
                                      )}
                                    </div>
                                    )
                                  })}
                                </div>
                                {hasMore && (
                                  <button
                                    onClick={() => toggleScenarioQuestionExpansion(scenario.id, questionId)}
                                    className="view-more-button"
                                  >
                                    {isExpanded ? 'Show Less' : `View More (${responses.length - INITIAL_DISPLAY} more)`}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </section>
        )}

        {/* Post-Study Question Responses */}
        {postStudyQuestions.length > 0 && (
          <section className="responses-section">
            <h2>Post-Study Question Responses</h2>
            <div className="question-responses-list">
              {postStudyQuestions.map((question) => {
                const responses = postStudyResponses[question.id] || []
                const isExpanded = expandedPostStudyQuestions.has(question.id)
                const INITIAL_DISPLAY = 5
                const displayedResponses = isExpanded ? responses : responses.slice(0, INITIAL_DISPLAY)
                const hasMore = responses.length > INITIAL_DISPLAY
                
                return (
                  <div key={question.id} className="question-response-group">
                    <h3 className="question-response-title">{question.question.question_text}</h3>
                    <p className="response-count">{responses.length} response{responses.length !== 1 ? 's' : ''}</p>
                    {responses.length === 0 ? (
                      <p className="no-responses-message">No responses yet.</p>
                    ) : (
                      <>
                        <div className="question-response-items">
                          {displayedResponses.map((response) => (
                            <div key={response.id} className="question-response-item">
                              {response.free_text_response && (
                                <div className="response-free-text">
                                  {response.free_text_response}
                                </div>
                              )}
                              {response.selected_tags.length > 0 && (
                                <div className="response-tags">
                                  {response.selected_tags.map((tag) => (
                                    <span key={tag.id} className="response-tag">
                                      {tag.tag_text}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {!response.free_text_response && response.selected_tags.length === 0 && (
                                <div className="response-empty">No response provided</div>
                              )}
                            </div>
                          ))}
                        </div>
                        {hasMore && (
                          <button
                            onClick={() => togglePostStudyQuestionExpansion(question.id)}
                            className="view-more-button"
                          >
                            {isExpanded ? 'Show Less' : `View More (${responses.length - INITIAL_DISPLAY} more)`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

