import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import SeatSelectionApp from '../components/SeatSelectionApp'
import StatisticsView from '../components/StatisticsView'
import Legend from '../components/Legend'
import StudyProgressBar from '../components/StudyProgressBar'
import { SubwayGrid } from '../classes/SubwayGrid'
import { PlayerGender } from '../App'
import { studyApi, trainConfigApi, userResponseApi, QuestionResponseCreate, studyProgressApi, StudyProgressResponse } from '../services/api'
import { getSessionId } from '../utils/session'

export default function StudyScenarioPage() {
  const { id, scenarioNumber } = useParams<{ id: string; scenarioNumber: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const studyId = id ? parseInt(id, 10) : null
  const scenarioNum = scenarioNumber ? parseInt(scenarioNumber, 10) : null
  const [playerGender, setPlayerGender] = useState<PlayerGender>('prefer-not-to-say')
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null)
  const [selectionType, setSelectionType] = useState<'train' | 'platform' | null>(null)
  const [grid, setGrid] = useState<SubwayGrid | null>(null)
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState<number>(0)
  const [platformRecreateTrigger, setPlatformRecreateTrigger] = useState<number>(0)
  const [gridAnimation, setGridAnimation] = useState<'idle' | 'slidingIn' | 'slidingOut'>('idle')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [scenarioName, setScenarioName] = useState<string | null>(null)
  const [scenarioTitle, setScenarioTitle] = useState<string | null>(null)
  const [scenarioId, setScenarioId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false)
  const [trainArrived, setTrainArrived] = useState<boolean>(false)
  const [isTrainActive, setIsTrainActive] = useState<boolean>(false)
  const [statistics, setStatistics] = useState<{
    total_responses: number
    seat_selections: number
    floor_selections: number
    selection_heatmap: Record<string, number>
  } | null>(null)
  const [userSelection, setUserSelection] = useState<{ row: number; col: number } | null>(null)
  const [hasPreviousResponse, setHasPreviousResponse] = useState<boolean>(false)
  const [userResponseId, setUserResponseId] = useState<number | null>(null)
  const [questionResponses, setQuestionResponses] = useState<QuestionResponseCreate[]>([])
  const [canProceedToNext, setCanProceedToNext] = useState<boolean>(false) // Start disabled until validation runs
  const [totalScenarios, setTotalScenarios] = useState<number>(0)

  // Check URL for results parameter
  const showResults = searchParams.get('results') === 'true'

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Load total scenarios count and validate progress
  useEffect(() => {
    const loadProgress = async () => {
      if (studyId && scenarioNum) {
        try {
          const sessionId = getSessionId()
          const progress = await studyProgressApi.getProgress(studyId, sessionId)
          setTotalScenarios(progress.total_scenarios)
          
          // Validate that user has reached this point in the study
          // Must have completed pre-study questions
          if (!progress.pre_study_completed) {
            navigate(`/study/${studyId}/pre-study-questions`, { replace: true })
            return
          }
          
          // Must have completed previous scenarios (scenarioNum - 1)
          // Allow access to current scenario even if not fully completed
          if (scenarioNum > 1 && progress.scenarios_completed < scenarioNum - 1) {
            // Redirect to the first scenario they haven't completed, or pre-study if none
            const nextScenario = progress.scenarios_completed + 1
            if (nextScenario <= progress.total_scenarios) {
              navigate(`/study/${studyId}/scenario/${nextScenario}`, { replace: true })
            } else {
              navigate(`/study/${studyId}/pre-study-questions`, { replace: true })
            }
            return
          }
        } catch (err) {
          console.error('Failed to load progress:', err)
          // On error, redirect to pre-study questions to be safe
          navigate(`/study/${studyId}/pre-study-questions`, { replace: true })
        }
      }
    }
    loadProgress()
  }, [studyId, scenarioNum, navigate])

  // Load statistics when results parameter is present
  useEffect(() => {
    const loadStatistics = async () => {
      if (showResults && scenarioId && !statistics) {
        try {
          const stats = await trainConfigApi.getStatistics(scenarioId)
          setStatistics(stats)
        } catch (err) {
          console.error('Failed to load statistics:', err)
          setError(err instanceof Error ? err.message : 'Failed to load statistics')
        }
      }
    }
    loadStatistics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, scenarioId])

  // Load scenario on mount
  useEffect(() => {
    if (!studyId || !scenarioNum || isNaN(studyId) || isNaN(scenarioNum)) {
      setError('Invalid study ID or scenario number')
      setLoading(false)
      return
    }

    const loadScenario = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const config = await studyApi.getScenarioByOrder(studyId, scenarioNum)
        
        // Clear any existing selection state first
        setSelectedTile(null)
        setSelectionType(null)
        
        // Create SubwayGrid from the configuration
        const subwayGrid = new SubwayGrid(config.height, config.width, config.tiles)
        setGrid(subwayGrid)
        setScenarioName(config.name || null)
        setScenarioTitle(config.title || null)
        setScenarioId(config.id)
        console.log('Study scenario loaded with ID:', config.id, 'Name:', config.name, 'Title:', config.title)
        
        // Check if user has already responded to this scenario (for hiding platform user indicator)
        try {
          const sessionId = getSessionId()
          const previousResponse = await userResponseApi.getPreviousResponse(config.id, sessionId)
          setHasPreviousResponse(!!previousResponse && previousResponse.train_configuration_id === config.id)
        } catch (err) {
          console.error('Failed to check previous response:', err)
          setHasPreviousResponse(false)
          // Don't block scenario loading if this fails
        }
        
        // Trigger slide-in animation
        setGridAnimation('slidingIn')
        setTimeout(() => {
          setGridAnimation('idle')
        }, 600)
        
        // Mark train as arrived
        setTrainArrived(true)
        setIsTrainActive(true)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scenario')
        setLoading(false)
      }
    }

    loadScenario()
  }, [studyId, scenarioNum])

  // Set animation to idle after initial slide-in
  useEffect(() => {
    const timer = setTimeout(() => {
      if (gridAnimation === 'slidingIn') {
        setGridAnimation('idle')
      }
    }, 600) // Match animation duration
    return () => clearTimeout(timer)
  }, [gridAnimation])

  const handleClearSelection = () => {
    setSelectedTile(null)
    // Trigger clear in child component
    setClearSelectionTrigger(prev => prev + 1)
  }

  const handleContinue = async () => {
    // If we have a train selection, submit it first
    if (grid && selectedTile && selectionType === 'train' && scenarioId) {
      const tileData = grid.getTile(selectedTile.row, selectedTile.col)
      
      if (tileData) {
        try {
          setSubmitting(true)
          setError(null)

          const responseSelectionType = tileData.type === 'seat' ? 'seat' : 'floor'
          
          console.log('Submitting POST request:', {
            train_configuration_id: scenarioId,
            row: selectedTile.row,
            col: selectedTile.col,
            selection_type: responseSelectionType,
          })
          
          // Submit the user response with session ID
          const sessionId = getSessionId()
          const response = await userResponseApi.create({
            train_configuration_id: scenarioId,
            row: selectedTile.row,
            col: selectedTile.col,
            selection_type: responseSelectionType,
            gender: playerGender,
            user_session_id: sessionId,
          })
          
          console.log('POST request successful:', response)
          console.log('Response saved to database with ID:', response.id)
          
          // Store user's selection and response ID before navigating to results
          setUserSelection({ row: selectedTile.row, col: selectedTile.col })
          setUserResponseId(response.id)
          setHasPreviousResponse(true)
          
          // Fetch statistics and navigate to results
          try {
            const stats = await trainConfigApi.getStatistics(scenarioId)
            console.log('Statistics fetched:', stats)
            setStatistics(stats)
            setSubmitSuccess(true)
            
            // Navigate to results URL and return early
            const newParams = new URLSearchParams(searchParams)
            newParams.set('results', 'true')
            setSearchParams(newParams, { replace: true })
            
            // Return early to prevent any further logic from running
            return
          } catch (statsErr) {
            console.error('Failed to fetch statistics:', statsErr)
            // Still show success even if stats fail
            setSubmitSuccess(true)
            setTimeout(() => {
              setSubmitSuccess(false)
            }, 2000)
            // Return early even on stats error
            return
          }
        } catch (err) {
          console.error('Failed to submit user response:', err)
          const errorMessage = err instanceof Error ? err.message : 'Failed to submit response'
          setError(errorMessage)
          setSubmitting(false)
          return // Don't proceed if submission failed
        } finally {
          setSubmitting(false)
        }
      }
    }

    // If we're in results mode, don't proceed yet
    // The "Next Scenario" button will handle that
    if (showResults) {
      return
    }
  }

  const handleQuestionResponsesChange = useCallback((responses: QuestionResponseCreate[]) => {
    setQuestionResponses(responses)
  }, [])

  const handleValidationChange = useCallback((isValid: boolean) => {
    setCanProceedToNext(isValid)
  }, [])

  const handleNextScenario = async () => {
    if (!studyId || !scenarioNum) return

    // Scroll to top immediately before navigation

    // Submit question responses if we have a user response ID and question responses
    if (userResponseId && questionResponses.length > 0) {
      try {
        await userResponseApi.submitQuestionResponses(userResponseId, questionResponses)
        console.log('Question responses submitted successfully')
      } catch (err) {
        console.error('Failed to submit question responses:', err)
        setError(err instanceof Error ? err.message : 'Failed to submit question responses')
        return // Don't proceed if submission failed
      }
    }
    
    // Clear results from URL and state
    setStatistics(null)
    setSubmitSuccess(false)
    setError(null)
    setSelectedTile(null)
    setUserResponseId(null)
    setQuestionResponses([])
    setCanProceedToNext(true)
    
    // Scroll to top of page
    
    // Determine next page
    const nextScenarioNum = scenarioNum + 1
    
    if (nextScenarioNum > totalScenarios) {
      // Navigate to post-study questions
      navigate(`/study/${studyId}/post-study-questions`)
    } else {
      // Navigate to next scenario
      navigate(`/study/${studyId}/scenario/${nextScenarioNum}`)
    }

    // setTimeout(() => {
    //     window.scrollTo({ top: 0, behavior: 'smooth' })
    //   }, 100)
  }

  // Handle selection change
  const handleSelectionChange = (tile: { row: number; col: number } | null) => {
    setSelectedTile(tile)
    // Clear any previous errors and success messages when selection changes
    if (error) {
      setError(null)
    }
    if (submitSuccess) {
      setSubmitSuccess(false)
    }
  }

  if (error && !grid) {
    return (
      <div className="App">
        {studyId && <StudyProgressBar studyId={studyId} />}
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={() => navigate('/')}>Go to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      {studyId && <StudyProgressBar studyId={studyId} />}
      <main className="App-main">
        <div className="main-header">
          {showResults && statistics ? (
            <>
              <p className="scenario-title"><i>Scenario {scenarioNum}{scenarioTitle ? `: "${scenarioTitle}"` : ''}</i></p>
              <h1>Results</h1>
            </>
          ) : grid ? (
            <>
              <p className="scenario-title"><i>Scenario {scenarioNum}{scenarioTitle ? `: "${scenarioTitle}"` : ''}</i></p>
              <h1 className="main-header-prompt">Your train is here! Where will you sit or stand?</h1>
            </>
          ) : loading || !grid ? (
            <>
              <h1>Loading...</h1>
            </>
          ) : null}
        </div>
        {!showResults && (
          <Legend 
            playerGender={playerGender}
            onGenderChange={setPlayerGender}
          />
        )}
        {showResults && statistics && grid && scenarioId ? (
          <StatisticsView 
            grid={grid} 
            scenarioId={scenarioId}
            statistics={statistics}
            onStatisticsUpdate={setStatistics}
            userSelection={userSelection}
            userResponseId={userResponseId || undefined}
            onQuestionResponsesChange={handleQuestionResponsesChange}
            onValidationChange={handleValidationChange}
          />
        ) : showResults ? (
          <div className="loading-message">
          </div>
        ) : (
          <SeatSelectionApp 
            initialGrid={grid} 
            playerGender={playerGender}
            onSelectionChange={handleSelectionChange}
            onSelectionTypeChange={setSelectionType}
            clearSelectionTrigger={clearSelectionTrigger}
            platformRecreateTrigger={platformRecreateTrigger}
            animationState={gridAnimation}
            showTrain={(trainArrived || !!scenarioNum) && isTrainActive && !showResults && !!grid}
            hasPreviousResponse={hasPreviousResponse}
          />
        )}
      </main>
      <footer className="App-footer">
        {showResults ? (
          <button 
            className="continue-button" 
            onClick={handleNextScenario}
            disabled={!canProceedToNext}
            title={!canProceedToNext ? 'Please answer all required questions before continuing' : ''}
            aria-label={!canProceedToNext ? 'Please answer all required questions before continuing' : undefined}
          >
            {scenarioNum && scenarioNum >= totalScenarios ? 'Continue to Post-Study Questions' : 'Next Scenario'}
          </button>
        ) : selectionType === 'train' ? (
          <>
            {error && (
              <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>
                {error}
              </div>
            )}
            {submitSuccess && (
              <div className="success-message" style={{ color: 'green', marginBottom: '10px' }}>
                ✓ Response saved successfully!
              </div>
            )}
            <button 
              className="clear-button" 
              onClick={handleClearSelection}
              disabled={submitting}
            >
              Clear Selection
            </button>
            <button 
              className="continue-button" 
              onClick={handleContinue}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Continue'}
            </button>
          </>
        ) : null}
      </footer>
    </div>
  )
}

