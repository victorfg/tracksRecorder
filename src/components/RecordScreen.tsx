import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Track, TrackPoint } from '../types'
import { useWakeLock } from '../hooks/useWakeLock'
import { saveTrack } from '../storage'

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [map, center])
  return null
}

export function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false)
  const [points, setPoints] = useState<TrackPoint[]>([])
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const watchIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<number | null>(null)
  const pointsRef = useRef<TrackPoint[]>([])
  pointsRef.current = points

  const { isSupported: wakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock()

  const startRecording = useCallback(async () => {
    setError(null)
    setPoints([])
    setCurrentPosition(null)
    setAccuracy(null)
    startTimeRef.current = Date.now()
    setDuration(0)

    const granted = await requestWakeLock()
    if (!granted && wakeLockSupported) {
      setError('No se pudo mantener la pantalla encendida. La grabación continuará.')
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
        setPoints((prev) => [...prev, point])
        setCurrentPosition([point.lat, point.lng])
        setAccuracy(pos.coords.accuracy)
      },
      (err) => {
        setError(`GPS: ${err.message}`)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 5000,
      }
    )

    watchIdRef.current = watchId
    setIsRecording(true)

    durationIntervalRef.current = window.setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [requestWakeLock, wakeLockSupported])

  const stopRecording = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    await releaseWakeLock()
    setIsRecording(false)

    const pointsToSave = pointsRef.current
    if (pointsToSave.length > 1) {
      const track: Track = {
        id: crypto.randomUUID(),
        name: `Track ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`,
        points: pointsToSave,
        startTime: pointsToSave[0].timestamp,
        endTime: pointsToSave[pointsToSave.length - 1].timestamp,
        createdAt: Date.now(),
      }
      await saveTrack(track)
    }

    setPoints([])
    setCurrentPosition(null)
  }, [releaseWakeLock])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const latlngs: [number, number][] = points.map((p) => [p.lat, p.lng])
  const center: [number, number] = currentPosition ?? (points[0] ? [points[0].lat, points[0].lng] : [40.4168, -3.7038])

  return (
    <div className="record-screen">
      <div className="map-container">
        <MapContainer
          center={center}
          zoom={17}
          className="map"
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {currentPosition && <MapUpdater center={currentPosition} />}
          {latlngs.length > 1 && (
            <Polyline
              positions={latlngs}
              pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.9 }}
            />
          )}
        </MapContainer>
      </div>

      <div className="status-bar">
        {error && <div className="status-error">{error}</div>}
        <div className="status-row">
          <span className={isRecording ? 'rec-dot' : ''}>
            {isRecording ? 'Grabando' : 'Pausado'}
          </span>
          <span>{points.length} puntos</span>
          {isRecording && <span>{formatDuration(duration)}</span>}
          {accuracy !== null && <span>±{Math.round(accuracy)}m</span>}
        </div>
      </div>

      <div className="record-actions">
        {!isRecording ? (
          <button type="button" className="btn-record start" onClick={startRecording}>
            Iniciar grabación
          </button>
        ) : (
          <button type="button" className="btn-record stop" onClick={stopRecording}>
            Detener y guardar
          </button>
        )}
      </div>
    </div>
  )
}
