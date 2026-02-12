import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Track, TrackPoint } from '../types'
import { useWakeLock } from '../hooks/useWakeLock'
import { useAuth } from '../contexts/AuthContext'
import { saveTrack } from '../services/tracksService'
import { bearing } from '../utils/geo'
import { useMapLayer } from '../contexts/MapLayerContext'
import { LocationMarker } from './LocationMarker'
import { MapLayerControl } from './MapLayerControl'

const RECORD_ZOOM = 18

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function MapFollowUpdater({
  position,
  zoom,
  smooth,
  minMoveM = 2,
}: {
  position: [number, number]
  zoom: number
  smooth: boolean
  minMoveM?: number
}) {
  const map = useMap()
  const lastRef = useRef<[number, number] | null>(null)
  useEffect(() => {
    const prev = lastRef.current
    const isFirst = !prev
    const shouldUpdate = isFirst || haversineM(prev, position) >= minMoveM
    if (shouldUpdate) {
      lastRef.current = position
      if (isFirst) {
        map.setView(position, zoom, { animate: true, duration: 0.5 })
      } else if (smooth) {
        map.panTo(position, { animate: true, duration: 0.4 })
      } else {
        map.setView(position, zoom)
      }
    }
    map.invalidateSize()
  }, [map, position, zoom, smooth, minMoveM])
  return null
}

function MapUpdater({
  center,
  zoom,
  smooth,
}: {
  center: [number, number]
  zoom: number
  smooth?: boolean
}) {
  const map = useMap()
  useEffect(() => {
    if (smooth) {
      map.panTo(center, { animate: true, duration: 0.5 })
    } else {
      map.setView(center, zoom)
    }
    map.invalidateSize()
  }, [map, center, zoom, smooth])
  return null
}

function MapInit() {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
  }, [map])
  return null
}

function CenterOnMeButton({
  position,
  onLocationRequest,
}: {
  position: [number, number] | null
  onLocationRequest?: (pos: [number, number]) => void
}) {
  const map = useMap()
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    if (position) {
      map.setView(position, RECORD_ZOOM, { animate: true, duration: 0.5 })
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        onLocationRequest?.(coords)
        map.setView(coords, RECORD_ZOOM, { animate: true, duration: 0.5 })
        setLoading(false)
      },
      () => {
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <button
      type="button"
      className={`center-on-me-btn ${loading ? 'loading' : ''}`}
      onClick={handleClick}
      disabled={loading}
      title="La meva ubicació (només per mirar el mapa, no grava)"
      aria-label="Veure la meva ubicació al mapa (no grava)"
    >
      {loading ? (
        <span className="center-on-me-btn-spinner">…</span>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
      )}
    </button>
  )
}

function BasemapChangeHandler({ basemapId }: { basemapId: string }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(t)
  }, [map, basemapId])
  return null
}

const DEFAULT_CENTER: [number, number] = [41.6, 1.5] // Catalunya

