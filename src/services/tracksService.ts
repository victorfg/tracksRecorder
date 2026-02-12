import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import type { Track, TrackPoint } from '../types'
import { saveTrack as saveTrackLocal, getTracks as getTracksLocal } from '../storage'

function tracksCollection(userId: string) {
  return collection(db, 'users', userId, 'tracks')
}

function trackDoc(userId: string, trackId: string) {
  return doc(db, 'users', userId, 'tracks', trackId)
}

function firestoreToTrack(id: string, data: Record<string, unknown>): Track {
  return {
    id,
    name: data.name as string,
    points: data.points as TrackPoint[],
    startTime: data.startTime as number,
    endTime: data.endTime as number,
    createdAt: data.createdAt as number,
  }
}

export async function saveTrack(track: Track, userId?: string): Promise<void> {
  await saveTrackLocal(track)

  if (isFirebaseConfigured() && userId) {
    await setDoc(trackDoc(userId, track.id), {
      name: track.name,
      points: track.points,
      startTime: track.startTime,
      endTime: track.endTime,
      createdAt: track.createdAt,
    })
  }
}

export async function getTracks(userId?: string | null): Promise<Track[]> {
  if (isFirebaseConfigured() && userId) {
    try {
      const q = query(
        tracksCollection(userId),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      const cloudTracks = snapshot.docs.map((d) =>
        firestoreToTrack(d.id, d.data())
      )
      const localTracks = await getTracksLocal()
      const cloudIds = new Set(cloudTracks.map((t) => t.id))
      const localOnly = localTracks.filter((t) => !cloudIds.has(t.id))
      return [...cloudTracks, ...localOnly].sort(
        (a, b) => b.createdAt - a.createdAt
      )
    } catch (err) {
      console.warn('Firestore fetch failed, using local:', err)
      return getTracksLocal()
    }
  }

  return getTracksLocal()
}

export async function getTrack(
  id: string,
  userId?: string | null
): Promise<Track | undefined> {
  if (isFirebaseConfigured() && userId) {
    const docSnap = await getDoc(trackDoc(userId, id))
    if (docSnap.exists()) {
      return firestoreToTrack(docSnap.id, docSnap.data())
    }
  }

  const { getTrack: getLocal } = await import('../storage')
  return getLocal(id)
}
