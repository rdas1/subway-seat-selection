import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect to scenario page which will handle random scenario loading
    navigate('/scenario', { replace: true })
  }, [navigate])

  return (
    <div className="App">
      <div className="loading-message">
        <p>Loading...</p>
      </div>
    </div>
  )
}
