import { useState, useEffect } from 'react'
import SeatSelectionApp from '../components/SeatSelectionApp'
import { createSampleGrid1 } from '../data/sampleGrids'
import { SubwayGrid } from '../classes/SubwayGrid'
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_NEUTRAL } from '../constants/emojis'
import { getRandomTrainDelay } from '../constants/train'
import { PlayerGender } from '../App'

export default function HomePage() {
  const [playerGender, setPlayerGender] = useState<PlayerGender>('neutral')
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null)
  const [selectionType, setSelectionType] = useState<'train' | 'platform' | null>(null)
  const [grid, setGrid] = useState<SubwayGrid | null>(null)
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState<number>(0)
  const [platformRecreateTrigger, setPlatformRecreateTrigger] = useState<number>(0)
  const [legendExpanded, setLegendExpanded] = useState<boolean>(false)
  const [gridAnimation, setGridAnimation] = useState<'idle' | 'slidingIn' | 'slidingOut'>('idle')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [trainArrived, setTrainArrived] = useState<boolean>(false)
  const [isTrainActive, setIsTrainActive] = useState<boolean>(false)

  // Collapse legend by default on mobile
  useEffect(() => {
    const checkMobile = () => {
      setLegendExpanded(window.innerWidth >= 768) // Expanded by default on desktop
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Initialize countdown on mount
  useEffect(() => {
    const delay = getRandomTrainDelay()
    setCountdown(delay)
    setTrainArrived(false)
    setIsTrainActive(true) // Mark train as active so countdown can trigger arrival
  }, [])

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0 && isTrainActive) {
        // Train has arrived and train is active
        setTrainArrived(true)
        if (!grid) {
          setGrid(createSampleGrid1())
        }
        setGridAnimation('slidingIn')
        // Set animation to idle after slide-in
        setTimeout(() => {
          setGridAnimation('idle')
        }, 600)
      }
      return
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, grid, isTrainActive])

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
    // Start slide-out animation if train is visible
    if (trainArrived && grid) {
      setIsTrainActive(false) // Mark train as inactive immediately
      setGridAnimation('slidingOut')
      // After animation completes, start new countdown
      setTimeout(() => {
        setGrid(null)
        setSelectedTile(null)
        setTrainArrived(false)
        setGridAnimation('idle')
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
    }
    console.log('Waiting for next train')
  }

  const handleClearSelection = () => {
    setSelectedTile(null)
    // Trigger clear in child component
    setClearSelectionTrigger(prev => prev + 1)
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
          {trainArrived && grid ? (
            <>
              <h1>Your train is here!</h1>
              <h2>Where will you sit (or stand)?</h2>
            </>
          ) : (
            <>
              <h1>Your train is arriving in {countdown ?? '...'} {countdown === 1 ? 'second' : 'seconds'}</h1>
              <h2>Where will you sit (or stand)?</h2>
            </>
          )}
        </div>
        <SeatSelectionApp 
          initialGrid={grid} 
          playerGender={playerGender}
          onSelectionChange={setSelectedTile}
          onSelectionTypeChange={setSelectionType}
          clearSelectionTrigger={clearSelectionTrigger}
          platformRecreateTrigger={platformRecreateTrigger}
          animationState={gridAnimation}
          showTrain={trainArrived && isTrainActive}
        />
      </main>
      <footer className="App-footer">
        {selectionType === 'train' ? (
          <>
            <button className="clear-button" onClick={handleClearSelection}>
              Clear Selection
            </button>
            <button className="continue-button" onClick={handleContinue}>
              Continue
            </button>
          </>
        ) : (
          <button className="continue-button" onClick={handleContinue}>
            Wait for the next train
          </button>
        )}
      </footer>
    </div>
  )
}

