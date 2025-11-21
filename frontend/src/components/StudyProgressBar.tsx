import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { studyProgressApi, StudyProgressResponse } from '../services/api'
import { getSessionId } from '../utils/session'
import './StudyProgressBar.css'

interface StudyProgressBarProps {
  studyId: number
}

export default function StudyProgressBar({ studyId }: StudyProgressBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<StudyProgressResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [hasVisitedPostStudy, setHasVisitedPostStudy] = useState<boolean>(false)

  useEffect(() => {
    const loadProgress = async () => {
      try {
        setLoading(true)
        const sessionId = getSessionId()
        const progressData = await studyProgressApi.getProgress(studyId, sessionId)
        setProgress(progressData)
        
        // Check if user has visited post-study page (stored in localStorage)
        const visitedKey = `study_${studyId}_post_study_visited`
        const hasVisited = localStorage.getItem(visitedKey) === 'true'
        setHasVisitedPostStudy(hasVisited)
      } catch (err) {
        console.error('Failed to load study progress:', err)
        // Don't show error - progress bar is optional
      } finally {
        setLoading(false)
      }
    }

    loadProgress()
  }, [studyId])

  // Track when user visits post-study page
  useEffect(() => {
    if (location.pathname.includes('/post-study-questions')) {
      const visitedKey = `study_${studyId}_post_study_visited`
      localStorage.setItem(visitedKey, 'true')
      setHasVisitedPostStudy(true)
    }
  }, [location.pathname, studyId])

  if (loading || !progress) {
    return null // Don't show anything while loading or if progress unavailable
  }

  // Determine current page from route
  let currentPageType: 'pre-study' | 'scenario' | 'post-study' | null = null
  let currentPageNumber: number | null = null

  const pathname = location.pathname
  
  if (pathname.includes('/pre-study-questions')) {
    currentPageType = 'pre-study'
  } else if (pathname.includes('/post-study-questions')) {
    currentPageType = 'post-study'
  } else if (pathname.includes('/scenario/')) {
    // Extract scenario number from path like /study/:id/scenario/:scenarioNumber
    currentPageType = 'scenario'
    const scenarioMatch = pathname.match(/\/scenario\/(\d+)/)
    if (scenarioMatch && scenarioMatch[1]) {
      const scenarioNum = parseInt(scenarioMatch[1], 10)
      if (!isNaN(scenarioNum)) {
        currentPageNumber = scenarioNum
      }
    }
  }

  // Calculate total steps: 1 (pre-study) + scenarios + 1 (post-study)
  const totalSteps = 1 + progress.total_scenarios + 1
  
  // Calculate current step number based on current page (not API response)
  let currentStep = 1 // Default to pre-study
  if (currentPageType === 'pre-study') {
    currentStep = 1
  } else if (currentPageType === 'scenario' && currentPageNumber) {
    currentStep = 1 + currentPageNumber // Pre-study (1) + scenario number
  } else if (currentPageType === 'post-study') {
    currentStep = 1 + progress.total_scenarios + 1 // Pre-study (1) + all scenarios + post-study (1)
  }

  // Calculate progress percentage to align with circle centers
  // The circles are evenly distributed, so we calculate the position of the current step's circle center
  // Step 1 is at 0%, step N is at 100%, and steps in between are evenly spaced
  let progressPercentage = 0
  if (totalSteps === 1) {
    progressPercentage = 100
  } else if (currentStep === 1) {
    progressPercentage = 0
  } else if (currentStep >= totalSteps) {
    progressPercentage = 100
  } else {
    // Calculate position: (currentStep - 1) / (totalSteps - 1) * 100
    progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100
  }

  // Handle navigation to a specific step
  const handleStepClick = (stepType: 'pre-study' | 'scenario' | 'post-study', stepNumber?: number) => {
    // Determine if this step is accessible (completed or current)
    let isAccessible = false
    if (stepType === 'pre-study') {
      isAccessible = progress.pre_study_completed || currentPageType === 'pre-study'
    } else if (stepType === 'scenario' && stepNumber) {
      // Allow navigation to any scenario up to the current one, or any completed scenario
      isAccessible = stepNumber <= progress.scenarios_completed || 
                     (currentPageType === 'scenario' && currentPageNumber !== null && stepNumber <= currentPageNumber)
    } else if (stepType === 'post-study') {
      // Allow navigation to post-study if all scenarios are completed or we're already there
      isAccessible = progress.scenarios_completed === progress.total_scenarios || 
                     currentPageType === 'post-study'
    }

    if (!isAccessible) return

    // Navigate to the appropriate page
    if (stepType === 'pre-study') {
      navigate(`/study/${studyId}/pre-study-questions`)
    } else if (stepType === 'scenario' && stepNumber) {
      navigate(`/study/${studyId}/scenario/${stepNumber}`)
    } else if (stepType === 'post-study') {
      navigate(`/study/${studyId}/post-study-questions`)
    }
  }

  return (
    <div className="study-progress-bar">
      <div className="progress-bar-container">
        <div className="progress-bar-track">
          <div 
            className="progress-bar-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-steps">
          <div 
            className={`progress-step ${progress.pre_study_completed ? 'completed' : ''} ${currentPageType === 'pre-study' ? 'current' : ''} ${(progress.pre_study_completed || currentPageType === 'pre-study') ? 'clickable' : ''}`}
            onClick={() => handleStepClick('pre-study')}
          >
            <div className="progress-step-indicator">
              {progress.pre_study_completed ? '✓' : '1'}
            </div>
            <span className="progress-step-label">Intro</span>
          </div>
          {Array.from({ length: progress.total_scenarios }, (_, i) => i + 1).map((num) => {
            const isCompleted = num <= progress.scenarios_completed
            const isCurrent = currentPageType === 'scenario' && currentPageNumber === num
            // Allow navigation to any scenario up to the current one, or any completed scenario
            const isAccessible = isCompleted || isCurrent || 
                                 (currentPageType === 'scenario' && currentPageNumber !== null && num <= currentPageNumber)
            return (
              <div 
                key={num} 
                className={`progress-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isAccessible ? 'clickable' : ''}`}
                onClick={() => handleStepClick('scenario', num)}
              >
                <div className="progress-step-indicator">
                  {isCompleted ? '✓' : num}
                </div>
                <span className="progress-step-label">Scenario {num}</span>
              </div>
            )
          })}
          <div 
            className={`progress-step ${(currentPageType === 'post-study' || hasVisitedPostStudy) ? 'completed' : ''} ${currentPageType === 'post-study' ? 'current' : ''} ${(progress.scenarios_completed === progress.total_scenarios || currentPageType === 'post-study') ? 'clickable' : ''}`}
            onClick={() => handleStepClick('post-study')}
          >
            <div className="progress-step-indicator">
              {(currentPageType === 'post-study' || hasVisitedPostStudy) ? '✓' : ''}
            </div>
            <span className="progress-step-label">Conclusion</span>
          </div>
        </div>
      </div>
    </div>
  )
}

