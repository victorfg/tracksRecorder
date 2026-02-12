import type { Track, TrackPoint } from '../types'

function generateId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toTrackPoint(
  lat: number,
  lng: number,
  altitude: number | null,
  timestamp: number
): TrackPoint {
  return {
    lat,
    lng,
    altitude,
    accuracy: 0,
    timestamp,
  }
}

function getElementText(parent: Element, tagName: string): string | null {
  const el = parent.querySelector(tagName)
  if (!el) return null
  const text = el.textContent?.trim()
  return text || null
}

/**
 * Parser GPX propi (sense dependències) per evitar bugs de gpxparser en mode estricte
 */
export function parseGpx(content: string): Track[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Error de format GPX')
  }

  const tracks: Track[] = []
  const gpxNs = 'http://www.topografix.com/GPX/1/1'

  // Tracks: trk > trkseg > trkpt (o trkpt directe)
  let trkElements: Element[] = Array.from(doc.querySelectorAll('trk'))
  if (trkElements.length === 0 && doc.documentElement.namespaceURI === gpxNs) {
    trkElements = Array.from(doc.getElementsByTagNameNS(gpxNs, 'trk'))
  }
  for (const trk of trkElements) {
    const trkpts = trk.querySelectorAll('trkpt')
    if (trkpts.length === 0) continue

    const points: TrackPoint[] = []
    for (const trkpt of trkpts) {
      const lat = parseFloat(trkpt.getAttribute('lat') ?? '0')
      const lng = parseFloat(trkpt.getAttribute('lon') ?? '0')
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue

      const eleText = getElementText(trkpt, 'ele')
      const altitude = eleText ? parseFloat(eleText) : null

      const timeText = getElementText(trkpt, 'time')
      const timestamp = timeText ? new Date(timeText).getTime() : Date.now()

      points.push(toTrackPoint(lat, lng, altitude, timestamp))
    }

    if (points.length === 0) continue

    const name = getElementText(trk, 'name') || `Ruta GPX ${tracks.length + 1}`
    const startTime = points[0].timestamp
    const endTime = points[points.length - 1].timestamp

    tracks.push({
      id: generateId(),
      name,
      points,
      startTime,
      endTime,
      createdAt: Date.now(),
    })
  }

  // Si no hi ha tracks, prova routes
  if (tracks.length === 0) {
    let rteElements: Element[] = Array.from(doc.querySelectorAll('rte'))
    if (rteElements.length === 0 && doc.documentElement.namespaceURI === gpxNs) {
      rteElements = Array.from(doc.getElementsByTagNameNS(gpxNs, 'rte'))
    }
    for (const rte of rteElements) {
      const rtepts = rte.querySelectorAll('rtept')
      if (rtepts.length === 0) continue

      const points: TrackPoint[] = []
      for (const rtept of rtepts) {
        const lat = parseFloat(rtept.getAttribute('lat') ?? '0')
        const lng = parseFloat(rtept.getAttribute('lon') ?? '0')
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue

        const eleText = getElementText(rtept, 'ele')
        const altitude = eleText ? parseFloat(eleText) : null

        const timeText = getElementText(rtept, 'time')
        const timestamp = timeText ? new Date(timeText).getTime() : Date.now()

        points.push(toTrackPoint(lat, lng, altitude, timestamp))
      }

      if (points.length === 0) continue

      const name = getElementText(rte, 'name') || `Ruta GPX ${tracks.length + 1}`
      const startTime = points[0].timestamp
      const endTime = points[points.length - 1].timestamp

      tracks.push({
        id: generateId(),
        name,
        points,
        startTime,
        endTime,
        createdAt: Date.now(),
      })
    }
  }

  return tracks
}

/**
 * Converteix un fitxer TCX a un o més Track
 * Suporta TCX 1.x i 2.x, amb o sense namespace
 */
