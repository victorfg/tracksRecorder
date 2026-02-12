import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getTracks, deleteTrack } from '../services/tracksService'
import { ConfirmModal } from './ConfirmModal'
import type { Track } from '../types'
import { calculateTrackDistance, formatDistance, formatDuration } from '../utils/geo'

export function TracksList() {
  const { user } = useAuth()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null)

  useEffect(() => {
    getTracks(user?.uid).then((data) => {
      setTracks(data)
      setLoading(false)
    })
  }, [user?.uid])

  const handleConfirmDelete = async () => {
    if (!trackToDelete || !user?.uid) return
    await deleteTrack(trackToDelete.id, user.uid)
    setTracks((prev) => prev.filter((t) => t.id !== trackToDelete.id))
    setTrackToDelete(null)
  }

  if (loading) {
    return (
      <div className="tracks-list">
        <p className="tracks-loading">Carregant tracks...</p>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="tracks-list">
        <h2 className="tracks-list-title">Els meus tracks</h2>
        <div className="tracks-empty-state">
          <p className="tracks-empty">Encore no tens tracks guardats</p>
          <p className="tracks-hint">
            Ves a la pantalla principal, inicia una grabació i mantén premut 3 segons per guardar. Les teves rutes es sincronitzaran entre dispositius.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tracks-list">
      <h2 className="tracks-list-title">Els meus tracks</h2>
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
                  {track.points.length} punts
                </span>
              </Link>
              <button
                type="button"
                className="track-delete-btn"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setTrackToDelete(track)
                }}
                title="Eliminar track"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      {trackToDelete && (
        <ConfirmModal
          title="Eliminar track"
          message="La ruta s'eliminarà de manera permanent. No es podrà desfer."
          confirmLabel="Eliminar"
          cancelLabel="Cancel·lar"
          confirmDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setTrackToDelete(null)}
        />
      )}
    </div>
  )
}
