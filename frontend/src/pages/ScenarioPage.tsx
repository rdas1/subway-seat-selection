import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import SeatSelectionApp from '../components/SeatSelectionApp'
import StatisticsView from '../components/StatisticsView'
import { SubwayGrid } from '../classes/SubwayGrid'
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_NEUTRAL } from '../constants/emojis'
import { getRandomTrainDelay } from '../constants/train'
import { PlayerGender } from '../App'
import { trainConfigApi, userResponseApi } from '../services/api'

export default function ScenarioPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [playerGender, setPlayerGender] = useState<PlayerGender>('neutral')
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null)
  const [selectionType, setSelectionType] = useState<'train' | 'platform' | null>(null)
  const [grid, setGrid] = useState<SubwayGrid | null>(null)
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState<number>(0)
  const [platformRecreateTrigger, setPlatformRecreateTrigger] = useState<number>(0)
  const [legendExpanded, setLegendExpanded] = useState<boolean>(false)
  const [gridAnimation, setGridAnimation] = useState<'idle' | 'slidingIn' | 'slidingOut'>('idle')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [scenarioName, setScenarioName] = useState<string | null>(null)
  const [scenarioId, setScenarioId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [trainArrived, setTrainArrived] = useState<boolean>(false)
  const [isTrainActive, setIsTrainActive] = useState<boolean>(false)
  const [statistics, setStatistics] = useState<{
    total_responses: number
    seat_selections: number
    floor_selections: number
    selection_heatmap: Record<string, number>
  } | null>(null)

  // Check URL for results parameter
  const showResults = searchParams.get('results') === 'true'

  // Collapse legend by default on mobile
  useEffect(() => {
    const checkMobile = () => {
      setLegendExpanded(window.innerWidth >= 768) // Expanded by default on desktop
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Initialize countdown on mount (only if no ID and not in results mode)
  useEffect(() => {
    if (!id && !showResults) {
      const delay = getRandomTrainDelay()
      setCountdown(delay)
      setTrainArrived(false)
      setIsTrainActive(true)
    }
  }, [id, showResults])

  // Countdown timer
  useEffect(() => {
    // Don't run countdown when in results mode or when ID is provided
    if (showResults || id) {
      return
    }

    if (countdown === null || countdown <= 0) {
      if (countdown === 0 && isTrainActive && !grid) {
        // Train has arrived and train is active - load a random scenario
        const loadRandomScenario = async () => {
          try {
            console.log('Loading random scenario for train arrival...')
            const config = await trainConfigApi.getRandom()
            const subwayGrid = new SubwayGrid(config.height, config.width, config.tiles)
            setGrid(subwayGrid)
            setScenarioId(config.id)
            setScenarioName(config.name || null)
            console.log('Random scenario loaded with ID:', config.id, 'Name:', config.name)
            
            // Update URL to include scenario ID
            navigate(`/scenario/${config.id}`, { replace: true })
            
            setTrainArrived(true)
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
      return
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, grid, isTrainActive, showResults, id, navigate])

  // Load scenario on mount (when ID is provided)
  useEffect(() => {
    if (!id) {
      // If no ID, we'll load via countdown
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
        
        // Create SubwayGrid from the configuration
        const subwayGrid = new SubwayGrid(config.height, config.width, config.tiles)
        setGrid(subwayGrid)
        setScenarioName(config.name || null)
        setScenarioId(scenarioId)
        console.log('Scenario ID set for responses:', scenarioId)
        
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
          
          // Submit the user response
          const response = await userResponseApi.create({
            train_configuration_id: scenarioId,
            row: selectedTile.row,
            col: selectedTile.col,
            selection_type: responseSelectionType,
            gender: playerGender,
          })
          
          console.log('POST request successful:', response)
          console.log('Response saved to database with ID:', response.id)
          
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
      // After animation completes, navigate to /scenario (no ID) to trigger countdown
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
        // Navigate to /scenario without ID to trigger countdown and random scenario
        navigate('/scenario', { replace: true })
        // Recreate platform when train leaves
        setPlatformRecreateTrigger(prev => prev + 1)
        // Generate random delay for next train
        const delay = getRandomTrainDelay()
        setCountdown(delay)
        // Mark train as active again so countdown can trigger arrival
        setIsTrainActive(true)
      }, 600) // Match animation duration
    } else {
      // If train hasn't arrived yet, just reset countdown
      setIsTrainActive(true) // Mark train as active
      const delay = getRandomTrainDelay()
      setCountdown(delay)
      setTrainArrived(false)
      setGrid(null)
      setSelectedTile(null)
      setScenarioId(null)
      setScenarioName(null)
      setStatistics(null)
      // Navigate to /scenario without ID to trigger countdown
      navigate('/scenario', { replace: true })
    }
    console.log('Waiting for next train')
  }

  const handleNextScenario = () => {
    // Clear results from URL and state
    setStatistics(null)
    setSubmitSuccess(false)
    setError(null)
    setSelectedTile(null)
    
    // Start slide-out animation
    if (grid) {
      setIsTrainActive(false)
      setGridAnimation('slidingOut')
      // After animation completes, navigate to /scenario (no ID) to trigger countdown
      setTimeout(() => {
        setGrid(null)
        setTrainArrived(false)
        setGridAnimation('idle')
        setScenarioId(null)
        setScenarioName(null)
        setStatistics(null)
        // Navigate to /scenario without ID to trigger countdown and random scenario
        navigate('/scenario', { replace: true })
        // Recreate platform when train leaves
        setPlatformRecreateTrigger(prev => prev + 1)
        // Generate random delay for next train
        const delay = getRandomTrainDelay()
        setCountdown(delay)
        // Mark train as active again so countdown can trigger arrival
        setIsTrainActive(true)
      }, 600) // Match animation duration
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

  if (loading) {
    return (
      <div className="App">
        <div className="loading-message">
          <p>Loading scenario...</p>
        </div>
      </div>
    )
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
      <header className="App-header">
        <div className="subtitle-row">
          <button 
            className="legend-toggle" 
            onClick={() => setLegendExpanded(!legendExpanded)}
            aria-expanded={legendExpanded}
            aria-label={legendExpanded ? 'Collapse legend' : 'Expand legend'}
          >
            <span className="legend-toggle-label">Legend</span>
            <span className="legend-toggle-icon">{legendExpanded ? '▼' : '▶'}</span>
          </button>
        </div>
        <div className="legend-container">
          {legendExpanded && (
            <div className="legend">
              <div className="legend-item">
                <span className="legend-label">You:</span>
                <select
                  id="gender-select"
                  value={playerGender}
                  onChange={(e) => setPlayerGender(e.target.value as PlayerGender)}
                  className="gender-dropdown"
                >
                  <option value="man">{EMOJI_MAN} Man</option>
                  <option value="woman">{EMOJI_WOMAN} Woman</option>
                  <option value="neutral">{EMOJI_NEUTRAL} Gender Neutral</option>
                </select>
              </div>
              <div className="legend-item">
                <div className="legend-tile tile-legend-eligible-seat"></div>
                <span className="legend-label">Available Seat</span>
              </div>
              <div className="legend-item">
                <div className="legend-tile tile-legend-eligible-floor"></div>
                <span className="legend-label">Available Floor</span>
              </div>
              <div className="legend-item">
                <div className="legend-tile tile-legend-door-left"></div>
                <div className="legend-tile tile-legend-door-right"></div>
                <span className="legend-label">Door</span>
              </div>
              <div className="legend-item">
                <div className="legend-tile tile-legend-stanchion"></div>
                <span className="legend-label">Stanchion</span>
              </div>
              <div className="legend-item">
                <div className="legend-tile tile-legend-occupied"></div>
                <div className="legend-tile tile-legend-occupied-floor"></div>
                <span className="legend-label">Occupied</span>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="App-main">
        <div className="main-header">
          {showResults && statistics ? (
            <>
              {scenarioName && <h1>{scenarioName}</h1>}
            </>
          ) : grid ? (
            <>
              {scenarioName && <h1>{scenarioName}</h1>}
              <h2>Where will you sit (or stand)?</h2>
            </>
          ) : (
            <>
              <h1>Your train is arriving in {countdown ?? '...'} {countdown === 1 ? 'second' : 'seconds'}</h1>
              <h2>Where will you sit (or stand)?</h2>
            </>
          )}
        </div>
        {showResults && statistics && grid && scenarioId ? (
          <StatisticsView 
            grid={grid} 
            scenarioId={scenarioId}
            statistics={statistics}
            onStatisticsUpdate={setStatistics}
          />
        ) : showResults ? (
          <div className="loading-message">
            <p>Loading statistics...</p>
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
          />
        )}
      </main>
      <footer className="App-footer">
        {showResults ? (
          <button 
            className="continue-button" 
            onClick={handleNextScenario}
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
        ) : (
          <button 
            className="continue-button" 
            onClick={handleContinue}
            disabled={submitting}
          >
            Wait for the next train
          </button>
        )}
      </footer>
    </div>
  )
}

