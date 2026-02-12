import { useState, useRef, useEffect } from 'react'
import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
import { RecordScreen } from './components/RecordScreen'
import { TracksList } from './components/TracksList'
import { TrackDetail } from './components/TrackDetail'
import { MapView } from './components/MapView'
import { AuthForm } from './components/AuthForm'
import { useAuth } from './contexts/AuthContext'
import './App.css'

function AppHeader() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <header className="app-header">
      <Link to="/" className="app-logo">
        <h1>
          <span className="app-logo-full">Tracks Recorder</span>
          <span className="app-logo-short">Tracks</span>
        </h1>
      </Link>
      <nav className="app-nav">
        {user && (
          <>
            <NavLink to="/tracks" className="nav-link">
              Els meus tracks
            </NavLink>
            <NavLink to="/mapa" className="nav-link nav-link-map">
              Mapa
            </NavLink>
          </>
        )}
        {user ? (
          <div className="nav-user" ref={menuRef}>
            <button
              type="button"
              className="nav-user-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menú usuari"
              aria-expanded={menuOpen}
            >
              <span className="nav-user-avatar">
                {(user.email?.[0] ?? '?').toUpperCase()}
              </span>
            </button>
            {menuOpen && (
              <div className="nav-user-menu">
                <div className="nav-user-menu-header">
                  <span className="nav-user-menu-label">Usuari</span>
                  <span className="nav-user-email">{user.email}</span>
                </div>
                <div className="nav-user-menu-actions">
                  <button
                    type="button"
                    className="nav-logout-menu"
                    onClick={async () => {
                      await signOut()
                      setMenuOpen(false)
                      navigate('/')
                    }}
                  >
                    Sortir
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <NavLink to="/login" className="nav-link nav-link-emphasis">
            Entrar
          </NavLink>
        )}
      </nav>
    </header>
  )
}

function App() {
  return (
    <div className="app">
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<RecordScreen />} />
          <Route path="/tracks" element={<TracksList />} />
          <Route path="/tracks/:id" element={<TrackDetail />} />
          <Route path="/mapa" element={<MapView />} />
          <Route path="/login" element={<AuthForm />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
