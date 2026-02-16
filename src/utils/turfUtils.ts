/**
 * Utilitats per jugar amb Turf.js i els tracks.
 * Turf usa GeoJSON: coordenades [lng, lat] (o [lng, lat, alt])
 */
import * as turf from '@turf/turf'
import type { TrackPoint } from '../types'

// Re-exportar turf per usar-lo directament on calgui
export { turf }

// --- Conversió TrackPoint ↔ GeoJSON ---

/** Converteix TrackPoint[] a GeoJSON LineString */
export function pointsToLineString(points: TrackPoint[]) {
  const coords = points.map((p) => [p.lng, p.lat] as [number, number])
  return turf.lineString(coords)
}

/** Converteix TrackPoint[] a GeoJSON FeatureCollection de punts */
export function pointsToPointsCollection(points: TrackPoint[]) {
  const features = points.map((p) => turf.point([p.lng, p.lat]))
  return turf.featureCollection(features)
}

/** Converteix coordenades GeoJSON [lng, lat] a TrackPoint (amb valors per defecte) */
function coordToTrackPoint(coord: number[], prevPoint?: TrackPoint): TrackPoint {
  return {
    lat: coord[1],
    lng: coord[0],
    altitude: coord.length > 2 ? coord[2] : null,
    accuracy: prevPoint?.accuracy ?? 0,
    timestamp: prevPoint?.timestamp ?? Date.now(),
  }
}

/** Converteix LineString GeoJSON de tornada a TrackPoint[] (interpolant timestamps si cal) */
export function lineStringToPoints(
  line: ReturnType<typeof turf.lineString>,
  originalPoints?: TrackPoint[]
): TrackPoint[] {
  const geom = line as { geometry?: { coordinates: number[][] } }
  const coords = geom.geometry?.coordinates ?? []
  if (coords.length === 0) return []

  const t0 = originalPoints?.[0]?.timestamp ?? Date.now()
  const t1 = originalPoints?.[originalPoints.length - 1]?.timestamp ?? Date.now()

  return coords.map((coord: number[], i: number) => {
    const prev = originalPoints?.[i]
    const interp = coords.length > 1 ? i / (coords.length - 1) : 0
    const ts = prev?.timestamp ?? Math.round(t0 + interp * (t1 - t0))
    return {
      ...coordToTrackPoint(coord, prev),
      timestamp: ts,
    }
  })
}

// --- Operacions útils per tracks ---

/** Longitud del track en metres (equivalent a calculateTrackDistance però amb Turf) */
export function turfLength(points: TrackPoint[]): number {
  if (points.length < 2) return 0
  return turf.length(pointsToLineString(points), { units: 'meters' })
}

/** Talla el track entre dues distàncies (en km des de l'inici) */
export function turfLineSliceAlong(
  points: TrackPoint[],
  startKm: number,
  stopKm: number
): TrackPoint[] {
  if (points.length < 2 || startKm >= stopKm) return []
  const line = pointsToLineString(points)
  const totalKm = turf.length(line, { units: 'kilometers' })
  const start = Math.max(0, Math.min(startKm, totalKm - 0.001))
  const stop = Math.min(totalKm, Math.max(stopKm, start + 0.001))
  const sliced = turf.lineSliceAlong(line, start, stop, { units: 'kilometers' })
  return lineStringToPoints(sliced, points)
}

/** Talla el track entre dos punts (índexs). Retorna el segment. */
export function turfSlice(
  points: TrackPoint[],
  startIndex: number,
  stopIndex: number
): TrackPoint[] {
  if (points.length < 2 || startIndex >= stopIndex) return []
  const line = pointsToLineString(points)
  const start = turf.point([points[startIndex].lng, points[startIndex].lat])
  const stop = turf.point([points[stopIndex].lng, points[stopIndex].lat])
  const sliced = turf.lineSlice(start, stop, line)
  return lineStringToPoints(sliced, points.slice(startIndex, stopIndex + 1))
}

/** Punt a distància X (metres) des del inici de la línia */
export function turfAlong(points: TrackPoint[], distanceM: number): [number, number] | null {
  if (points.length < 2) return null
  const line = pointsToLineString(points)
  const pt = turf.along(line, distanceM, { units: 'meters' })
  const [lng, lat] = pt.geometry.coordinates
  return [lat, lng]
}

/**
 * Simplifica els punts del track amb l'algorisme Douglas-Peucker.
 * Redueix el nombre de punts mantenint la forma general de la ruta.
 * @param points Punts del track
 * @param tolerance Tolerància en graus (menor = més punts, major = menys punts). ~0.0001 ≈ 11m
 */
export function simplifyTrackPoints(
  points: TrackPoint[],
  tolerance = 0.0001
): TrackPoint[] {
  if (points.length < 3) return points
  const line = pointsToLineString(points)
  const simplified = turf.simplify(line, {
    tolerance,
    highQuality: true,
  })
  const geom = simplified as { geometry?: { coordinates: number[][] } }
  const coords = geom.geometry?.coordinates ?? []
  if (coords.length < 2) return points
  const range = [points[0], points[points.length - 1]]
  return lineStringToPoints(simplified, range)
}

/** Buffer al voltant de la línia (metres). Retorna un polígon. */
export function turfBuffer(points: TrackPoint[], radiusM = 10) {
  const line = pointsToLineString(points)
  return turf.buffer(line, radiusM, { units: 'meters' })
}

/** Bounding box del track: [[minLng, minLat], [maxLng, maxLat]] */
export function turfBbox(points: TrackPoint[]): [[number, number], [number, number]] {
  if (points.length === 0) return [[0, 0], [0, 0]]
  const fc = pointsToPointsCollection(points)
  const bbox = turf.bbox(fc)
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ]
}

/** Distància entre dos punts (metres) */
export function turfDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  return turf.distance(
    turf.point([p1.lng, p1.lat]),
    turf.point([p2.lng, p2.lat]),
    { units: 'meters' }
  )
}

/** Bearing entre dos punts (graus, 0=Nord) */
export function turfBearing(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  return turf.bearing(turf.point([p1.lng, p1.lat]), turf.point([p2.lng, p2.lat]))
}

/**
 * Troba el punt més proper sobre la línia a (lat, lng) i retorna
 * el nou TrackPoint a inserir i l'índex del segment (insertar després d'aquest índex).
 */
export function addPointOnLineAt(
  points: TrackPoint[],
  lat: number,
  lng: number
): { point: TrackPoint; insertAfterIndex: number } | null {
  if (points.length < 2) return null
  const line = pointsToLineString(points)
  const clickPt = turf.point([lng, lat])
  const nearest = turf.nearestPointOnLine(line, clickPt)
  const segmentIndex = (nearest.properties?.index ?? 0) as number
  const [newLng, newLat] = nearest.geometry.coordinates
  const a = points[segmentIndex]
  const b = points[Math.min(segmentIndex + 1, points.length - 1)]
  const ratio = segmentIndex < points.length - 1 ? 0.5 : 1
  const newPoint: TrackPoint = {
    lat: newLat,
    lng: newLng,
    altitude: a.altitude != null && b.altitude != null
      ? a.altitude + (b.altitude - a.altitude) * ratio
      : null,
    accuracy: 0,
    timestamp: Math.round(a.timestamp + (b.timestamp - a.timestamp) * ratio),
  }
  return { point: newPoint, insertAfterIndex: segmentIndex }
}
