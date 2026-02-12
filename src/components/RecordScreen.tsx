import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Track, TrackPoint } from '../types'
import { useWakeLock } from '../hooks/useWakeLock'
import { useAuth } from '../contexts/AuthContext'
import { saveTrack } from '../services/tracksService'
import { bearing, destination } from '../utils/geo'

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
    map.invalidateSize()
  }, [map, center])
  return null
}

function MapInit() {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
  }, [map])
  return null
}

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038]

export function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false)
  const [points, setPoints] = useState<TrackPoint[]>([])
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [duration, setDuration] = useState(0)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdIntervalRef = useRef<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<number | null>(null)
  const pointsRef = useRef<TrackPoint[]>([])
  pointsRef.current = points

  const { isSupported: wakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock()
  const { user } = useAuth()

  // Obtener ubicación para centrar el mapa cuando no está logueado
  useEffect(() => {
    if (!user) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        () => setMapCenter(DEFAULT_CENTER),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      )
    } else {
      setMapCenter(null)
    }
  }, [user])

  const startRecording = useCallback(async () => {
    setError(null)
    setPoints([])
    setCurrentPosition(null)
    setAccuracy(null)
    startTimeRef.current = Date.now()
    setDuration(0)

    const granted = await requestWakeLock()
    if (!granted && wakeLockSupported) {
      setError('No s\'ha pogut mantenir la pantalla encesa. La gravació continuarà.')
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
        name: `Track ${new Date().toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'short' })}`,
        points: pointsToSave,
        startTime: pointsToSave[0].timestamp,
        endTime: pointsToSave[pointsToSave.length - 1].timestamp,
        createdAt: Date.now(),
      }
      await saveTrack(track, user?.uid)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 5000)
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
  const center: [number, number] = currentPosition ?? (points[0] ? [points[0].lat, points[0].lng] : mapCenter ?? DEFAULT_CENTER)

  const displayPosition = user ? currentPosition : mapCenter
  const showPositionMarker = displayPosition !== null

  // Línia d'orientació: direcció del moviment (calen 2+ punts i haver-se mogut >2m)
  let directionLine: [number, number][] | null = null
  if (user && currentPosition && points.length >= 2) {
    const a = points[points.length - 2]
    const b = points[points.length - 1]
    const distM = Math.hypot(
      (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180),
      (b.lat - a.lat) * 110540
    )
    if (distM >= 2) {
      const bng = bearing(a.lat, a.lng, b.lat, b.lng)
      const end = destination(currentPosition[0], currentPosition[1], bng, 18)
      directionLine = [currentPosition, end]
    }
  }

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
          <MapInit />
          {!user && mapCenter && <MapUpdater center={mapCenter} />}
          {showPositionMarker && displayPosition ? (
            <>
              {user && currentPosition && <MapUpdater center={currentPosition} />}
              {user && accuracy !== null && accuracy < 100 && currentPosition && (
                <Circle
                  center={currentPosition}
                  radius={accuracy}
                  pathOptions={{
                    color: '#4285F4',
                    fillColor: '#4285F4',
                    fillOpacity: 0.12,
                    weight: 1.5,
                  }}
                />
              )}
              <CircleMarker
                center={displayPosition}
                radius={5}
                pathOptions={{
                  color: '#4285F4',
                  fillColor: '#4285F4',
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
              {directionLine && (
                <Polyline
                  positions={directionLine}
                  pathOptions={{
                    color: '#4285F4',
                    weight: 3,
                    opacity: 0.9,
                  }}
                />
              )}
            </>
          ) : null}
          {latlngs.length > 1 && (
            <Polyline
              positions={latlngs}
              pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.9 }}
            />
          )}
        </MapContainer>
      </div>

      {user && (
      <div className="status-bar">
        {error && <div className="status-error">{error}</div>}
        {saveSuccess && <div className="status-success">Track guardat i pujat al servidor</div>}
        <div className="status-row">
            <span className={isRecording ? 'rec-dot' : ''}>
              {isRecording ? 'Gravant' : 'Pausat'}
            </span>
            <span>{points.length} punts</span>
            {isRecording && <span>{formatDuration(duration)}</span>}
            {accuracy !== null && <span>±{Math.round(accuracy)}m</span>}
        </div>
      </div>
      )}

      <div className="record-actions">
        {!user ? (
          <div className="login-required-overlay">
            <p>Inicia sessió per gravar</p>
            <Link to="/login" className="btn-record start">
              Entrar o crear compte
            </Link>
          </div>
        ) : !isRecording ? (
          <button type="button" className="btn-record start" onClick={startRecording}>
            Iniciar gravació
          </button>
        ) : (
          <button
            type="button"
            className="btn-record stop"
            onPointerDown={() => {
              setHoldProgress(0)
              const start = Date.now()
              holdIntervalRef.current = window.setInterval(() => {
                const elapsed = (Date.now() - start) / 1000
                setHoldProgress(Math.min(elapsed / 3, 1))
                if (elapsed >= 3) {
                  if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
                  holdIntervalRef.current = null
                  stopRecording()
                  setHoldProgress(0)
                }
              }, 50)
            }}
            onPointerUp={() => {
              if (holdIntervalRef.current) {
                clearInterval(holdIntervalRef.current)
                holdIntervalRef.current = null
              }
              setHoldProgress(0)
            }}
            onPointerLeave={() => {
              if (holdIntervalRef.current) {
                clearInterval(holdIntervalRef.current)
                holdIntervalRef.current = null
              }
              setHoldProgress(0)
            }}
            onPointerCancel={() => {
              if (holdIntervalRef.current) {
                clearInterval(holdIntervalRef.current)
                holdIntervalRef.current = null
              }
              setHoldProgress(0)
            }}
          >
            <span className="stop-btn-content">
              {holdProgress > 0 && holdProgress < 1 ? (
                `Mantén ${Math.ceil(3 - holdProgress * 3)} s`
              ) : (
                'Mantén 3 s per aturar'
              )}
            </span>
            {holdProgress > 0 && (
              <span
                className="stop-btn-progress"
                style={{ width: `${holdProgress * 100}%` }}
              />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
