import { useEffect, useRef, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../contexts/AuthContext'
import { useMapLayer } from '../contexts/MapLayerContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { getTrack, saveTrack } from '../services/tracksService'
import type { Track } from '../types'
import {
  calculateTrackDistance,
  formatDistanceKm,
  formatDuration,
} from '../utils/geo'
import { addPointOnLineAt, simplifyTrackPoints, turfSlice, turfLength } from '../utils/turfUtils'
import { ConfirmModal } from './ConfirmModal'
import { MapLayerControl } from './MapLayerControl'
import { SimplifyModal } from './SimplifyModal'
import { MapNorthButton } from './MapNorthButton'
import { TrackEditControl } from './TrackEditControl'

function BasemapChangeHandler({ basemapId }: { basemapId: string }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(t)
  }, [map, basemapId])
  return null
}

function MapResizeHandler({ infoHeight }: { infoHeight: number }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(t)
  }, [map, infoHeight])
  return null
}

function FitBounds({
  positions,
  enabled = true,
}: {
  positions: [number, number][]
  enabled?: boolean
}) {
  const map = useMap()
  useEffect(() => {
    if (!enabled || positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0], 17)
      return
    }
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 })
  }, [map, positions, enabled])
  return null
}

const DEFAULT_TRACK_COLOR = '#22c55e'
const DEFAULT_TRACK_WEIGHT = 5

const vertexIcon = L.divIcon({
  className: 'track-edit-vertex',
  html: '<div class="track-edit-vertex-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const selectedVertexIcon = L.divIcon({
  className: 'track-edit-vertex track-edit-vertex-selected',
  html: '<div class="track-edit-vertex-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const startVertexIcon = L.divIcon({
  className: 'track-edit-vertex track-edit-vertex-start',
  html: '<div class="track-edit-vertex-dot">Inici</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const endVertexIcon = L.divIcon({
  className: 'track-edit-vertex track-edit-vertex-end',
  html: '<div class="track-edit-vertex-dot">Fi</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const startMarkerIcon = L.divIcon({
  className: 'track-start-end-marker track-start-marker',
  html: '<div class="track-start-end-dot">Inici</div>',
  iconSize: [50, 28],
  iconAnchor: [25, 14],
})

const endMarkerIcon = L.divIcon({
  className: 'track-start-end-marker track-end-marker',
  html: '<div class="track-start-end-dot">Fi</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const measureStartSelectedIcon = L.divIcon({
  className: 'track-edit-vertex track-edit-vertex-measure-start',
  html: '<div class="track-edit-vertex-dot">1</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const measureEndSelectedIcon = L.divIcon({
  className: 'track-edit-vertex track-edit-vertex-measure-end',
  html: '<div class="track-edit-vertex-dot">2</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

type EditableMapContentProps = {
  track: Track
  editMode: boolean
  selectedIndex: number | null
  measureSegmentMode: boolean
  measureStartIndex: number | null
  measureEndIndex: number | null
  onUpdatePoint: (index: number, lat: number, lng: number) => void
  onAddPointAt: (lat: number, lng: number) => void
  onSelectPoint: (index: number | null) => void
  onSelectPointForMeasure: (index: number) => void
}

function EditableMapContent({
  track,
  editMode,
  selectedIndex,
  measureSegmentMode,
  measureStartIndex,
  measureEndIndex,
  onUpdatePoint,
  onAddPointAt,
  onSelectPoint,
  onSelectPointForMeasure,
}: EditableMapContentProps) {
  const latlngs: [number, number][] = track.points.map((p) => [p.lat, p.lng])
  const measureSegmentLatlngs: [number, number][] | null =
    measureStartIndex != null && measureEndIndex != null && measureStartIndex !== measureEndIndex
      ? turfSlice(track.points, Math.min(measureStartIndex, measureEndIndex), Math.max(measureStartIndex, measureEndIndex))
          .map((p) => [p.lat, p.lng] as [number, number])
      : null

  return (
    <>
      <FitBounds positions={latlngs} enabled={!editMode} />
      {measureSegmentLatlngs && measureSegmentLatlngs.length > 1 && (
        <Polyline
          positions={measureSegmentLatlngs}
          pathOptions={{
            color: '#3b82f6',
            weight: 6,
            opacity: 1,
          }}
        />
      )}
      {latlngs.length > 1 && (
        <Polyline
          positions={latlngs}
          pathOptions={{
            color: DEFAULT_TRACK_COLOR,
            weight: editMode ? 4 : DEFAULT_TRACK_WEIGHT,
            opacity: 0.9,
          }}
          eventHandlers={
            editMode
              ? {
                  dblclick: (e: L.LeafletMouseEvent) => {
                    const { lat, lng } = e.latlng
                    onAddPointAt(lat, lng)
                  },
                }
              : undefined
          }
        />
      )}
      {!editMode && latlngs.length >= 2 && (
        <>
          <Marker position={latlngs[0]} icon={startMarkerIcon} />
          <Marker position={latlngs[latlngs.length - 1]} icon={endMarkerIcon} />
        </>
      )}
      {editMode &&
        track.points.map((p, i) => {
          const isFirst = i === 0
          const isLast = i === track.points.length - 1
          const isMeasureStart = measureSegmentMode && i === measureStartIndex
          const isMeasureEnd = measureSegmentMode && measureEndIndex != null && i === measureEndIndex
          const icon = measureSegmentMode
            ? isMeasureStart
              ? measureStartSelectedIcon
              : isMeasureEnd
                ? measureEndSelectedIcon
                : vertexIcon
            : selectedIndex === i
              ? selectedVertexIcon
              : isFirst
                ? startVertexIcon
                : isLast
                  ? endVertexIcon
                  : vertexIcon
          return (
          <Marker
            key={i}
            position={[p.lat, p.lng]}
            icon={icon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onUpdatePoint(i, lat, lng)
              },
              click: () => {
                if (measureSegmentMode) {
                  onSelectPointForMeasure(i)
                } else {
                  onSelectPoint(selectedIndex === i ? null : i)
                }
              },
            }}
          />
          )
        })}
    </>
  )
}

