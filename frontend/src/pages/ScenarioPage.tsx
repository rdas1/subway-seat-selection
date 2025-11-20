import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import SeatSelectionApp from '../components/SeatSelectionApp'
import StatisticsView from '../components/StatisticsView'
import Legend from '../components/Legend'
import { SubwayGrid } from '../classes/SubwayGrid'
import { PlayerGender } from '../App'
import { trainConfigApi, userResponseApi, QuestionResponseCreate } from '../services/api'
import { getSessionId } from '../utils/session'

export default function ScenarioPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [canProceedToNext, setCanProceedToNext] = useState<boolean>(true)

  // Check URL for results parameter
  const showResults = searchParams.get('results') === 'true'

  // Scroll to top when navigating to results page
  useEffect(() => {
    if (showResults) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [showResults])

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

  // Load random scenario on mount (only if no ID and not in results mode)
  useEffect(() => {
    if (!id && !showResults && !grid) {
      // Load a random scenario immediately
        const loadRandomScenario = async () => {
          try {
          setLoading(true)
          console.log('Loading random scenario...')
            const config = await trainConfigApi.getRandom()
          
          // Clear any existing selection state first
          setSelectedTile(null)
          setSelectionType(null)
          
            const subwayGrid = new SubwayGrid(config.height, config.width, config.tiles)
            setGrid(subwayGrid)
            setScenarioId(config.id)
            setScenarioName(config.name || null)
          setScenarioTitle(config.title || null)
          console.log('Random scenario loaded with ID:', config.id, 'Name:', config.name, 'Title:', config.title)
          
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
            
            // Update URL to include scenario ID
            navigate(`/scenario/${config.id}`, { replace: true })
            
            setTrainArrived(true)
          setIsTrainActive(true)
            setGridAnimation('slidingIn')
            setTimeout(() => {
              setGridAnimation('idle')
            }, 600)
            setLoading(false)
          } catch (err) {
            console.error('Failed to load random scenario:', err)
            setError(err instanceof Error ? err.message : 'Failed to load scenario')
            setLoading(false)
          }
        }
        loadRandomScenario()
      }
  }, [id, showResults, grid, navigate])

  // Load scenario on mount (when ID is provided)
  useEffect(() => {
    if (!id) {
      // If no ID, we'll load via the random scenario effect
      return
    }

    const loadScenario = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const scenarioId = parseInt(id, 10)
        
        if (isNaN(scenarioId)) {
          setError('Invalid scenario ID')
          setLoading(false)
          return
        }

        const config = await trainConfigApi.getById(scenarioId)
        
        // Clear any existing selection state first
        setSelectedTile(null)
        setSelectionType(null)
        
        // Create SubwayGrid from the configuration
        const subwayGrid = new SubwayGrid(config.height, config.width, config.tiles)
        setGrid(subwayGrid)
        setScenarioName(config.name || null)
        setScenarioTitle(config.title || null)
        setScenarioId(scenarioId)
        console.log('Scenario ID set for responses:', scenarioId)
        
        // Check if user has already responded to this scenario (for hiding platform user indicator)
        try {
          const sessionId = getSessionId()
          const previousResponse = await userResponseApi.getPreviousResponse(scenarioId, sessionId)
          setHasPreviousResponse(!!previousResponse && previousResponse.train_configuration_id === scenarioId)
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
        
        // Mark train as arrived for direct ID access
        setTrainArrived(true)
        setIsTrainActive(true)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scenario')
        setLoading(false)
      }
    }

    loadScenario()
  }, [id])

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
    // Check for both trainArrived (random scenario) and direct ID access
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
            
            // Navigate to results URL and return early to prevent next scenario logic
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
            // Return early even on stats error to prevent next scenario
            return
          }
        } catch (err) {
          console.error('Failed to submit user response:', err)
          const errorMessage = err instanceof Error ? err.message : 'Failed to submit response'
          setError(errorMessage)
          setSubmitting(false)
          return // Don't proceed to next train if submission failed
        } finally {
          setSubmitting(false)
        }
      }
    }

    // If we're in results mode, don't proceed to next train yet
    // The "Next Scenario" button will handle that
    if (showResults) {
      return
    }

    // Start slide-out animation if train is visible
    if (grid) {
      setIsTrainActive(false) // Mark train as inactive immediately
      setGridAnimation('slidingOut')
      // After animation completes, navigate to /scenario (no ID) to trigger random scenario load
      setTimeout(() => {
        setGrid(null)
        setSelectedTile(null)
        setTrainArrived(false)
        setGridAnimation('idle')
        setScenarioId(null)
        setScenarioName(null)
        setError(null)
        setSubmitSuccess(false)
        setStatistics(null)
        setUserSelection(null)
        setHasPreviousResponse(false)
        // Navigate to /scenario without ID to trigger random scenario load
        navigate('/scenario', { replace: true })
        // Recreate platform when train leaves
        setPlatformRecreateTrigger(prev => prev + 1)
        // Mark train as inactive - will be set to active when new scenario loads
        setIsTrainActive(false)
      }, 600) // Match animation duration
    } else {
      // If train hasn't arrived yet, clear state and navigate
      setIsTrainActive(false)
      setTrainArrived(false)
      setGrid(null)
      setSelectedTile(null)
      setScenarioId(null)
      setScenarioName(null)
      setStatistics(null)
      setUserSelection(null)
      setHasPreviousResponse(false)
      // Navigate to /scenario without ID to trigger random scenario load
      navigate('/scenario', { replace: true })
    }
    console.log('Waiting for next train')
  }

  const handleQuestionResponsesChange = useCallback((responses: QuestionResponseCreate[]) => {
    setQuestionResponses(responses)
  }, [])

  const handleValidationChange = useCallback((isValid: boolean) => {
    setCanProceedToNext(isValid)
  }, [])

  const handleNextScenario = async () => {
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
    
    // Store grid state before clearing
    const hadGrid = !!grid
    
    // Clear grid immediately to show loading/platform right away
    setGrid(null)
    setTrainArrived(false)
    setScenarioId(null)
    setScenarioName(null)
    setUserSelection(null)
    setHasPreviousResponse(false)
    
    // Start slide-out animation if grid was visible
    if (hadGrid) {
      setIsTrainActive(false)
      setGridAnimation('slidingOut')
      // After animation completes, navigate to /scenario (no ID) to trigger random scenario load
      setTimeout(() => {
        setGridAnimation('idle')
        // Navigate to /scenario without ID to trigger random scenario load
        navigate('/scenario', { replace: true })
        // Recreate platform when train leaves
        setPlatformRecreateTrigger(prev => prev + 1)
        // Mark train as inactive - will be set to active when new scenario loads
        setIsTrainActive(false)
      }, 600) // Match animation duration
    } else {
      // If no grid, immediately navigate to trigger random scenario load
      navigate('/scenario', { replace: true })
      setPlatformRecreateTrigger(prev => prev + 1)
      setIsTrainActive(false)
    }
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

  if (error) {
    return (
      <div className="App">
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={() => navigate('/')}>Go to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      <main className="App-main">
        <div className="main-header">
          {showResults && statistics ? (
            <>
              <h1>Results</h1>
              {scenarioName && <h2>{scenarioName}</h2>}
            </>
          ) : grid ? (
            <>
              {scenarioTitle && <h1 className="scenario-title">{scenarioTitle}</h1>}
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
            showTrain={(trainArrived || !!id) && isTrainActive && !showResults && !!grid}
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
            title={!canProceedToNext ? 'Please answer all required questions' : ''}
          >
            Next Scenario
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

