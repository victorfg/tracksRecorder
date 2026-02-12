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
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
    }
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
        <p className="tracks-loading">Cargando...</p>
      </div>
    )
  }

  if (!track) {
    return (
      <div className="track-detail">
        <p className="tracks-empty">Track no encontrado</p>
        <Link to="/tracks" className="track-back">
          Volver a Mis tracks
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
          ← Volver
        </Link>
        <h2 className="track-detail-title">{track.name}</h2>
        <div className="track-stats">
          <span>{formatDistance(distance)}</span>
          <span>{formatDuration(duration)}</span>
          <span>{track.points.length} puntos</span>
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
          {latlngs.length > 1 && (
            <>
              <FitBounds positions={latlngs} />
              <Polyline
                positions={latlngs}
                pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.9 }}
              />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