export function parseTcx(content: string): Track[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Error de format TCX')
  }

  const tracks: Track[] = []
  const ns = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2'
  const ns2 = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v1'

  function getEl(parent: Element | Document, tag: string, useNs = true): Element | null {
    if (useNs) {
      const byNs = parent.getElementsByTagNameNS(ns, tag)
      if (byNs.length > 0) return byNs[0]
      const byNs2 = parent.getElementsByTagNameNS(ns2, tag)
      if (byNs2.length > 0) return byNs2[0]
    }
    const byName = parent.getElementsByTagName(tag)
    return byName[0] ?? null
  }

  function getAllEl(parent: Element, tag: string): Element[] {
    const byNs = parent.getElementsByTagNameNS(ns, tag)
    if (byNs.length > 0) return Array.from(byNs)
    const byNs2 = parent.getElementsByTagNameNS(ns2, tag)
    if (byNs2.length > 0) return Array.from(byNs2)
    return Array.from(parent.getElementsByTagName(tag))
  }

  const root = doc.documentElement

  // Format Activities/Activity (registre d'activitat)
  let activities = getAllEl(root, 'Activity')
  if (activities.length === 0) {
    const activitiesContainer = getEl(root, 'Activities') ?? doc.querySelector('Activities')
    if (activitiesContainer) {
      activities = getAllEl(activitiesContainer as Element, 'Activity')
    }
  }

  // Format Courses/Course (rutes/trekking, ex. Wikiloc)
  let courses: Element[] = []
  if (activities.length === 0) {
    const coursesContainer = getEl(root, 'Courses') ?? doc.querySelector('Courses')
    if (coursesContainer) {
      courses = getAllEl(coursesContainer as Element, 'Course')
    }
    if (courses.length === 0) {
      courses = Array.from(doc.querySelectorAll('Course'))
    }
  }

  const containers = activities.length > 0 ? activities : courses
  if (containers.length === 0) {
    activities = Array.from(doc.querySelectorAll('Activity'))
  }
  const items = activities.length > 0 ? activities : containers

  for (let a = 0; a < items.length; a++) {
    const item = items[a]
    const itemName =
      item.getAttribute?.('Sport') ??
      getEl(item, 'Name')?.textContent?.trim() ??
      `Ruta TCX ${a + 1}`

    const allPoints: TrackPoint[] = []
    let firstTime: number | null = null
    let lastTime: number | null = null

    function parseTrackpointsFromTrack(trackElement: Element) {
      const trackpoints = getAllEl(trackElement, 'Trackpoint')
      for (const tp of trackpoints) {
        const pos = getEl(tp, 'Position')
        if (!pos) continue

        const latEl = getEl(pos, 'LatitudeDegrees')
        const lngEl = getEl(pos, 'LongitudeDegrees')
        if (!latEl || !lngEl) continue

        const lat = parseFloat(latEl.textContent ?? '0')
        const lng = parseFloat(lngEl.textContent ?? '0')
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue

        const timeEl = getEl(tp, 'Time')
        const timestamp = timeEl
          ? new Date(timeEl.textContent ?? '').getTime()
          : Date.now()

        const altEl = getEl(tp, 'AltitudeMeters')
        const altitude = altEl ? parseFloat(altEl.textContent ?? '0') : null

        const pt = toTrackPoint(lat, lng, altitude, timestamp)
        allPoints.push(pt)
        if (firstTime === null) firstTime = timestamp
        lastTime = timestamp
      }
    }

    // Course: Track és fill directe. Activity: Track dins Lap
    const directTrack = Array.from(item.children).find(
      (c) => c.localName === 'Track'
    )
    if (directTrack) {
      parseTrackpointsFromTrack(directTrack)
    } else {
      const laps = getAllEl(item, 'Lap')
      for (const lap of laps) {
        const lapTrack = getEl(lap, 'Track')
        if (lapTrack) parseTrackpointsFromTrack(lapTrack)
      }
    }

    if (allPoints.length > 0) {
      tracks.push({
        id: generateId(),
        name: itemName,
        points: allPoints,
        startTime: firstTime ?? Date.now(),
        endTime: lastTime ?? Date.now(),
        createdAt: Date.now(),
      })
    }
  }

  return tracks
}

/**
 * Detecta el format i parseja (GPX o TCX)
 */
export function parseGpxOrTcx(content: string, filename: string): Track[] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.gpx')) {
    return parseGpx(content)
  }
  if (lower.endsWith('.tcx')) {
    return parseTcx(content)
  }
  if (content.includes('<gpx') && content.includes('</gpx>')) {
    return parseGpx(content)
  }
  if (content.includes('TrainingCenterDatabase') || content.includes('<TrainingCenterDatabase')) {
    return parseTcx(content)
  }
  throw new Error('Format no reconegut. Utilitza GPX o TCX.')
}
