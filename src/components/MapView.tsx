import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  Polyline,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../contexts/AuthContext'
import { useMapLayer } from '../contexts/MapLayerContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { getTracks, saveTrack } from '../services/tracksService'
import {
  calculateTrackDistance,
  cumulativeDistances,
  formatDistanceKm,
  formatDuration,
} from '../utils/geo'
import { parseGpxOrTcx } from '../utils/gpxTcxParser'
import { ElevationProfile } from './ElevationProfile'
import { MapLayerControl } from './MapLayerControl'
import { MapNorthButton } from './MapNorthButton'
import type { Track } from '../types'
import './MapView.css'

type MapLayer = {
  track: Track
  color: string
  visible: boolean
}

const LAYER_COLORS = [
  { hex: '#22c55e', label: 'Verd' },
  { hex: '#3b82f6', label: 'Blau' },
  { hex: '#ef4444', label: 'Vermell' },
  { hex: '#f97316', label: 'Taronja' },
  { hex: '#a855f7', label: 'Violeta' },
  { hex: '#06b6d4', label: 'Cian' },
]

function MapResizeHandler({ sidebarOpen }: { sidebarOpen: boolean }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize()
    }, 350)
    return () => clearTimeout(t)
  }, [map, sidebarOpen])
  return null
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

