import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studyApi, StudyResponse, trainConfigApi, scenarioGroupApi } from '../services/api'
import { Tile } from '../types/grid'
import { useAuth } from '../contexts/AuthContext'
import { formatRelativeTime } from '../utils/time'
import './StudyDetail.css'

export default function StudyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [study, setStudy] = useState<StudyResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [creatingScenario, setCreatingScenario] = useState<boolean>(false)
  const titleDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const descriptionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Helper function to create default grid tiles (20x5 with standard pattern)
  const createDefaultGridTiles = (): Tile[][] => {
    const height = 20
    const tiles: Tile[][] = []

    for (let row = 0; row < height; row++) {
      const rowTiles: Tile[] = []

      // Column 0: First bench column (seats in rows 0-1, 5-14, 18-19; floor in rows 2-4, 15-17)
      if (row >= 0 && row <= 1) {
        // First 2-seat bench
        rowTiles.push({ type: 'seat', occupied: false })
      } else if (row >= 2 && row <= 4) {
        // Door gap - left side (rows 2-4, column 0) - 3 tiles
        rowTiles.push({ type: 'floor', occupied: false, isDoor: true })
      } else if (row >= 5 && row <= 14) {
        // 10-seat bench
        rowTiles.push({ type: 'seat', occupied: false })
      } else if (row >= 15 && row <= 17) {
        // Door gap - left side (rows 15-17, column 0) - 3 tiles
        rowTiles.push({ type: 'floor', occupied: false, isDoor: true })
      } else if (row >= 18 && row <= 19) {
        // Last 2-seat bench
        rowTiles.push({ type: 'seat', occupied: false })
      }

      // Columns 1, 2, and 3: Aisle (all floor tiles)
      rowTiles.push({ type: 'floor', occupied: false })

      // Column 2: Middle column with stanchions (roughly every 3 rows)
      const isStanchionRow = row % 3 === 2 // Rows 2, 5, 8, 11, 14, 17 (0-indexed)
      rowTiles.push({
        type: 'floor',
        occupied: false,
        isStanchion: isStanchionRow,
      })

      rowTiles.push({ type: 'floor', occupied: false })

      // Column 4: Last bench column (seats in rows 0-1, 5-14, 18-19; floor in rows 2-4, 15-17)
      if (row >= 0 && row <= 1) {
        // First 2-seat bench
        rowTiles.push({ type: 'seat', occupied: false })
      } else if (row >= 2 && row <= 4) {
        // Door gap - right side (rows 2-4, column 4) - 3 tiles
        rowTiles.push({ type: 'floor', occupied: false, isDoor: true })
      } else if (row >= 5 && row <= 14) {
        // 10-seat bench
        rowTiles.push({ type: 'seat', occupied: false })
      } else if (row >= 15 && row <= 17) {
        // Door gap - right side (rows 15-17, column 4) - 3 tiles
        rowTiles.push({ type: 'floor', occupied: false, isDoor: true })
      } else if (row >= 18 && row <= 19) {
        // Last 2-seat bench
        rowTiles.push({ type: 'seat', occupied: false })
      }

      tiles.push(rowTiles)
    }

    return tiles
  }

  // Handle creating a new scenario
  const handleCreateScenario = async () => {
    if (!study || !study.scenario_group || creatingScenario) return

    setCreatingScenario(true)
    setError(null)

    try {
      // Create default grid tiles
      const tiles = createDefaultGridTiles()

      // Create the train configuration
      const trainConfig = await trainConfigApi.create({
        name: undefined, // No name initially
        height: 20,
        width: 5,
        tiles,
      })

      // Determine the order (append to end)
      const existingItems = study.scenario_group.items || []
      const nextOrder = existingItems.length

      // Add to scenario group
      await scenarioGroupApi.addItem(study.scenario_group.id, {
        train_configuration_id: trainConfig.id,
        order: nextOrder,
      })

      // Refresh study data to update the "last saved" indicator
      if (id) {
        try {
          const studyId = parseInt(id, 10)
          if (!isNaN(studyId)) {
            const updatedStudy = await studyApi.getById(studyId)
            setStudy(updatedStudy)
          }
        } catch (err) {
          // If refresh fails, continue with navigation - don't block the user
          console.error('Failed to refresh study data:', err)
        }
      }

      // Navigate to the scenario editor
      navigate(`/scenario-editor/${trainConfig.id}?studyId=${study.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario')
      setCreatingScenario(false)
    }
  }

  useEffect(() => {
    if (!user && !authLoading) {
      // Redirect to study builder if not authenticated
      navigate('/study-builder', { replace: true })
      return
    }

    if (user && id) {
      const loadStudy = async () => {
        setLoading(true)
        setError(null)
        try {
          const studyId = parseInt(id, 10)
          if (isNaN(studyId)) {
            throw new Error('Invalid study ID')
          }
          const data = await studyApi.getById(studyId)
          setStudy(data)
          setTitle(data.title)
          setDescription(data.description || '')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load study')
        } finally {
          setLoading(false)
        }
      }
      loadStudy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, id])

  // Debounced update function
  const debouncedUpdate = useCallback(async (updates: { title?: string; description?: string }) => {
    if (!id) return

    setSaving(true)
    try {
      const studyId = parseInt(id, 10)
      if (isNaN(studyId)) {
        throw new Error('Invalid study ID')
      }
      const updatedStudy = await studyApi.update(studyId, updates)
      setStudy(updatedStudy)
      // Update local state to match server response
      if (updates.title !== undefined) {
        setTitle(updatedStudy.title)
      }
      if (updates.description !== undefined) {
        setDescription(updatedStudy.description || '')
      }
      // Update last saved time will be handled by the useEffect that watches study.updated_at
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update study')
    } finally {
      setSaving(false)
    }
  }, [id])

  // Handle title change with debouncing
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)

    // Clear existing timer
    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current)
    }

    // Set new timer
    titleDebounceTimerRef.current = setTimeout(() => {
      debouncedUpdate({ title: newTitle })
    }, 500) // 500ms debounce
  }

  // Handle description change with debouncing
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value
    setDescription(newDescription)

    // Clear existing timer
    if (descriptionDebounceTimerRef.current) {
      clearTimeout(descriptionDebounceTimerRef.current)
    }

    // Set new timer
    descriptionDebounceTimerRef.current = setTimeout(() => {
      debouncedUpdate({ description: newDescription })
    }, 500) // 500ms debounce
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceTimerRef.current) {
        clearTimeout(titleDebounceTimerRef.current)
      }
      if (descriptionDebounceTimerRef.current) {
        clearTimeout(descriptionDebounceTimerRef.current)
      }
    }
  }, [])

  if (authLoading || loading) {
    return (
      <div className="study-detail">
        <div className="study-detail-container">
          <h1>Loading...</h1>
        </div>
      </div>
    )
  }

  if (error || !study) {
    return (
      <div className="study-detail">
        <div className="study-detail-container">
          <h1>Study Detail</h1>
          <div className="error-message">
            <p>{error || 'Study not found'}</p>
          </div>
          <button onClick={() => navigate('/study-builder')} className="back-button">
            Back to Study Builder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="study-detail">
      <div className="study-detail-container">
        <button onClick={() => navigate('/study-builder')} className="back-button">
          ← Back
        </button>
        {(saving || study.updated_at) && (
          <div className="last-saved-indicator">
            {saving ? (
              'Saving...'
            ) : study.updated_at ? (
              `Last saved ${formatRelativeTime(study.updated_at)}`
            ) : null}
          </div>
        )}
        <div className="study-header">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            className="study-title-input"
            placeholder="Study title"
          />
          {saving && <span className="saving-indicator">Saving...</span>}
        </div>
        <textarea
          value={description}
          onChange={handleDescriptionChange}
          className="study-description-input"
          placeholder="No description provided"
          rows={1}
        />
        
        {/* Scenarios Section */}
        {study.scenario_group && (
          <div className="scenarios-section">
            <h2 className="scenarios-section-title">Scenarios</h2>
            {error && (
              <div className="error-message" style={{ marginBottom: '1rem' }}>
                <p>{error}</p>
              </div>
            )}
            <div className="scenarios-grid">
              {/* Create new scenario card (first position) */}
              <div 
                className="scenario-card scenario-card-create"
                onClick={handleCreateScenario}
                style={{ 
                  opacity: creatingScenario ? 0.6 : 1, 
                  cursor: creatingScenario ? 'not-allowed' : 'pointer' 
                }}
              >
                <div className="scenario-card-content">
                  <div className="scenario-card-plus">{creatingScenario ? '...' : '+'}</div>
                  <h3>{creatingScenario ? 'Creating...' : 'Create New Scenario'}</h3>
                </div>
              </div>
              {/* Existing scenarios */}
              {study.scenario_group.items?.map((item: any) => {
                const scenario = item.train_configuration
                if (!scenario) return null
                return (
                  <div 
                    key={item.id} 
                    className="scenario-card"
                    onClick={() => navigate(`/scenario-editor/${scenario.id}?studyId=${study.id}`)}
                  >
                    <div className="scenario-card-content">
                      <h3>{scenario.name || `Scenario ${scenario.id}`}</h3>
                      <p className="scenario-card-info">
                        {scenario.height} × {scenario.width} grid
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