export function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false)
  const [points, setPoints] = useState<TrackPoint[]>([])
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveCloudFailed, setSaveCloudFailed] = useState(false)
  const [duration, setDuration] = useState(0)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [userRequestedLocation, setUserRequestedLocation] = useState(false)
  const [requestedPosition, setRequestedPosition] = useState<[number, number] | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdIntervalRef = useRef<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<number | null>(null)
  const pointsRef = useRef<TrackPoint[]>([])
  pointsRef.current = points

  const { isSupported: wakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock()
  const { user } = useAuth()
  const { basemap } = useMapLayer()

  useEffect(() => {
    if (user) {
      setMapCenter(null)
      setUserRequestedLocation(false)
      setRequestedPosition(null)
    }
  }, [user])

  const startRecording = useCallback(async () => {
    setError(null)
    setPoints([])
    setCurrentPosition(null)
    setRequestedPosition(null)
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
      const result = await saveTrack(track, user?.uid)
      setSaveSuccess(true)
      setSaveCloudFailed(!result.savedCloud)
      setTimeout(() => {
        setSaveSuccess(false)
        setSaveCloudFailed(false)
      }, 6000)
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

  const isDefaultView =
    center[0] === DEFAULT_CENTER[0] && center[1] === DEFAULT_CENTER[1]
  const zoom = isDefaultView ? 8 : RECORD_ZOOM

  const displayPosition = user
    ? (currentPosition ?? requestedPosition)
    : mapCenter
  const showPositionMarker = displayPosition !== null

  // Direcció del moviment: mitjana dels últims segments per suavitzar (caminar)
  let directionBearing: number | null = null
  if (user && currentPosition && points.length >= 2) {
    const bearings: number[] = []
    const maxSegments = 5
    for (let i = points.length - 1; i > 0 && bearings.length < maxSegments; i--) {
      const a = points[i - 1]
      const b = points[i]
      const distM = Math.hypot(
        (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180),
        (b.lat - a.lat) * 110540
      )
      if (distM >= 0.3) {
        bearings.push(bearing(a.lat, a.lng, b.lat, b.lng))
      }
    }
    if (bearings.length > 0) {
      const sumSin = bearings.reduce((s, b) => s + Math.sin((b * Math.PI) / 180), 0)
      const sumCos = bearings.reduce((s, b) => s + Math.cos((b * Math.PI) / 180), 0)
      directionBearing = ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360
    }
  }

  return (
    <div className="record-screen">
      <div className="map-container">
        <MapContainer
          center={center}
          zoom={zoom}
          className="map"
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          rotate={true}
          bearing={0}
          touchRotate={true}
          rotateControl={false}
        >
          <TileLayer
            key={basemap.id}
            attribution={basemap.attribution}
            url={basemap.url}
            tms={basemap.tms}
          />
          <MapInit />
          <BasemapChangeHandler basemapId={basemap.id} />
          {!user && mapCenter && (
            <MapUpdater
              center={mapCenter}
              zoom={userRequestedLocation ? RECORD_ZOOM : 8}
              smooth={false}
            />
          )}
          <CenterOnMeButton
            position={displayPosition}
            onLocationRequest={(pos) => {
              if (!user) {
                setMapCenter(pos)
                setUserRequestedLocation(true)
              } else {
                setRequestedPosition(pos)
              }
            }}
          />
          {showPositionMarker && displayPosition ? (
            <>
              {user && currentPosition && (
                <MapFollowUpdater
                  position={currentPosition}
                  zoom={RECORD_ZOOM}
                  smooth={isRecording}
                  minMoveM={2}
                />
              )}
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
              <LocationMarker
                position={displayPosition}
                bearing={user ? directionBearing : null}
              />
            </>
          ) : null}
          {latlngs.length > 1 && (
            <Polyline
              positions={latlngs}
              pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.9 }}
            />
          )}
        </MapContainer>
        <MapLayerControl />
      </div>

      {user && (
      <div className={`status-bar ${!isRecording ? 'status-bar-desktop-hide' : ''}`}>
        {error && <div className="status-error">{error}</div>}
        {saveSuccess && (
          <div className={`status-success ${saveCloudFailed ? 'status-warning' : ''}`}>
            {saveCloudFailed
              ? 'Track guardat al dispositiu. Sense connexió: es pujarà quan tornis a tenir xarxa.'
              : 'Track guardat i pujat al servidor'}
          </div>
        )}
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

      <div className={`record-actions ${user && !isRecording ? 'record-actions-start-only' : ''} ${!user ? 'record-actions-login-required' : ''}`}>
        {!user ? (
          <div className="login-required-overlay">
            <p>Inicia sessió per gravar</p>
            <Link to="/login" className="btn-record start">
              Entrar o crear compte
            </Link>
          </div>
        ) : !isRecording ? (
          <button
            type="button"
            className="btn-record start"
            onClick={startRecording}
          >
            Iniciar gravació
          </button>
        ) : (
          <button
            type="button"
            className="btn-record stop"
            onTouchStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault()
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