function FitAllLayers({ layers }: { layers: MapLayer[] }) {
  const map = useMap()
  useEffect(() => {
    const positions: [number, number][] = []
    layers
      .filter((l) => l.visible && l.track.points.length > 0)
      .forEach((l) => {
        l.track.points.forEach((p) => positions.push([p.lat, p.lng]))
      })
    if (positions.length === 0) return
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [map, layers])
  return null
}

export function MapView() {
  const { user } = useAuth()
  const { basemap } = useMapLayer()
  const isMobile = useIsMobile()
  const [tracks, setTracks] = useState<Track[]>([])
  const [layers, setLayers] = useState<MapLayer[]>([])
  const [loading, setLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [layerInfoId, setLayerInfoId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as Element
      if (
        openColorPicker &&
        !target.closest('.map-view-layer-color-wrap')
      ) {
        setOpenColorPicker(null)
      }
    }
    document.addEventListener('click', fn)
    return () => document.removeEventListener('click', fn)
  }, [openColorPicker])

  useEffect(() => {
    if (!layerInfoId) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayerInfoId(null)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [layerInfoId])

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (user?.uid) {
      getTracks(user.uid).then(({ tracks: t }) => {
        setTracks(t)
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return
    const onSynced = () => getTracks(user.uid).then(({ tracks: t }) => setTracks(t))
    window.addEventListener('tracks-synced', onSynced)
    return () => window.removeEventListener('tracks-synced', onSynced)
  }, [user?.uid])

  const addLayer = (track: Track) => {
    if (layers.some((l) => l.track.id === track.id)) return
    const color = LAYER_COLORS[layers.length % LAYER_COLORS.length].hex
    setLayers((prev) => [...prev, { track, color, visible: true }])
  }

  const removeLayer = (trackId: string) => {
    setLayers((prev) => prev.filter((l) => l.track.id !== trackId))
  }

  const setLayerColor = (trackId: string, color: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.track.id === trackId ? { ...l, color } : l))
    )
  }

  const setLayerVisible = (trackId: string, visible: boolean) => {
    setLayers((prev) =>
      prev.map((l) => (l.track.id === trackId ? { ...l, visible } : l))
    )
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setImportError(null)
    setImportLoading(true)
    const allTracks: Track[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const text = await file.text()
          const parsed = parseGpxOrTcx(text, file.name)
          allTracks.push(...parsed)
        } catch (err) {
          setImportError(
            `${file.name}: ${err instanceof Error ? err.message : 'Error desconegut'}`
          )
        }
      }
      for (const t of allTracks) {
        await saveTrack(t, user!.uid)
      }
      allTracks.forEach((t) => addLayer(t))
      await getTracks(user!.uid).then(({ tracks: t }) => setTracks(t))
    } finally {
      setImportLoading(false)
    }
    e.target.value = ''
  }

  const addedIds = new Set(layers.map((l) => l.track.id))
  const availableTracks = tracks.filter((t) => !addedIds.has(t.id))

  const center: [number, number] = [41.6, 1.5]

  if (!user) {
    return (
      <div className="map-view">
        <div className="map-view-message">
          <p>Inicia sessió per crear mapes amb les teves rutes.</p>
          <Link to="/login" className="map-view-login">
            Entrar
          </Link>
        </div>
      </div>
    )
  }

  if (!isDesktop) {
    return (
      <div className="map-view">
        <div className="map-view-message">
          <p>Aquesta vista només està disponible a l'escriptori.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-view map-view-desktop">
      {importLoading && (
        <div className="map-view-import-loader" aria-live="polite" aria-busy="true">
          <div className="map-view-import-spinner" />
          <p>Carregant capes GPX / TCX…</p>
        </div>
      )}
      <div className={`map-view-sidebar-wrap ${sidebarOpen ? '' : 'map-view-sidebar-hidden'}`}>
        <aside className="map-view-sidebar">
        <section className="map-view-section">
          <h3>Els meus tracks</h3>
          {loading ? (
            <p className="map-view-hint">Carregant...</p>
          ) : availableTracks.length === 0 && layers.length === 0 ? (
            <p className="map-view-hint">
              No tens tracks. <Link to="/">Grava una ruta</Link> per començar.
            </p>
          ) : availableTracks.length === 0 ? (
            <p className="map-view-hint">Tots els tracks ja estan al mapa.</p>
          ) : (
            <ul className="map-view-track-list">
              {availableTracks.map((track) => {
                const distance = calculateTrackDistance(track.points)
                const duration =
                  track.points.length > 1
                    ? (track.points[track.points.length - 1].timestamp -
                        track.points[0].timestamp) /
                      1000
                    : 0
                return (
                  <li key={track.id} className="map-view-track-card">
                    <div className="map-view-track-info">
                      <span className="map-view-track-name">{track.name}</span>
                      <span className="map-view-track-meta">
                        {formatDistanceKm(distance)} · {formatDuration(duration)}
                      </span>
                    </div>
                    <div className="map-view-track-actions">
                      <button
                        type="button"
                        className="map-view-add-layer-btn"
                        onClick={() => addLayer(track)}
                      >
                        Afegir al mapa
                      </button>
                      <Link
                        to={`/tracks/${track.id}`}
                        state={{ from: '/mapa' }}
                        className="map-view-detail-link"
                      >
                        Detall
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="map-view-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,.tcx"
            multiple
            className="map-view-file-input"
            onChange={handleFileImport}
            aria-label="Carregar GPX o TCX"
          />
          <button
            type="button"
            className="map-view-import-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
          >
            Carregar GPX / TCX
          </button>
          {importError && (
            <p className="map-view-import-error" role="alert">
              {importError}
            </p>
          )}
        </section>

        {layers.length > 0 && (
        <section className="map-view-section">
          <h3>Capes al mapa</h3>
          <ul className="map-view-layer-list">
            {layers.map((layer) => (
                <li
                  key={layer.track.id}
                  className={`map-view-layer-item ${layer.visible ? '' : 'disabled'}`}
                >
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={(e) =>
                      setLayerVisible(layer.track.id, e.target.checked)
                    }
                  />
                  <div className="map-view-layer-color-wrap">
                    <button
                      type="button"
                      className="map-view-layer-color map-view-layer-color-btn"
                      style={{ backgroundColor: layer.color }}
                      onClick={() =>
                        setOpenColorPicker(
                          openColorPicker === layer.track.id ? null : layer.track.id
                        )
                      }
                      title="Canviar color"
                      aria-label="Canviar color"
                    />
                    {openColorPicker === layer.track.id && (
                      <div className="map-view-color-picker">
                        {LAYER_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            className={`map-view-color-opt ${layer.color === c.hex ? 'active' : ''}`}
                            style={{ backgroundColor: c.hex }}
                            onClick={() => {
                              setLayerColor(layer.track.id, c.hex)
                              setOpenColorPicker(null)
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/tracks/${layer.track.id}`}
                    state={{ from: '/mapa' }}
                    className="map-view-layer-name"
                  >
                    {layer.track.name}
                  </Link>
                  <button
                    type="button"
                    className="map-view-info-btn"
                    onClick={() => setLayerInfoId(layer.track.id)}
                    title="Informació de la capa"
                    aria-label="Informació"
                  >
                    ⓘ
                  </button>
                  <button
                    type="button"
                    className="map-view-remove-btn"
                    onClick={() => removeLayer(layer.track.id)}
                    title="Treure del mapa"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
        </section>
        )}
        </aside>
      </div>

      <div className="map-view-map">
        {sidebarOpen && (
          <button
            type="button"
            className="map-view-sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
            title="Amagar capes (pantalla completa)"
            aria-label="Amagar capes"
          >
            ‹
          </button>
        )}
        <MapContainer
          center={center}
          zoom={8}
          className="map"
          style={{ height: '100%', width: '100%' }}
          rotate={isMobile}
          bearing={0}
          touchRotate={isMobile}
          rotateControl={false}
        >
          <TileLayer
            key={basemap.id}
            attribution={basemap.attribution}
            url={basemap.url}
            tms={basemap.tms}
          />
          <MapResizeHandler sidebarOpen={sidebarOpen} />
          <BasemapChangeHandler basemapId={basemap.id} />
          <MapNorthButton visible={isMobile} />
          {layers.length > 0 && <FitAllLayers layers={layers} />}
          {layers
            .filter((l) => l.visible)
            .map((layer) => {
              const latlngs: [number, number][] = layer.track.points.map(
                (p) => [p.lat, p.lng]
              )
              if (latlngs.length < 2) return null
              return (
                <Polyline
                  key={layer.track.id}
                  positions={latlngs}
                  pathOptions={{
                    color: layer.color,
                    weight: 5,
                    opacity: 0.9,
                  }}
                />
              )
            })}
        </MapContainer>
        <MapLayerControl />
        {!sidebarOpen && (
          <button
            type="button"
            className="map-view-sidebar-show"
            onClick={() => setSidebarOpen(true)}
            title="Mostrar capes"
            aria-label="Mostrar capes"
          >
            ›
          </button>
        )}
      </div>

      {layerInfoId && (() => {
        const layer = layers.find((l) => l.track.id === layerInfoId)
        if (!layer) return null
        const t = layer.track
        const distance = calculateTrackDistance(t.points)
        const duration =
          t.points.length > 1
            ? (t.points[t.points.length - 1].timestamp - t.points[0].timestamp) / 1000
            : 0
        const hasAltitude = t.points.some((p) => p.altitude != null)
        const altValues = t.points
          .map((p) => p.altitude)
          .filter((a): a is number => a != null)
        const altMin = altValues.length ? Math.min(...altValues) : null
        const altMax = altValues.length ? Math.max(...altValues) : null
        const cumulDists = cumulativeDistances(t.points)
        const profilePoints =
          hasAltitude && altMin != null && altMax != null && altMax > altMin
            ? t.points
                .map((p, i) => ({
                  dist: cumulDists[i] / 1000,
                  alt: p.altitude ?? altMin,
                }))
            : []
        return (
          <div
            className="map-view-info-overlay"
            onClick={() => setLayerInfoId(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="layer-info-title"
          >
            <div
              className="map-view-info-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="map-view-info-header">
                <h3 id="layer-info-title" className="map-view-info-title">
                  {t.name}
                </h3>
                <button
                  type="button"
                  className="map-view-info-close"
                  onClick={() => setLayerInfoId(null)}
                  aria-label="Tancar"
                >
                  ×
                </button>
              </div>
              <dl className="map-view-info-meta">
                <div className="map-view-info-row">
                  <dt>Distància</dt>
                  <dd>{formatDistanceKm(distance)}</dd>
                </div>
                <div className="map-view-info-row">
                  <dt>Durada</dt>
                  <dd>{formatDuration(duration)}</dd>
                </div>
                <div className="map-view-info-row">
                  <dt>Punts</dt>
                  <dd>{t.points.length}</dd>
                </div>
                {hasAltitude && altMin != null && altMax != null && (
                  <>
                    <div className="map-view-info-row">
                      <dt>Alt. mín.</dt>
                      <dd>{Math.round(altMin)} m</dd>
                    </div>
                    <div className="map-view-info-row">
                      <dt>Alt. màx.</dt>
                      <dd>{Math.round(altMax)} m</dd>
                    </div>
                    {profilePoints.length > 1 && (
                      <div className="map-view-profile-wrap">
                        <span className="map-view-profile-label">
                          Perfil d&apos;elevació (km · m)
                        </span>
                        <ElevationProfile
                          points={profilePoints}
                          altMin={altMin}
                          altMax={altMax}
                        />
                      </div>
                    )}
                  </>
                )}
              </dl>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
