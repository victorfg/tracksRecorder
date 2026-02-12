import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AuthForm.css'

type Mode = 'signin' | 'signup'

export function AuthForm() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const { error: err } =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password)

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    if (mode === 'signup') {
      setSuccess('Cuenta creada. Revisa tu email para confirmar (si está configurado).')
    } else {
      navigate('/tracks')
    }
  }

  return (
    <div className="auth-form">
      <Link to="/" className="auth-back">
        ← Volver
      </Link>
      <h2>{mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          minLength={6}
        />
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
      <button
        type="button"
        className="auth-switch"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setSuccess(null)
        }}
      >
        {mode === 'signin' ? 'Crear cuenta' : 'Ya tengo cuenta'}
      </button>
    </div>
  )
}
