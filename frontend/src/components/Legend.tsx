import { useState } from 'react'
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_NEUTRAL } from '../constants/emojis'
import { PlayerGender } from '../App'

interface LegendProps {
  playerGender: PlayerGender
  onGenderChange: (gender: PlayerGender) => void
}

export default function Legend({ playerGender, onGenderChange }: LegendProps) {
  const [legendExpanded, setLegendExpanded] = useState<boolean>(false)

  return (
    <div className="legend-section">
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
                onChange={(e) => onGenderChange(e.target.value as PlayerGender)}
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
            {/* <div className="legend-item">
              <div className="legend-tile tile-legend-occupied"></div>
              <div className="legend-tile tile-legend-occupied-floor"></div>
              <span className="legend-label">Occupied</span>
            </div> */}
          </div>
        )}
      </div>
    </div>
  )
}

