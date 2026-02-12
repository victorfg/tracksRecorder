import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { RecordScreen } from './components/RecordScreen'
import { TracksList } from './components/TracksList'
import { TrackDetail } from './components/TrackDetail'
import { AuthForm } from './components/AuthForm'
import { useAuth } from './contexts/AuthContext'
import './App.css'

function AppHeader() {
  const { user, signOut } = useAuth()

  return (
    <header className="app-header">
      <Link to="/" className="app-logo">
        <h1>Tracks Recorder</h1>
      </Link>
      <nav className="app-nav">
        <NavLink to="/" className="nav-link" end>
          Grabar
        </NavLink>
        <NavLink to="/tracks" className="nav-link">
          Mis tracks
        </NavLink>
        {user ? (
          <div className="nav-user">
            <span className="nav-email">{user.email}</span>
            <button type="button" className="nav-logout" onClick={() => signOut()}>
              Salir
            </button>
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
          <Route path="/login" element={<AuthForm />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
