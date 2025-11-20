import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import './App.css'
import HomePage from './pages/HomePage'
import ScenarioEditor from './components/ScenarioEditor'
import ScenarioPage from './pages/ScenarioPage'
import StudyBuilder from './pages/StudyBuilder'
import StudyDetail from './pages/StudyDetail'
import VerificationPage from './pages/VerificationPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'

export type PlayerGender = 'man' | 'woman' | 'neutral' | 'prefer-not-to-say'

function Navigation() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    setMobileMenuOpen(false)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
    setCreateDropdownOpen(false)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
    setCreateDropdownOpen(false)
  }

  const toggleCreateDropdown = () => {
    setCreateDropdownOpen(!createDropdownOpen)
  }

  const isCreateActive = location.pathname.startsWith('/scenario-editor') || location.pathname.startsWith('/study-builder')

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
          Subway Simulator
        </Link>
        <button 
          className="nav-hamburger"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
        </button>
        <div className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'active' : ''}
            onClick={closeMobileMenu}
          >
            Home
          </Link>
          <div className="nav-dropdown">
            <button 
              className={`nav-dropdown-toggle ${isCreateActive ? 'active' : ''}`}
              onClick={toggleCreateDropdown}
              onBlur={() => setTimeout(() => setCreateDropdownOpen(false), 200)}
            >
              Create
              <span className="nav-dropdown-icon">{createDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {createDropdownOpen && (
              <div className="nav-dropdown-menu">
                <Link 
                  to="/scenario-editor" 
                  className={location.pathname.startsWith('/scenario-editor') ? 'active' : ''}
                  onClick={() => {
                    setCreateDropdownOpen(false)
                    closeMobileMenu()
                  }}
                >
                  Scenario
                </Link>
                <Link 
                  to="/study-builder" 
                  className={location.pathname.startsWith('/study-builder') ? 'active' : ''}
                  onClick={() => {
                    setCreateDropdownOpen(false)
                    closeMobileMenu()
                  }}
                >
                  Study
                </Link>
              </div>
            )}
          </div>
          {/* Mobile: show dropdown items directly */}
          <div className="nav-dropdown-mobile">
          <Link 
            to="/scenario-editor" 
              className={location.pathname.startsWith('/scenario-editor') ? 'active' : ''}
            onClick={closeMobileMenu}
          >
              Scenario
          </Link>
          <Link 
            to="/study-builder" 
              className={location.pathname.startsWith('/study-builder') ? 'active' : ''}
            onClick={closeMobileMenu}
          >
              Study
          </Link>
          </div>
          {user ? (
            <>
              <span className="nav-user-email">{user.email}</span>
              <button onClick={handleLogout} className="nav-logout-button">
                Logout
              </button>
            </>
          ) : (
            <Link 
              to="/login" 
              className="nav-login-button"
              onClick={closeMobileMenu}
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
            <Route path="/scenario-editor" element={<ScenarioEditor />} />
            <Route path="/scenario-editor/:id" element={<ScenarioEditor />} />
            <Route path="/login" element={<VerificationPage />} />
            <Route path="/verify" element={<VerificationPage />} />
            <Route path="/study-builder" element={<StudyBuilder />} />
            <Route path="/study-builder/:id" element={<StudyDetail />} />
          <Route path="/scenario/:id" element={<ScenarioPage />} />
          <Route path="/scenario" element={<ScenarioPage />} />
        </Routes>
      </div>
    </BrowserRouter>
    </AuthProvider>
  )
}

export default App

