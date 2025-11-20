import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studyApi, StudyResponse, trainConfigApi, scenarioGroupApi, PostResponseQuestionResponse, PostResponseQuestionCreate, questionApi, TagLibraryResponse } from '../services/api'
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
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [questions, setQuestions] = useState<Map<number, PostResponseQuestionResponse[]>>(new Map())
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false)
  const [editingQuestion, setEditingQuestion] = useState<{ scenarioId: number; question: PostResponseQuestionResponse } | null>(null)
  const [showTagLibrary, setShowTagLibrary] = useState<boolean>(false)
  const [tagLibrary, setTagLibrary] = useState<TagLibraryResponse | null>(null)
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

  // Handle deleting a scenario
  const handleDeleteScenario = async (itemId: number, scenarioName: string) => {
    if (!study || !study.scenario_group) return
    
    setDeleteConfirmItem({ id: itemId, name: scenarioName })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmItem || !study || !study.scenario_group) return

    setDeleting(true)
    setError(null)

    try {
      await scenarioGroupApi.deleteItem(study.scenario_group.id, deleteConfirmItem.id)
      
      // Refresh study data
      if (id) {
        try {
          const studyId = parseInt(id, 10)
          if (!isNaN(studyId)) {
            const updatedStudy = await studyApi.getById(studyId)
            setStudy(updatedStudy)
          }
        } catch (err) {
          console.error('Failed to refresh study data:', err)
          setError(err instanceof Error ? err.message : 'Failed to refresh study')
        }
      }
      
      setDeleteConfirmItem(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmItem(null)
  }

  // Question management handlers
  const handleCreateQuestion = async (scenarioId: number) => {
    const newQuestion: PostResponseQuestionCreate = {
      question_text: '',
      is_required: false,
      free_text_required: false,
      allows_free_text: true,
      allows_tags: true,
      order: (questions.get(scenarioId)?.length || 0),
      tag_ids: []
    }
    
    try {
      const created = await trainConfigApi.createQuestion(scenarioId, newQuestion)
      const updatedMap = new Map(questions)
      const scenarioQuestions = updatedMap.get(scenarioId) || []
      updatedMap.set(scenarioId, [...scenarioQuestions, created])
      setQuestions(updatedMap)
      setEditingQuestion({ scenarioId, question: created })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question')
    }
  }

  const handleUpdateQuestion = async (scenarioId: number, questionId: number, updates: Partial<PostResponseQuestionCreate>) => {
    const question = questions.get(scenarioId)?.find(q => q.id === questionId)
    if (!question) return
    
    const updateData: PostResponseQuestionCreate = {
      question_text: question.is_default ? undefined : (updates.question_text ?? question.question.question_text),
      is_required: updates.is_required ?? question.is_required,
      free_text_required: updates.free_text_required ?? question.free_text_required,
      allows_free_text: updates.allows_free_text ?? question.question.allows_free_text,
      allows_tags: updates.allows_tags ?? question.question.allows_tags,
      order: updates.order ?? question.order,
      tag_ids: updates.tag_ids ?? question.tags.map(t => t.id)
    }
    
    try {
      const updated = await trainConfigApi.updateQuestion(scenarioId, questionId, updateData)
      const updatedMap = new Map(questions)
      const scenarioQuestions = updatedMap.get(scenarioId) || []
      updatedMap.set(scenarioId, scenarioQuestions.map(q => q.id === questionId ? updated : q))
      setQuestions(updatedMap)
      setEditingQuestion(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update question')
    }
  }

  const handleDeleteQuestion = async (scenarioId: number, questionId: number) => {
    try {
      await trainConfigApi.deleteQuestion(scenarioId, questionId)
      const updatedMap = new Map(questions)
      const scenarioQuestions = updatedMap.get(scenarioId) || []
      updatedMap.set(scenarioId, scenarioQuestions.filter(q => q.id !== questionId))
      setQuestions(updatedMap)
      if (editingQuestion?.question.id === questionId) {
        setEditingQuestion(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question')
    }
  }

  const handleAddTagsToQuestion = async (scenarioId: number, questionId: number, selectedTagIds: number[]) => {
    const question = questions.get(scenarioId)?.find(q => q.id === questionId)
    if (!question) return
    
    const currentTagIds = question.tags.map(t => t.id)
    const newTagIds = [...new Set([...currentTagIds, ...selectedTagIds])]
    
    await handleUpdateQuestion(scenarioId, questionId, { tag_ids: newTagIds })
    setShowTagLibrary(false)
  }

  const handleCreateNewTag = async (tagText: string) => {
    try {
      const newTag = await questionApi.createTag({ tag_text: tagText })
      // Refresh tag library
      const library = await questionApi.getTagLibrary()
      setTagLibrary(library)
      return newTag
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag')
      throw err
    }
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

  // Load questions for all scenarios in the study
  useEffect(() => {
    if (study?.scenario_group?.items) {
      const loadAllQuestions = async () => {
        setLoadingQuestions(true)
        const questionsMap = new Map<number, PostResponseQuestionResponse[]>()
        
        for (const item of study.scenario_group.items) {
          if (item.train_configuration) {
            try {
              const scenarioQuestions = await trainConfigApi.getQuestions(item.train_configuration.id)
              questionsMap.set(item.train_configuration.id, scenarioQuestions)
            } catch (err) {
              console.error(`Failed to load questions for scenario ${item.train_configuration.id}:`, err)
            }
          }
        }
        
        setQuestions(questionsMap)
        setLoadingQuestions(false)
      }
      loadAllQuestions()
    } else {
      setQuestions(new Map())
    }
  }, [study?.scenario_group?.items])

  // Load tag library when needed
  useEffect(() => {
    if (showTagLibrary && !tagLibrary) {
      const loadTagLibrary = async () => {
        try {
          const library = await questionApi.getTagLibrary()
          setTagLibrary(library)
        } catch (err) {
          console.error('Failed to load tag library:', err)
        }
      }
      loadTagLibrary()
    }
  }, [showTagLibrary, tagLibrary])

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
                const scenarioName = scenario.name || `Scenario ${scenario.id}`
                return (
                  <div 
                    key={item.id} 
                    className="scenario-card"
                    onClick={() => navigate(`/scenario-editor/${scenario.id}?studyId=${study.id}`)}
                  >
                    <button
                      className="scenario-card-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteScenario(item.id, scenarioName)
                      }}
                      aria-label="Delete scenario"
                    >
                      ×
                    </button>
                    <div className="scenario-card-content">
                      <h3>{scenarioName}</h3>
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

        {/* Questions Section */}
        <div className="study-questions-section">
          <h2 className="study-questions-section-title">Questions asked after each scenario</h2>
          {loadingQuestions ? (
            <p>Loading questions...</p>
          ) : study.scenario_group?.items && study.scenario_group.items.length > 0 ? (
            <div className="study-questions-content">
              {Array.from(questions.entries()).map(([scenarioId, scenarioQuestions]) => {
                const scenarioItem = study.scenario_group?.items?.find(
                  (item: any) => item.train_configuration?.id === scenarioId
                )
                const scenarioName = scenarioItem?.train_configuration?.name || 
                                   `Scenario ${scenarioItem?.train_configuration?.id || scenarioId}`
                
                return (
                  <div key={scenarioId} className="scenario-questions-group">
                    <h3 className="scenario-questions-group-title">{scenarioName}</h3>
                    <div className="questions-list">
                      {scenarioQuestions.map((question) => (
                        <div key={question.id} className="question-card">
                          <div className="question-card-header">
                            <h4>{question.question.question_text}</h4>
                            {question.is_default && <span className="default-badge">Default</span>}
                            {question.is_required && <span className="required-badge">Required</span>}
                          </div>
                          <div className="question-card-content">
                            <div className="question-info">
                              <span>Tags: {question.tags.length}</span>
                              {question.question.allows_free_text && <span>Free text allowed</span>}
                            </div>
                            <div className="question-actions">
                              <button
                                onClick={() => setEditingQuestion({ scenarioId, question })}
                                className="edit-question-button"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(scenarioId, question.id)}
                                className="delete-question-button"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleCreateQuestion(scenarioId)}
                      className="create-question-button"
                    >
                      + Create Question
                    </button>
                  </div>
                )
              })}
              {questions.size === 0 && (
                <p className="no-questions-message">No questions yet. Create questions for scenarios above.</p>
              )}
            </div>
          ) : (
            <p className="no-scenarios-message">Add scenarios to create questions.</p>
          )}
        </div>
      </div>
      {/* Delete Confirmation Dialog */}
      {deleteConfirmItem && (
        <div className="delete-confirm-overlay" onClick={cancelDelete}>
          <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Scenario?</h3>
            <p>Are you sure you want to delete "{deleteConfirmItem.name}"? This action cannot be undone.</p>
            <div className="delete-confirm-buttons">
              <button 
                className="delete-confirm-cancel"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="delete-confirm-delete"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Library Modal */}
      {showTagLibrary && editingQuestion && tagLibrary && (
        <div className="tag-library-overlay" onClick={() => setShowTagLibrary(false)}>
          <div className="tag-library-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tag-library-header">
              <h3>Add Tags</h3>
              <button onClick={() => setShowTagLibrary(false)} className="close-modal">×</button>
            </div>
            <StudyTagLibraryModal
              library={tagLibrary}
              currentTagIds={editingQuestion.question.tags.map(t => t.id)}
              onSelectTags={(tagIds) => handleAddTagsToQuestion(editingQuestion.scenarioId, editingQuestion.question.id, tagIds)}
              onCreateTag={handleCreateNewTag}
              onClose={() => setShowTagLibrary(false)}
            />
          </div>
        </div>
      )}

      {/* Question Editor Modal */}
      {editingQuestion && !showTagLibrary && (
        <div className="question-editor-overlay" onClick={() => setEditingQuestion(null)}>
          <div className="question-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="question-editor-header">
              <h3>Edit Question</h3>
              <button onClick={() => setEditingQuestion(null)} className="close-modal">×</button>
            </div>
            <StudyQuestionEditor
              question={editingQuestion.question}
              isInStudy={true}
              onSave={(updates) => handleUpdateQuestion(editingQuestion.scenarioId, editingQuestion.question.id, updates)}
              onCancel={() => setEditingQuestion(null)}
              onAddTags={() => setShowTagLibrary(true)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Tag Library Modal Component for Study Detail
function StudyTagLibraryModal({ 
  library, 
  currentTagIds, 
  onSelectTags, 
  onCreateTag,
  onClose 
}: { 
  library: TagLibraryResponse;
  currentTagIds: number[];
  onSelectTags: (tagIds: number[]) => void;
  onCreateTag: (tagText: string) => Promise<any>;
  onClose: () => void;
}) {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set(currentTagIds));
  const [newTagText, setNewTagText] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  const toggleTag = (tagId: number) => {
    const newSet = new Set(selectedTagIds);
    if (newSet.has(tagId)) {
      newSet.delete(tagId);
    } else {
      newSet.add(tagId);
    }
    setSelectedTagIds(newSet);
  };

  const handleCreateTag = async () => {
    if (!newTagText.trim()) return;
    setCreatingTag(true);
    try {
      const newTag = await onCreateTag(newTagText.trim());
      setSelectedTagIds(new Set([...selectedTagIds, newTag.id]));
      setNewTagText('');
    } catch (err) {
      // Error handled by parent
    } finally {
      setCreatingTag(false);
    }
  };

  const handleAddSelected = () => {
    onSelectTags(Array.from(selectedTagIds));
  };

  return (
    <div className="tag-library-content">
      <div className="tag-library-sections">
        <div className="tag-section">
          <h4>Default Tags</h4>
          <div className="tags-grid">
            {library.default_tags.map((tag) => (
              <label key={tag.id} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTagIds.has(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
                <span>{tag.tag_text}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="tag-section">
          <h4>Your Tags</h4>
          <div className="tags-grid">
            {library.your_tags.map((tag) => (
              <label key={tag.id} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTagIds.has(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
                <span>{tag.tag_text}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="tag-section">
          <h4>Community Tags</h4>
          <div className="tags-grid">
            {library.community_tags.map((tag) => (
              <label key={tag.id} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTagIds.has(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
                <span>{tag.tag_text}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="create-tag-section">
        <input
          type="text"
          value={newTagText}
          onChange={(e) => setNewTagText(e.target.value)}
          placeholder="Create new tag..."
          onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
        />
        <button onClick={handleCreateTag} disabled={!newTagText.trim() || creatingTag}>
          {creatingTag ? 'Creating...' : 'Create Tag'}
        </button>
      </div>
      <div className="tag-library-actions">
        <button onClick={onClose} className="cancel-button">Cancel</button>
        <button onClick={handleAddSelected} className="add-button">Add Selected Tags</button>
      </div>
    </div>
  );
}

// Question Editor Component for Study Detail
function StudyQuestionEditor({
  question,
  isInStudy,
  onSave,
  onCancel,
  onAddTags
}: {
  question: PostResponseQuestionResponse;
  isInStudy: boolean;
  onSave: (updates: Partial<PostResponseQuestionCreate>) => void;
  onCancel: () => void;
  onAddTags: () => void;
}) {
  const [questionText, setQuestionText] = useState(question.question.question_text);
  const [isRequired, setIsRequired] = useState(question.is_required);
  const [freeTextRequired, setFreeTextRequired] = useState(question.free_text_required);
  const [allowsFreeText, setAllowsFreeText] = useState(question.question.allows_free_text);
  const [allowsTags, setAllowsTags] = useState(question.question.allows_tags);

  const handleSave = () => {
    onSave({
      question_text: question.is_default ? undefined : questionText,
      is_required: isRequired,
      free_text_required: freeTextRequired,
      allows_free_text: allowsFreeText,
      allows_tags: allowsTags
    });
  };

  return (
    <div className="question-editor-content">
      <div className="form-group">
        <label>Question Text</label>
        <input
          type="text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          disabled={question.is_default}
          placeholder="Enter question text"
        />
        {question.is_default && <p className="help-text">Default question text cannot be edited</p>}
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={allowsFreeText}
            onChange={(e) => setAllowsFreeText(e.target.checked)}
            disabled={question.is_default}
          />
          Allow free text response
        </label>
      </div>
      {isInStudy && allowsFreeText && (
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={freeTextRequired}
              onChange={(e) => setFreeTextRequired(e.target.checked)}
            />
            Require free text response
          </label>
        </div>
      )}
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={allowsTags}
            onChange={(e) => setAllowsTags(e.target.checked)}
            disabled={question.is_default}
          />
          Allow tag selection
        </label>
      </div>
      {isInStudy && (
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Required question
          </label>
        </div>
      )}
      {allowsTags && (
        <div className="form-group">
          <button onClick={onAddTags} className="add-tags-button">
            Manage Tags ({question.tags.length} tags)
          </button>
        </div>
      )}
      <div className="question-editor-actions">
        <button onClick={onCancel} className="cancel-button">Cancel</button>
        <button onClick={handleSave} className="save-button">Save</button>
      </div>
    </div>
  );
}

