import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getTracks, deleteTrack, saveTrack, uploadTrackToCloud } from '../services/tracksService'
import { ConfirmModal } from './ConfirmModal'
import type { Track } from '../types'
import { calculateTrackDistance, formatDistance, formatDuration } from '../utils/geo'

export function TracksList() {
  const { user } = useAuth()
  const [tracks, setTracks] = useState<Track[]>([])
  const [localOnlyIds, setLocalOnlyIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const justFinishedEditingRef = useRef(false)

  const fetchTracks = useCallback(() => {
    getTracks(user?.uid).then(({ tracks: t, localOnlyIds: ids }) => {
      setTracks(t)
      setLocalOnlyIds(ids)
      setLoading(false)
    })
  }, [user?.uid])

  useEffect(() => {
    fetchTracks()
  }, [fetchTracks])

  useEffect(() => {
    const onSynced = () => fetchTracks()
    window.addEventListener('tracks-synced', onSynced)
    return () => window.removeEventListener('tracks-synced', onSynced)
  }, [fetchTracks])

  const startEdit = (track: Track) => {
    justFinishedEditingRef.current = false
    setEditingId(track.id)
    setEditValue(track.name)
  }

  const saveEdit = async () => {
    if (!editingId || !user?.uid) return
    const track = tracks.find((t) => t.id === editingId)
    const trimmed = editValue.trim()
    justFinishedEditingRef.current = true
    if (!track || trimmed === track.name || trimmed === '') {
      setEditingId(null)
      return
    }
    const updated = { ...track, name: trimmed }
    await saveTrack(updated, user.uid)
    setTracks((prev) => prev.map((t) => (t.id === editingId ? updated : t)))
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleConfirmDelete = async () => {
    if (!trackToDelete || !user?.uid) return
    try {
      await deleteTrack(trackToDelete.id, user.uid)
      setTracks((prev) => prev.filter((t) => t.id !== trackToDelete.id))
      setLocalOnlyIds((prev) => {
        const next = new Set(prev)
        next.delete(trackToDelete.id)
        return next
      })
    } finally {
      setTrackToDelete(null)
    }
  }

  const handleUpload = async (track: Track) => {
    if (!user?.uid) return
    setUploadingId(track.id)
    try {
      const ok = await uploadTrackToCloud(track, user.uid)
      if (ok) fetchTracks()
    } finally {
      setUploadingId(null)
    }
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

          const isEditing = editingId === track.id

          return (
            <li key={track.id} className="track-item">
              {isEditing ? (
                <div className="track-edit-row">
                  <input
                    type="text"
                    className="track-name-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="track-save-btn"
                    onClick={saveEdit}
                    title="Desar"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <>
                  <Link to={`/tracks/${track.id}`} className="track-link">
                    <span className="track-name">{track.name}</span>
                    <span className="track-meta">
                      {formatDistance(distance)} · {formatDuration(duration)} ·{' '}
                      {track.points.length} punts
                      {localOnlyIds.has(track.id) && (
                        <span className="track-meta-pending"> · sense pujar</span>
                      )}
                    </span>
                  </Link>
                  {localOnlyIds.has(track.id) ? (
                    <button
                      type="button"
                      className="track-upload-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleUpload(track)
                      }}
                      disabled={uploadingId === track.id}
                      title="Pujar a la núvol"
                    >
                      {uploadingId === track.id ? '…' : '↑'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="track-edit-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        startEdit(track)
                      }}
                      title="Editar nom"
                    >
                      ✎
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                className="track-delete-btn"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (justFinishedEditingRef.current) {
                    justFinishedEditingRef.current = false
                    return
                  }
                  setTrackToDelete(track)
                }}
                disabled={isEditing}
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
