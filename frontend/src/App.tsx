import { useState, useEffect } from 'react'
import './App.css'

// Get API URL from environment variable (set at build time for Docker)
const API_URL = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error('Error fetching data:', err))
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>Subway Seat Selection</h1>
        <p>{message || 'Loading...'}</p>
      </header>
    </div>
  )
}

export default App