export function TrackDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const backTo = (location.state as { from?: string } | null)?.from ?? '/tracks'

  const { user } = useAuth()
  const { basemap } = useMapLayer()
  const [track, setTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false)
  const [showSimplifyModal, setShowSimplifyModal] = useState(false)
  const [measureSegmentMode, setMeasureSegmentMode] = useState(false)
  const [measureStartIndex, setMeasureStartIndex] = useState<number | null>(null)
  const [measureEndIndex, setMeasureEndIndex] = useState<number | null>(null)
  const isMobile = useIsMobile()
  const trackDetailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const savedTrackRef = useRef<Track | null>(null)
  const hasUnsavedChangesRef = useRef(false)
  const undoStackRef = useRef<Track[]>([])
  const MAX_UNDO = 50

  const pushUndoState = () => {
    if (!track) return
    if (undoStackRef.current.length >= MAX_UNDO) undoStackRef.current.shift()
    undoStackRef.current.push(JSON.parse(JSON.stringify(track)))
  }

  const handleUndo = () => {
    const prev = undoStackRef.current.pop()
    if (!prev) return
    setTrack(prev)
    setSelectedIndex(null)
    hasUnsavedChangesRef.current =
      !savedTrackRef.current || JSON.stringify(prev.points) !== JSON.stringify(savedTrackRef.current.points)
  }

  const updatePoint = (index: number, lat: number, lng: number) => {
    if (!track) return
    pushUndoState()
    hasUnsavedChangesRef.current = true
    const next = [...track.points]
    next[index] = { ...next[index], lat, lng }
    setTrack({ ...track, points: next })
  }

  const removePoint = (index: number) => {
    if (!track || track.points.length <= 2) return
    pushUndoState()
    hasUnsavedChangesRef.current = true
    const next = track.points.filter((_, i) => i !== index)
    setTrack({
      ...track,
      points: next,
      startTime: next[0]?.timestamp ?? track.startTime,
      endTime: next[next.length - 1]?.timestamp ?? track.endTime,
    })
    setSelectedIndex(null)
  }

  const handleSimplifyPoints = (tolerance: number) => {
    if (!track || track.points.length < 3) return
    pushUndoState()
    hasUnsavedChangesRef.current = true
    const simplified = simplifyTrackPoints(track.points, tolerance)
    const next = [...simplified]
    setTrack({
      ...track,
      points: next,
      startTime: next[0]?.timestamp ?? track.startTime,
      endTime: next[next.length - 1]?.timestamp ?? track.endTime,
    })
    setSelectedIndex(null)
    setShowSimplifyModal(false)
  }

  const addPointAtClick = (lat: number, lng: number) => {
    if (!track || track.points.length < 2) return
    pushUndoState()
    hasUnsavedChangesRef.current = true
    const result = addPointOnLineAt(track.points, lat, lng)
    if (!result) return
    const { point, insertAfterIndex } = result
    const next = [...track.points]
    next.splice(insertAfterIndex + 1, 0, point)
    setTrack({
      ...track,
      points: next,
      startTime: next[0].timestamp,
      endTime: next[next.length - 1].timestamp,
    })
  }

  const handleSavePoints = async () => {
    if (!track || track.points.length < 2) return
    setProcessing(true)
    await saveTrack(track, user?.uid ?? undefined)
    savedTrackRef.current = JSON.parse(JSON.stringify(track))
    hasUnsavedChangesRef.current = false
    setProcessing(false)
    setEditMode(false)
    setSelectedIndex(null)
    undoStackRef.current = []
  }

  const handleToggleEditMode = (): boolean => {
    if (editMode) {
      if (hasUnsavedChangesRef.current) {
        setShowExitConfirmModal(true)
        return false
      }
      setSelectedIndex(null)
    }
    setMeasureSegmentMode(false)
    setMeasureStartIndex(null)
    setMeasureEndIndex(null)
    setEditMode((v) => !v)
    return true
  }

  const handleToggleMeasureSegment = () => {
    setMeasureSegmentMode((m) => !m)
    setMeasureStartIndex(null)
    setMeasureEndIndex(null)
  }

  const handleSelectPointForMeasure = (index: number) => {
    if (measureStartIndex == null || (measureStartIndex != null && measureEndIndex != null)) {
      setMeasureStartIndex(index)
      setMeasureEndIndex(null)
    } else {
      setMeasureEndIndex(index)
    }
  }

  const handleConfirmExitWithoutSave = () => {
    undoStackRef.current = []
    setMeasureSegmentMode(false)
    setMeasureStartIndex(null)
    setMeasureEndIndex(null)
    if (savedTrackRef.current) {
      setTrack(JSON.parse(JSON.stringify(savedTrackRef.current)))
      hasUnsavedChangesRef.current = false
    }
    setSelectedIndex(null)
    setEditMode(false)
    setShowExitConfirmModal(false)
  }

  useEffect(() => {
    if (id) {
      getTrack(id, user?.uid).then((data) => {
        const t = data ?? null
        setTrack(t)
        savedTrackRef.current = t ? JSON.parse(JSON.stringify(t)) : null
        hasUnsavedChangesRef.current = false
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
        <Link to={backTo} className="track-back">Els meus tracks</Link>
      </div>
    )
  }

  const distance = calculateTrackDistance(track.points)
  const duration =
    track.points.length > 1
      ? (track.points[track.points.length - 1].timestamp - track.points[0].timestamp) / 1000
      : 0
  const center: [number, number] = track.points[0]
    ? [track.points[0].lat, track.points[0].lng]
    : [41.6, 1.5]

  const hasAltitude = track.points.some((p) => p.altitude != null)
  const altValues = track.points
    .map((p) => p.altitude)
    .filter((a): a is number => a != null)
  const altMin = altValues.length ? Math.min(...altValues) : null
  const altMax = altValues.length ? Math.max(...altValues) : null

  return (
    <div className="track-detail" ref={trackDetailRef}>
      <div className="track-detail-header track-detail-header-compact">
        <h2 className="track-info-title">{track.name}</h2>
        <div className="track-info-stats">
          <div className="track-info-stat">
            <span className="track-info-stat-label">Distància</span>
            <span className="track-info-stat-value">{formatDistanceKm(distance)}</span>
          </div>
          <div className="track-info-stat">
            <span className="track-info-stat-label">Durada</span>
            <span className="track-info-stat-value">{formatDuration(duration)}</span>
          </div>
          {hasAltitude && altMin != null && altMax != null && (
            <div className="track-info-stat">
              <span className="track-info-stat-label">Altitud</span>
              <span className="track-info-stat-value">{Math.round(altMin)}–{Math.round(altMax)} m</span>
            </div>
          )}
        </div>
      </div>
      <div className="track-detail-map">
        {isDesktop && editMode && !measureSegmentMode && selectedIndex != null && (
          <div className="track-edit-selected-bar">
            <span>Punt {selectedIndex + 1} seleccionat</span>
            <button
              type="button"
              className="track-edit-selected-eliminar"
              onClick={() => removePoint(selectedIndex)}
              disabled={track.points.length <= 2}
            >
              Eliminar punt
            </button>
          </div>
        )}
        {isDesktop && editMode && measureSegmentMode && measureStartIndex != null && measureEndIndex != null && measureStartIndex !== measureEndIndex && (
          <div className="track-edit-selected-bar track-edit-measure-bar">
            <span>
              Distància: {formatDistanceKm(
                turfLength(turfSlice(track.points, Math.min(measureStartIndex, measureEndIndex), Math.max(measureStartIndex, measureEndIndex)))
              )}
            </span>
            <span className="track-edit-measure-points">
              Punt {Math.min(measureStartIndex, measureEndIndex) + 1} → Punt {Math.max(measureStartIndex, measureEndIndex) + 1}
            </span>
          </div>
        )}
        {isDesktop && editMode && track.points.length >= 2 && (
          <div className="track-edit-add-hint">
            {measureSegmentMode ? (
              <>
                <span><strong>Clica</strong> un punt per marcar l&apos;inici del segment</span>
                {measureStartIndex != null && (
                  <span><strong>Clica</strong> un altre punt per marcar el final</span>
                )}
              </>
            ) : (
              <>
                <span><strong>Arrossega</strong> punts per moure&apos;ls</span>
                <span><strong>Doble clic</strong> a la línia verda per afegir punt</span>
                <span><strong>Clica</strong> un punt per seleccionar i eliminar-lo</span>
              </>
            )}
          </div>
        )}
        <MapContainer
          center={center}
          zoom={15}
          maxZoom={20}
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
            maxZoom={basemap.maxZoom}
            maxNativeZoom={basemap.maxZoom}
          />
          <BasemapChangeHandler basemapId={basemap.id} />
          <MapNorthButton visible={isMobile} />
          <MapResizeHandler infoHeight={48} />
          <EditableMapContent
            track={track}
            editMode={isDesktop && editMode}
            selectedIndex={measureSegmentMode ? null : selectedIndex}
            measureSegmentMode={measureSegmentMode}
            measureStartIndex={measureStartIndex}
            measureEndIndex={measureEndIndex}
            onUpdatePoint={updatePoint}
            onAddPointAt={addPointAtClick}
            onSelectPoint={setSelectedIndex}
            onSelectPointForMeasure={handleSelectPointForMeasure}
          />
        </MapContainer>
        {isDesktop && (
          <TrackEditControl
            editMode={editMode}
            pointsCount={track.points.length}
            processing={processing}
            canUndo={undoStackRef.current.length > 0}
            measureSegmentMode={measureSegmentMode}
            onToggleEdit={handleToggleEditMode}
            onSave={handleSavePoints}
            onUndo={handleUndo}
            onToggleMeasureSegment={handleToggleMeasureSegment}
            onOpenSimplifyModal={() => setShowSimplifyModal(true)}
          />
        )}
        <MapLayerControl />
      </div>
      {showSimplifyModal && (
        <SimplifyModal
          onChoose={handleSimplifyPoints}
          onCancel={() => setShowSimplifyModal(false)}
        />
      )}
      {showExitConfirmModal && (
        <ConfirmModal
          title="Canvis sense desar"
          message="Hi ha canvis sense desar. Vols sortir sense desar-los?"
          confirmLabel="Sortir sense desar"
          cancelLabel="Continuar editant"
          confirmDanger={false}
          onConfirm={handleConfirmExitWithoutSave}
          onCancel={() => setShowExitConfirmModal(false)}
        />
      )}
    </div>
  )
}
