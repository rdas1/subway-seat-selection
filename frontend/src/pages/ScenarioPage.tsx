import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SeatSelectionApp from '../components/SeatSelectionApp'
import { SubwayGrid } from '../classes/SubwayGrid'
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_NEUTRAL } from '../constants/emojis'
import { PlayerGender } from '../App'
import { trainConfigApi } from '../services/api'

export default function ScenarioPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [playerGender, setPlayerGender] = useState<PlayerGender>('neutral')
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null)
  const [selectionType, setSelectionType] = useState<'train' | 'platform' | null>(null)
  const [grid, setGrid] = useState<SubwayGrid | null>(null)
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState<number>(0)
  const [platformRecreateTrigger, setPlatformRecreateTrigger] = useState<number>(0)
  const [legendExpanded, setLegendExpanded] = useState<boolean>(false)
  const [gridAnimation, setGridAnimation] = useState<'idle' | 'slidingIn' | 'slidingOut'>('idle')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [scenarioName, setScenarioName] = useState<string | null>(null)

  // Collapse legend by default on mobile
  useEffect(() => {
    const checkMobile = () => {
      setLegendExpanded(window.innerWidth >= 768) // Expanded by default on desktop
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load scenario on mount
  useEffect(() => {
    const loadScenario = async () => {
      if (!id) {
        setError('No scenario ID provided')
        setLoading(false)
        return
      }

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
        
        // Trigger slide-in animation
        setGridAnimation('slidingIn')
        setTimeout(() => {
          setGridAnimation('idle')
        }, 600)
        
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
          {scenarioName && <h1>{scenarioName}</h1>}
          <h2>Where will you sit (or stand)?</h2>
        </div>
        <SeatSelectionApp 
          initialGrid={grid} 
          playerGender={playerGender}
          onSelectionChange={setSelectedTile}
          onSelectionTypeChange={setSelectionType}
          clearSelectionTrigger={clearSelectionTrigger}
          platformRecreateTrigger={platformRecreateTrigger}
          animationState={gridAnimation}
          showTrain={true}
        />
      </main>
      <footer className="App-footer">
        {selectionType === 'train' ? (
          <button className="clear-button" onClick={handleClearSelection}>
            Clear Selection
          </button>
        ) : null}
      </footer>
    </div>
  )
}

