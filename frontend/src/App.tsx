import { useState } from 'react'
import './App.css'
import SeatSelectionApp from './components/SeatSelectionApp'
import { sampleGrid } from './data/sampleGrids'
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_NEUTRAL } from './constants/emojis'

export type PlayerGender = 'man' | 'woman' | 'neutral'

function App() {
  const [playerGender, setPlayerGender] = useState<PlayerGender>('neutral')

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <h1>Your train is here!</h1>
        </div>
        <p>Time to find your seat.</p>
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
            <div className="legend-tile tile-legend-eligible"></div>
            <span className="legend-label">Available Seat</span>
          </div>
          <div className="legend-item">
            <div className="legend-tile tile-legend-door"></div>
            <span className="legend-label">Door</span>
          </div>
        </div>
      </header>
      <main className="App-main">
        <SeatSelectionApp initialGrid={sampleGrid} playerGender={playerGender} />
      </main>
    </div>
  )
}

export default App

