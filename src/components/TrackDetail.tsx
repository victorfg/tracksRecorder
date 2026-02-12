import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../contexts/AuthContext'
import { getTrack } from '../services/tracksService'
import type { Track } from '../types'
import { calculateTrackDistance, formatDistance, formatDuration } from '../utils/geo'

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0], 17)
      return
    }
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 })
  }, [map, positions])
  return null
}

export function TrackDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [track, setTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      getTrack(id, user?.uid).then((data) => {
        setTrack(data ?? null)
        setLoading(false)
      })
    }
  }, [id, user?.uid])

  if (loading) {
    return (
      <div className="track-detail">
        <p className="tracks-loading">Carregant...</p>
      </div>
    )
  }

  if (!track) {
    return (
      <div className="track-detail">
        <p className="tracks-empty">Track no trobat</p>
        <Link to="/tracks" className="track-back">
          Tornar als meus tracks
        </Link>
      </div>
    )
  }

  const latlngs: [number, number][] = track.points.map((p) => [p.lat, p.lng])
  const distance = calculateTrackDistance(track.points)
  const duration =
    track.points.length > 1
      ? (track.points[track.points.length - 1].timestamp - track.points[0].timestamp) / 1000
      : 0
  const center: [number, number] = track.points[0]
    ? [track.points[0].lat, track.points[0].lng]
    : [40.4168, -3.7038]

  return (
    <div className="track-detail">
      <div className="track-detail-header">
        <Link to="/tracks" className="track-back">
          ← Tornar
        </Link>
        <h2 className="track-detail-title">{track.name}</h2>
        <div className="track-stats-grid">
          <div className="track-stat-card">
            <span className="track-stat-label">Distància</span>
            <span className="track-stat-value track-stat-distance">{formatDistance(distance)}</span>
          </div>
          <div className="track-stat-card">
            <span className="track-stat-label">Durada</span>
            <span className="track-stat-value">{formatDuration(duration)}</span>
          </div>
          <div className="track-stat-card">
            <span className="track-stat-label">Punts</span>
            <span className="track-stat-value">{track.points.length}</span>
          </div>
        </div>
      </div>
      <div className="track-detail-map">
        <MapContainer
          center={center}
          zoom={15}
          className="map"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={latlngs} />
          {latlngs.length > 1 && (
            <Polyline
              positions={latlngs}
              pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.9 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
