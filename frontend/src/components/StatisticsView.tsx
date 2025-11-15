import { useState } from 'react'
import { SubwayGrid } from '../classes/SubwayGrid'
import { trainConfigApi } from '../services/api'
import { EMOJI_MAN, EMOJI_WOMAN, EMOJI_NEUTRAL } from '../constants/emojis'
import Grid from './Grid'
import './StatisticsView.css'
import './Grid.css'
import '../App.css'

interface StatisticsViewProps {
  grid: SubwayGrid
  scenarioId: number
  statistics: {
    total_responses: number
    seat_selections: number
    floor_selections: number
    selection_heatmap: Record<string, number>
  }
  onStatisticsUpdate: (stats: StatisticsViewProps['statistics']) => void
}

export default function StatisticsView({ grid, scenarioId, statistics, onStatisticsUpdate }: StatisticsViewProps) {
  const [selectedGender, setSelectedGender] = useState<'man' | 'woman' | 'neutral' | 'all'>('all')
  const [loading, setLoading] = useState(false)

  const handleGenderChange = async (gender: 'man' | 'woman' | 'neutral' | 'all') => {
    setSelectedGender(gender)
    setLoading(true)
    try {
      const stats = await trainConfigApi.getStatistics(scenarioId, gender === 'all' ? undefined : gender)
      onStatisticsUpdate(stats)
    } catch (err) {
      console.error('Failed to fetch filtered statistics:', err)
    } finally {
      setLoading(false)
    }
  }
  const getResponseCount = (row: number, col: number): number => {
    const key = `${row},${col}`
    return statistics.selection_heatmap[key] || 0
  }

  // Calculate max count for normalization
  const maxCount = Math.max(
    ...Object.values(statistics.selection_heatmap),
    1 // At least 1 to avoid division by zero
  )

  // Bright green heatmap colors - brighter for popular choices
  const getHeatmapColor = (count: number): string => {
    if (count === 0) {
      return '#000' // Black for no responses
    }
    
    // Normalize count to 0-1 range
    const normalized = count / maxCount
    
    // Bright green gradient - using more vibrant, saturated greens
    // Popular choices should be bright and clearly visible
    if (normalized <= 0.2) {
      return '#9be9a8' // Light green
    } else if (normalized <= 0.4) {
      return '#40c463' // Medium green
    } else if (normalized <= 0.6) {
      return '#26a641' // Brighter medium-green
    } else if (normalized <= 0.8) {
      return '#0e7a2e' // Bright dark green
    } else {
      return '#0d5d1f' // Brightest dark green (still vibrant, not muted)
    }
  }

  return (
    <div className="statistics-view">
      <div className="statistics-filters">
        <label htmlFor="gender-filter" className="filter-label">
          Filter by Gender:
        </label>
        <select
          id="gender-filter"
          value={selectedGender}
          onChange={(e) => handleGenderChange(e.target.value as 'man' | 'woman' | 'neutral' | 'all')}
          disabled={loading}
          className="gender-filter-select"
        >
          <option value="all">All</option>
          <option value="man">{EMOJI_MAN} Man</option>
          <option value="woman">{EMOJI_WOMAN} Woman</option>
          <option value="neutral">{EMOJI_NEUTRAL} Neutral</option>
        </select>
        {loading && <span className="loading-indicator">Loading...</span>}
      </div>
      <div className="seat-selection-app">
        <div className="grids-container">
          {/* Train grid with heatmap on the left */}
          <div className="statistics-grid-wrapper">
            <div className="statistics-grid-container">
              <Grid
                grid={grid}
                onTileClick={() => {}} // No-op for statistics view
                selectedTile={null}
                playerGender="neutral"
                doorsOpen={false}
                animationState="idle"
              />
              {/* Heatmap overlays positioned over the grid */}
              <div 
                className="statistics-heatmap-overlays"
                style={{
                  gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
                  gridTemplateRows: `repeat(${grid.height}, 1fr)`,
                }}
              >
                {grid.tiles.map((row, rowIndex) =>
                  row.map((tile, colIndex) => {
                    const isEligible = grid.isEligibleSeat(rowIndex, colIndex)
                    const responseCount = getResponseCount(rowIndex, colIndex)
                    const isSeat = tile.type === 'seat'
                    const isUnchosen = isEligible && responseCount === 0
                    const heatmapColor = isEligible ? getHeatmapColor(responseCount) : undefined
                    
                    return (
                      <div key={`${rowIndex}-${colIndex}`} className="statistics-tile-wrapper">
                        {isEligible ? (
                          <div 
                            className={`heatmap-overlay ${isUnchosen ? 'heatmap-unchosen' : ''} ${isUnchosen && isSeat ? 'heatmap-unchosen-seat' : ''}`}
                            style={{
                              backgroundColor: heatmapColor,
                            }}
                            title={`${responseCount} ${responseCount === 1 ? 'response' : 'responses'}`}
                          >
                            <span className="response-count-text">{responseCount}</span>
                          </div>
                        ) : (
                          <div 
                            className="heatmap-overlay heatmap-ineligible"
                            title="Not an eligible choice"
                          />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Statistics text on the right (where platform was) */}
          <div className="statistics-panel">
            <div className="statistics-summary">
              <h3>Response Summary</h3>
              <p><strong>Total Responses:</strong> {statistics.total_responses}</p>
              <p><strong>Seat Selections:</strong> {statistics.seat_selections}</p>
              <p><strong>Floor Selections:</strong> {statistics.floor_selections}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

