export interface TrackPoint {
  lat: number
  lng: number
  altitude: number | null
  accuracy: number
  timestamp: number
}

export interface Track {
  id: string
  name: string
  points: TrackPoint[]
  startTime: number
  endTime: number
  createdAt: number
}
