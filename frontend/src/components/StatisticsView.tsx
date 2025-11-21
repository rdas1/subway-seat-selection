import { useState, useRef, useEffect, useMemo } from 'react'
import { SubwayGrid } from '../classes/SubwayGrid'
import { trainConfigApi, PostResponseQuestionResponse, QuestionResponseCreate, QuestionTagResponse, TagStatisticsResponse } from '../services/api'
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
  userResponseId?: number
  onQuestionResponsesChange?: (responses: QuestionResponseCreate[]) => void
  onValidationChange?: (isValid: boolean) => void
}

export default function StatisticsView({ grid, scenarioId, statistics, onStatisticsUpdate, userSelection, userResponseId, onQuestionResponsesChange, onValidationChange }: StatisticsViewProps) {
  const [selectedGender, setSelectedGender] = useState<'man' | 'woman' | 'neutral' | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<PostResponseQuestionResponse[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questionResponses, setQuestionResponses] = useState<Map<number, { freeText: string; selectedTagIds: number[] }>>(new Map())
  const [tagStatistics, setTagStatistics] = useState<Map<number, Map<number, number>>>(new Map()) // questionId -> tagId -> count
  const [tooltip, setTooltip] = useState<{
    row: number
    col: number
    x: number
    y: number
    breakdown: { man: number; woman: number; neutral: number; total: number }
    totals: { man: number; woman: number; neutral: number; all: number }
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
      const totals = {
        man: manStats.total_responses,
        woman: womanStats.total_responses,
        neutral: neutralStats.total_responses,
        all: manStats.total_responses + womanStats.total_responses + neutralStats.total_responses,
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
        totals,
      })
    } catch (err) {
      console.error('Failed to fetch gender breakdown:', err)
    }
  }

  // Load questions for the scenario
  useEffect(() => {
    const loadQuestions = async () => {
      setLoadingQuestions(true)
      try {
        const questionsData = await trainConfigApi.getQuestionsForResponse(scenarioId)
        setQuestions(questionsData)
        // Initialize question responses
        const initialResponses = new Map<number, { freeText: string; selectedTagIds: number[] }>()
        questionsData.forEach(q => {
          initialResponses.set(q.id, { freeText: '', selectedTagIds: [] })
        })
        setQuestionResponses(initialResponses)
        
        // Load tag statistics for each question
        const statsMap = new Map<number, Map<number, number>>()
        for (const question of questionsData) {
          try {
            const stats = await trainConfigApi.getTagStatistics(scenarioId, question.id)
            const tagCountMap = new Map<number, number>()
            stats.forEach(stat => {
              tagCountMap.set(stat.tag_id, stat.selection_count)
            })
            statsMap.set(question.id, tagCountMap)
          } catch (err) {
            console.error(`Failed to load tag statistics for question ${question.id}:`, err)
            statsMap.set(question.id, new Map())
          }
        }
        setTagStatistics(statsMap)
      } catch (err) {
        console.error('Failed to load questions:', err)
      } finally {
        setLoadingQuestions(false)
      }
    }
    loadQuestions()
  }, [scenarioId])

  // Check if all required questions are answered (memoized)
  const areRequiredQuestionsAnswered = useMemo(() => {
    for (const question of questions) {
      if (question.is_required) {
        const response = questionResponses.get(question.id)
        if (!response) return false
        
        // Check if free text is required and provided
        if (question.free_text_required && (!response.freeText || !response.freeText.trim())) {
          return false
        }
      }
    }
    return true
  }, [questions, questionResponses])

  // Update parent when question responses change
  useEffect(() => {
    if (onQuestionResponsesChange) {
      const responses: QuestionResponseCreate[] = Array.from(questionResponses.entries()).map(([questionId, response]) => ({
        post_response_question_id: questionId,
        free_text_response: response.freeText || undefined,
        selected_tag_ids: response.selectedTagIds
      }))
      onQuestionResponsesChange(responses)
    }
  }, [questionResponses, onQuestionResponsesChange])

  // Update validation state when it changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(areRequiredQuestionsAnswered)
    }
  }, [areRequiredQuestionsAnswered, onValidationChange])

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

  // Helper function to interpolate between two hex colors
  const interpolateColor = (color1: string, color2: string, factor: number): string => {
    // Convert hex to RGB
    const hex1 = color1.replace('#', '')
    const hex2 = color2.replace('#', '')
    const r1 = parseInt(hex1.substring(0, 2), 16)
    const g1 = parseInt(hex1.substring(2, 4), 16)
    const b1 = parseInt(hex1.substring(4, 6), 16)
    const r2 = parseInt(hex2.substring(0, 2), 16)
    const g2 = parseInt(hex2.substring(2, 4), 16)
    const b2 = parseInt(hex2.substring(4, 6), 16)
    
    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * factor)
    const g = Math.round(g1 + (g2 - g1) * factor)
    const b = Math.round(b1 + (b2 - b1) * factor)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Get heatmap color based on absolute percentage (0-100%)
  // Colors are constant regardless of data distribution
  const getHeatmapColor = (count: number): string => {
    if (count === 0 || statistics.total_responses === 0) {
      return '#000' // Black for no responses
    }
    
    // Calculate absolute percentage of total responses (0-100%)
    const percentage = (count / statistics.total_responses) * 100
    
    // Define gradient stops with more granular colors, especially in 50-100% range
    // These colors are absolute - 50% always looks the same, 100% always looks the same
    const gradientStops = [
      { percent: 0, color: '#ffeda0' },    // Light yellow (0%)
      { percent: 5, color: '#fee391' },    // Light yellow/orange (5%)
      { percent: 10, color: '#fec44f' },   // Yellow-orange (10%)
      { percent: 15, color: '#fe9929' },  // Orange (15%)
      { percent: 20, color: '#fe7f00' },  // Darker orange (20%)
      { percent: 25, color: '#f97316' },  // Orange-red (25%)
      { percent: 30, color: '#ec7014' },  // Red-orange (30%)
      { percent: 35, color: '#dc2626' },  // Red (35%)
      { percent: 40, color: '#d94801' },  // Dark red (40%)
      { percent: 45, color: '#b91c1c' }, // Darker red (45%)
      { percent: 50, color: '#991b1b' }, // Very dark red (50%)
      { percent: 55, color: '#7f1d1d' }, // Darker (55%)
      { percent: 60, color: '#6b1d1d' }, // Darker (60%)
      { percent: 65, color: '#5a1a1a' }, // Darker (65%)
      { percent: 70, color: '#4a1818' }, // Darker (70%)
      { percent: 75, color: '#3d1515' }, // Darker (75%)
      { percent: 80, color: '#331212' }, // Darker (80%)
      { percent: 85, color: '#2a0f0f' }, // Darker (85%)
      { percent: 90, color: '#4a1a3a' }, // Dark red transitioning to purple (90%)
      { percent: 95, color: '#6b2a5a' }, // Dark purple (95%)
      { percent: 100, color: '#8b3a7a' }, // Purple (100%)
    ]
    
    // Find the two stops to interpolate between
    for (let i = 0; i < gradientStops.length - 1; i++) {
      const stop1 = gradientStops[i]
      const stop2 = gradientStops[i + 1]
      
      if (percentage <= stop2.percent) {
        // Interpolate between stop1 and stop2
        const range = stop2.percent - stop1.percent
        const factor = range > 0 ? (percentage - stop1.percent) / range : 0
        return interpolateColor(stop1.color, stop2.color, factor)
      }
    }
    
    // If percentage is above all stops, use the last color
    return gradientStops[gradientStops.length - 1].color
  }

  // Get percentage for a tile
  const getPercentage = (row: number, col: number): number => {
    const count = getResponseCount(row, col)
    if (statistics.total_responses === 0) return 0
    return (count / statistics.total_responses) * 100
  }

  // Format percentage to show decimals only when needed
  const formatPercentage = (value: number): string => {
    const rounded = Math.round(value * 10) / 10
    if (rounded % 1 === 0) {
      return rounded.toString()
    }
    return rounded.toFixed(1)
  }

  // Handle question response changes
  const handleQuestionFreeTextChange = (questionId: number, value: string) => {
    const updated = new Map(questionResponses)
    const current = updated.get(questionId) || { freeText: '', selectedTagIds: [] }
    updated.set(questionId, { ...current, freeText: value })
    setQuestionResponses(updated)
  }

  const handleQuestionTagToggle = (questionId: number, tagId: number) => {
    const updated = new Map(questionResponses)
    const current = updated.get(questionId) || { freeText: '', selectedTagIds: [] }
    const wasSelected = current.selectedTagIds.includes(tagId)
    const tagIds = wasSelected
      ? current.selectedTagIds.filter(id => id !== tagId)
      : [...current.selectedTagIds, tagId]
    updated.set(questionId, { ...current, selectedTagIds: tagIds })
    setQuestionResponses(updated)
    
    // Update tag statistics in real-time
    const updatedStats = new Map(tagStatistics)
    const questionStats = updatedStats.get(questionId) || new Map<number, number>()
    const currentCount = questionStats.get(tagId) || 0
    const newCount = wasSelected ? Math.max(0, currentCount - 1) : currentCount + 1
    questionStats.set(tagId, newCount)
    updatedStats.set(questionId, questionStats)
    setTagStatistics(updatedStats)
  }

  return (
    <div className="statistics-view">
      <div className="seat-selection-app">
        <div className="grids-container">
          {/* Train grid with heatmap on the left */}
          <div className="statistics-grid-wrapper">
            {/* Heatmap Legend - moved above the heatmap */}
            <div className="heatmap-legend heatmap-legend-above">
              <h4>Selection Frequency</h4>
              <div className="heatmap-gradient-bar">
                <div className="heatmap-gradient-start-indicator"></div>
                <div
                  className="heatmap-gradient-fill"
                  style={{
                    background: 'linear-gradient(to right, #ffeda0 0%, #fee391 5%, #fec44f 10%, #fe9929 15%, #fe7f00 20%, #f97316 25%, #ec7014 30%, #dc2626 35%, #d94801 40%, #b91c1c 45%, #991b1b 50%, #7f1d1d 55%, #6b1d1d 60%, #5a1a1a 65%, #4a1818 70%, #3d1515 75%, #331212 80%, #2a0f0f 85%, #4a1a3a 90%, #6b2a5a 95%, #8b3a7a 100%)'
                  }}
                />
              </div>
              <div className="heatmap-legend-labels">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
              <p className="heatmap-legend-note">Color intensity represents absolute percentage of users who selected each tile</p>
            </div>
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
                    const isDoor = tile.isDoor === true
                    const isDoorLeft = isDoor && colIndex === 0
                    const isDoorRight = isDoor && colIndex === grid.width - 1
                    
                    return (
                      <div key={`${rowIndex}-${colIndex}`} className={`statistics-tile-wrapper ${isUserSelection ? 'user-selection-tile' : ''}`}>
                        {isEligible ? (
                          <div 
                            className={`heatmap-overlay ${isUnchosen ? 'heatmap-unchosen' : ''} ${isUnchosen && isSeat ? 'heatmap-unchosen-seat' : ''} ${isUserSelection ? 'user-selection-highlight' : ''} ${isDoor ? 'heatmap-door' : ''} ${isDoorLeft ? 'heatmap-door-left' : ''} ${isDoorRight ? 'heatmap-door-right' : ''}`}
                            style={{
                              backgroundColor: heatmapColor,
                              cursor: 'pointer',
                            }}
                            onClick={(e) => handleTileClick(rowIndex, colIndex, e)}
                            title={`${responseCount} ${responseCount === 1 ? 'response' : 'responses'} (${formatPercentage(getPercentage(rowIndex, colIndex))}%)`}
                          >
                            <span className="response-count-text">{formatPercentage(getPercentage(rowIndex, colIndex))}%</span>
                          </div>
                        ) : (
                          <div 
                            className={`heatmap-overlay heatmap-ineligible ${isDoor ? 'heatmap-door' : ''} ${isDoorLeft ? 'heatmap-door-left' : ''} ${isDoorRight ? 'heatmap-door-right' : ''}`}
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
                // Calculate percentage of other respondents (excluding user) who made the same choice
                const otherRespondents = Math.max(0, statistics.total_responses - 1)
                const percentage = otherRespondents > 0 
                  ? (agreementCount / otherRespondents) * 100 
                  : 0
                const formattedPercentage = formatPercentage(percentage)
                return (
                  <div className="agreement-message">
                    {agreementCount === 0 && otherRespondents > 0 && <strong>Hot take! </strong>}
                    <strong>{formattedPercentage}% of respondents chose the same spot as you.</strong>
                    {otherRespondents === 0 && <strong> (You're the first respondent!)</strong>}
                  </div>
                )
              })()}

              {/* Questions Section */}
              {questions.length > 0 && (
                <div className="questions-response-section">
                  {questions.map((question) => {
                    const response = questionResponses.get(question.id) || { freeText: '', selectedTagIds: [] }
                    const isRequired = question.is_required
                    const isFreeTextRequired = question.free_text_required
                    const isFreeTextValid = !isFreeTextRequired || (response.freeText && response.freeText.trim().length > 0)
                    const isValid = !isRequired || (isFreeTextValid)
                    
                    return (
                      <div key={question.id} className={`question-response-item ${!isValid ? 'question-invalid' : ''}`}>
                        <label className="question-label">
                          {question.question.question_text}
                          {isRequired && <span className="required-indicator"> *</span>}
                        </label>
                        {question.question.allows_tags && question.tags.length > 0 && (
                          <div className="question-tags-selection">
                            <div className="tags-selection-grid">
                              {question.tags.map((tag) => {
                                const tagCount = tagStatistics.get(question.id)?.get(tag.id) || 0
                                const allowsMultiple = question.question.allows_multiple_tags ?? true
                                return (
                                  <label key={tag.id} className={allowsMultiple ? "tag-selection-checkbox" : "tag-selection-radio"}>
                                    <input
                                      type={allowsMultiple ? "checkbox" : "radio"}
                                      name={`question-${question.id}`}
                                      checked={response.selectedTagIds.includes(tag.id)}
                                      onChange={() => handleQuestionTagToggle(question.id, tag.id)}
                                    />
                                    <span>
                                      {tag.tag_text}
                                      {tagCount > 0 && (
                                        <span className="tag-count"> ({tagCount})</span>
                                      )}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {question.question.allows_free_text && (
                          <textarea
                            value={response.freeText}
                            onChange={(e) => handleQuestionFreeTextChange(question.id, e.target.value)}
                            placeholder={isFreeTextRequired ? "This field is required" : "Optional free text response"}
                            className="question-free-text"
                            rows={3}
                            required={isFreeTextRequired}
                          />
                        )}
                        {!isValid && (
                          <p className="question-error-message">
                            {isFreeTextRequired && (!response.freeText || !response.freeText.trim()) 
                              ? 'Free text response is required'
                              : 'This question is required'}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

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
            {tooltip.totals.all > 0 && (
              <span className="tooltip-percentage">
                {formatPercentage((tooltip.breakdown.total / tooltip.totals.all) * 100)}%
              </span>
            )}
          </div>
          <div className="tooltip-breakdown">
            <div className="tooltip-item">
              <span className="tooltip-emoji">{EMOJI_MAN}</span>
              <span className="tooltip-label">Man:</span>
              <span className="tooltip-value">
                {tooltip.totals.man > 0 
                  ? `${formatPercentage((tooltip.breakdown.man / tooltip.totals.man) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="tooltip-item">
              <span className="tooltip-emoji">{EMOJI_WOMAN}</span>
              <span className="tooltip-label">Woman:</span>
              <span className="tooltip-value">
                {tooltip.totals.woman > 0 
                  ? `${formatPercentage((tooltip.breakdown.woman / tooltip.totals.woman) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="tooltip-item">
              <span className="tooltip-emoji">{EMOJI_NEUTRAL}</span>
              <span className="tooltip-label">Neutral:</span>
              <span className="tooltip-value">
                {tooltip.totals.neutral > 0 
                  ? `${formatPercentage((tooltip.breakdown.neutral / tooltip.totals.neutral) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="tooltip-item tooltip-total">
              <span className="tooltip-label">Total:</span>
              <span className="tooltip-value">
                {tooltip.totals.all > 0 
                  ? `${formatPercentage((tooltip.breakdown.total / tooltip.totals.all) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

