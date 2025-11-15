import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import './App.css'
import HomePage from './pages/HomePage'
import ScenarioEditor from './components/ScenarioEditor'
import ScenarioPage from './pages/ScenarioPage'

export type PlayerGender = 'man' | 'woman' | 'neutral'

function Navigation() {
  const location = useLocation()

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          🚇 Subway Seat Selection
        </Link>
        <div className="nav-links">
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'active' : ''}
          >
            Home
          </Link>
          <Link 
            to="/scenario-editor" 
            className={location.pathname === '/scenario-editor' ? 'active' : ''}
          >
            Scenario Editor
          </Link>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scenario-editor" element={<ScenarioEditor />} />
          <Route path="/scenario/:id" element={<ScenarioPage />} />
          <Route path="/scenario" element={<ScenarioPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App

