import { useState, useRef, useEffect } from 'react'
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
  userSelection?: { row: number; col: number } | null
}

export default function StatisticsView({ grid, scenarioId, statistics, onStatisticsUpdate, userSelection }: StatisticsViewProps) {
  const [selectedGender, setSelectedGender] = useState<'man' | 'woman' | 'neutral' | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [tooltip, setTooltip] = useState<{
    row: number
    col: number
    x: number
    y: number
    breakdown: { man: number; woman: number; neutral: number; total: number }
  } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

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

  const handleTileClick = async (row: number, col: number, event: React.MouseEvent) => {
    const isEligible = grid.isEligibleSeat(row, col)
    if (!isEligible) {
      return
    }

    try {
      // Fetch statistics for each gender
      const [manStats, womanStats, neutralStats] = await Promise.all([
        trainConfigApi.getStatistics(scenarioId, 'man'),
        trainConfigApi.getStatistics(scenarioId, 'woman'),
        trainConfigApi.getStatistics(scenarioId, 'neutral'),
      ])

      const key = `${row},${col}`
      const breakdown = {
        man: manStats.selection_heatmap[key] || 0,
        woman: womanStats.selection_heatmap[key] || 0,
        neutral: neutralStats.selection_heatmap[key] || 0,
        total: (manStats.selection_heatmap[key] || 0) + 
               (womanStats.selection_heatmap[key] || 0) + 
               (neutralStats.selection_heatmap[key] || 0),
      }

      // Position tooltip near the click
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const tooltipX = rect.left + rect.width / 2
      const tooltipY = rect.top - 10
      
      setTooltip({
        row,
        col,
        x: tooltipX,
        y: tooltipY,
        breakdown,
      })
    } catch (err) {
      console.error('Failed to fetch gender breakdown:', err)
    }
  }

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setTooltip(null)
      }
    }

    if (tooltip) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [tooltip])
  const getResponseCount = (row: number, col: number): number => {
    const key = `${row},${col}`
    return statistics.selection_heatmap[key] || 0
  }

  // Calculate max count for normalization
  const maxCount = Math.max(
    ...Object.values(statistics.selection_heatmap),
    1 // At least 1 to avoid division by zero
  )

  // Yellow/orange/red heatmap colors - red indicates highest frequency
  const getHeatmapColor = (count: number): string => {
    if (count === 0) {
      return '#000' // Black for no responses
    }
    
    // Normalize count to 0-1 range
    const normalized = count / maxCount
    
    // Yellow/orange/red gradient - similar to the example heatmap
    // More granular ranges for smoother color transitions
    // Goes from light yellow/orange (low) to dark red/maroon (high)
    if (normalized <= 0.125) {
      return '#ffeda0' // Light yellow
    } else if (normalized <= 0.25) {
      return '#fee391' // Light yellow/orange
    } else if (normalized <= 0.375) {
      return '#fec44f' // Yellow-orange
    } else if (normalized <= 0.5) {
      return '#fe9929' // Orange
    } else if (normalized <= 0.625) {
      return '#fe7f00' // Darker orange
    } else if (normalized <= 0.75) {
      return '#ec7014' // Red-orange
    } else if (normalized <= 0.875) {
      return '#d94801' // Red
    } else {
      return '#993404' // Dark red/maroon (highest frequency)
    }
  }

  return (
    <div className="statistics-view">
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
                    const isUserSelection = userSelection && userSelection.row === rowIndex && userSelection.col === colIndex
                    
                    return (
                      <div key={`${rowIndex}-${colIndex}`} className={`statistics-tile-wrapper ${isUserSelection ? 'user-selection-tile' : ''}`}>
                        {isEligible ? (
                          <div 
                            className={`heatmap-overlay ${isUnchosen ? 'heatmap-unchosen' : ''} ${isUnchosen && isSeat ? 'heatmap-unchosen-seat' : ''} ${isUserSelection ? 'user-selection-highlight' : ''}`}
                            style={{
                              backgroundColor: heatmapColor,
                              cursor: 'pointer',
                            }}
                            onClick={(e) => handleTileClick(rowIndex, colIndex, e)}
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
              {userSelection && (() => {
                const key = `${userSelection.row},${userSelection.col}`
                const totalCount = statistics.selection_heatmap[key] || 0
                // Subtract 1 to exclude the user's own response
                const agreementCount = Math.max(0, totalCount - 1)
                return (
                  <div className="agreement-message">
                    <strong>{agreementCount} {agreementCount === 1 ? 'person' : 'people'} agreed with you</strong>
                  </div>
                )
              })()}
              <h3>Response Summary</h3>
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
              <p><strong>Total Responses:</strong> {statistics.total_responses}</p>
              <p><strong>Seat Selections:</strong> {statistics.seat_selections}</p>
              <p><strong>Floor Selections:</strong> {statistics.floor_selections}</p>
            </div>
          </div>
        </div>
      </div>
      {tooltip && (
        <div
          ref={tooltipRef}
          className="statistics-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          <div className="tooltip-header">
            <strong>Tile ({tooltip.row + 1}, {tooltip.col + 1})</strong>
          </div>
          <div className="tooltip-breakdown">
            <div className="tooltip-item">
              <span className="tooltip-emoji">{EMOJI_MAN}</span>
              <span className="tooltip-label">Man:</span>
              <span className="tooltip-value">{tooltip.breakdown.man}</span>
            </div>
            <div className="tooltip-item">
              <span className="tooltip-emoji">{EMOJI_WOMAN}</span>
              <span className="tooltip-label">Woman:</span>
              <span className="tooltip-value">{tooltip.breakdown.woman}</span>
            </div>
            <div className="tooltip-item">
              <span className="tooltip-emoji">{EMOJI_NEUTRAL}</span>
              <span className="tooltip-label">Neutral:</span>
              <span className="tooltip-value">{tooltip.breakdown.neutral}</span>
            </div>
            <div className="tooltip-item tooltip-total">
              <span className="tooltip-label">Total:</span>
              <span className="tooltip-value">{tooltip.breakdown.total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

