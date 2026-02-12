import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getTracks, deleteTrack } from '../services/tracksService'
import type { Track } from '../types'
import { calculateTrackDistance, formatDistance, formatDuration } from '../utils/geo'

export function TracksList() {
  const { user } = useAuth()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTracks(user?.uid).then((data) => {
      setTracks(data)
      setLoading(false)
    })
  }, [user?.uid])

  if (loading) {
    return (
      <div className="tracks-list">
        <p className="tracks-loading">Cargando tracks...</p>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="tracks-list">
        <p className="tracks-empty">
          No hay tracks guardados.
          <br />
          Los tracks se guardan en este dispositivo cuando grabas.
        </p>
        <p className="tracks-hint">
          Graba un track desde la pantalla principal para verlo aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="tracks-list">
      <ul className="tracks-ul">
        {tracks.map((track) => {
          const distance = calculateTrackDistance(track.points)
          const duration =
            track.points.length > 1
              ? (track.points[track.points.length - 1].timestamp -
                  track.points[0].timestamp) /
                1000
              : 0

          return (
            <li key={track.id} className="track-item">
              <Link to={`/tracks/${track.id}`} className="track-link">
                <span className="track-name">{track.name}</span>
                <span className="track-meta">
                  {formatDistance(distance)} · {formatDuration(duration)} ·{' '}
                  {track.points.length} puntos
                </span>
              </Link>
              <button
                type="button"
                className="track-delete-btn"
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (window.confirm('¿Eliminar este track?')) {
                    await deleteTrack(track.id, user?.uid)
                    setTracks((prev) => prev.filter((t) => t.id !== track.id))
                  }
                }}
                title="Eliminar"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
