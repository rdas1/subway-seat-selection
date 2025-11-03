import { useState, useEffect } from 'react'
import './App.css'
import SeatSelectionApp from './components/SeatSelectionApp'
import { createSampleGrid1 } from './data/sampleGrids'
import { SubwayGrid } from './classes/SubwayGrid'
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_NEUTRAL } from './constants/emojis'

export type PlayerGender = 'man' | 'woman' | 'neutral'

function App() {
  const [playerGender, setPlayerGender] = useState<PlayerGender>('neutral')
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null)
  const [grid, setGrid] = useState<SubwayGrid>(createSampleGrid1())
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState<number>(0)
  const [legendExpanded, setLegendExpanded] = useState<boolean>(false)
  const [gridAnimation, setGridAnimation] = useState<'idle' | 'slidingIn' | 'slidingOut'>('slidingIn')

  // Collapse legend by default on mobile
  useEffect(() => {
    const checkMobile = () => {
      setLegendExpanded(window.innerWidth >= 768) // Expanded by default on desktop
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Set animation to idle after initial slide-in
  useEffect(() => {
    const timer = setTimeout(() => {
      if (gridAnimation === 'slidingIn') {
        setGridAnimation('idle')
      }
    }, 600) // Match animation duration
    return () => clearTimeout(timer)
  }, [gridAnimation])

  const handleContinue = () => {
    if (selectedTile) {
      // Start slide-out animation
      setGridAnimation('slidingOut')
      // After animation completes, generate new grid and slide in
      setTimeout(() => {
        setGrid(createSampleGrid1())
        setSelectedTile(null)
        setGridAnimation('slidingIn')
        // After slide-in completes, set back to idle
        setTimeout(() => {
          setGridAnimation('idle')
        }, 600) // Match animation duration
      }, 600) // Match animation duration
      console.log('Generated new grid')
    }
  }

  const handleClearSelection = () => {
    setSelectedTile(null)
    // Trigger clear in child component
    setClearSelectionTrigger(prev => prev + 1)
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <h1>Your train is here!</h1>
        </div>
        <div className="subtitle-row">
          <p>Time to find your seat.</p>
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
              <option value="neutral">{EMOJI_NEUTRAL} Neutral</option>
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
        <SeatSelectionApp 
          initialGrid={grid} 
          playerGender={playerGender}
          onSelectionChange={setSelectedTile}
          clearSelectionTrigger={clearSelectionTrigger}
          animationState={gridAnimation}
        />
      </main>
      {selectedTile && (
        <footer className="App-footer">
          <button className="clear-button" onClick={handleClearSelection}>
            Clear Selection
          </button>
          <button className="continue-button" onClick={handleContinue}>
            Continue
          </button>
        </footer>
      )}
    </div>
  )
}

export default App

