import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
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

export type SaveTrackResult = {
  savedLocal: boolean
  savedCloud: boolean
}

export async function saveTrack(
  track: Track,
  userId?: string
): Promise<SaveTrackResult> {
  await saveTrackLocal(track)

  if (isFirebaseConfigured() && userId) {
    try {
      await setDoc(trackDoc(userId, track.id), {
        name: track.name,
        points: track.points,
        startTime: track.startTime,
        endTime: track.endTime,
        createdAt: track.createdAt,
      })
      return { savedLocal: true, savedCloud: true }
    } catch {
      return { savedLocal: true, savedCloud: false }
    }
  }

  return { savedLocal: true, savedCloud: false }
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

/** Puja a Firebase els tracks que només estan en local. Retorna quants s'han pujat. */
export async function syncLocalTracksToCloud(
  userId: string
): Promise<{ synced: number; failed: number }> {
  if (!isFirebaseConfigured()) return { synced: 0, failed: 0 }
  try {
    const cloudSnapshot = await getDocs(tracksCollection(userId))
    const cloudIds = new Set(cloudSnapshot.docs.map((d) => d.id))
    const localTracks = await getTracksLocal()
    const localOnly = localTracks.filter((t) => !cloudIds.has(t.id))
    let synced = 0
    let failed = 0
    for (const track of localOnly) {
      try {
        await setDoc(trackDoc(userId, track.id), {
          name: track.name,
          points: track.points,
          startTime: track.startTime,
          endTime: track.endTime,
          createdAt: track.createdAt,
        })
        synced++
      } catch {
        failed++
      }
    }
    return { synced, failed }
  } catch {
    return { synced: 0, failed: 0 }
  }
}

export async function deleteTrack(
  id: string,
  userId?: string | null
): Promise<void> {
  const { deleteTrack: deleteLocal } = await import('../storage')
  await deleteLocal(id)

  if (isFirebaseConfigured() && userId) {
    await deleteDoc(trackDoc(userId, id))
  }
}
