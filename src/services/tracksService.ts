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
import {
  saveTrack as saveTrackLocal,
  getTracks as getTracksLocal,
  deleteTrack as deleteTrackLocal,
} from '../storage'

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

export type GetTracksResult = {
  tracks: Track[]
  localOnlyIds: Set<string>
}

export async function getTracks(
  userId?: string | null
): Promise<GetTracksResult> {
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
      const cloudIds = new Set(cloudTracks.map((t) => t.id))
      const localTracks = await getTracksLocal()
      const localOnly = localTracks.filter((t) => !cloudIds.has(t.id))
      const localOnlyIds = new Set(localOnly.map((t) => t.id))
      const tracks = [...cloudTracks, ...localOnly].sort(
        (a, b) => b.createdAt - a.createdAt
      )
      return { tracks, localOnlyIds }
    } catch (err) {
      console.warn('Firestore fetch failed, using local:', err)
      const local = await getTracksLocal()
      return { tracks: local, localOnlyIds: new Set(local.map((t) => t.id)) }
    }
  }

  const local = await getTracksLocal()
  return { tracks: local, localOnlyIds: new Set(local.map((t) => t.id)) }
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

/** Puja un track a Firebase i l'esborra del local (ja no cal mantenir-lo en duplicat) */
export async function uploadTrackToCloud(
  track: Track,
  userId: string
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false
  try {
    await setDoc(trackDoc(userId, track.id), {
      name: track.name,
      points: track.points,
      startTime: track.startTime,
      endTime: track.endTime,
      createdAt: track.createdAt,
    })
    await deleteTrackLocal(track.id)
    return true
  } catch {
    return false
  }
}

/** Sincronitza automàticament: puja els local-only a la núvol i els elimina del local. */
export async function syncLocalTracksToCloud(
  userId: string
): Promise<{ synced: number }> {
  if (!isFirebaseConfigured()) return { synced: 0 }
  try {
    const cloudSnapshot = await getDocs(tracksCollection(userId))
    const cloudIds = new Set(cloudSnapshot.docs.map((d) => d.id))
    const localTracks = await getTracksLocal()
    const localOnly = localTracks.filter((t) => !cloudIds.has(t.id))
    let synced = 0
    for (const track of localOnly) {
      try {
        await setDoc(trackDoc(userId, track.id), {
          name: track.name,
          points: track.points,
          startTime: track.startTime,
          endTime: track.endTime,
          createdAt: track.createdAt,
        })
        await deleteTrackLocal(track.id)
        synced++
      } catch {
        // Fallida amb aquest, continua amb els altres
      }
    }
    return { synced }
  } catch {
    return { synced: 0 }
  }
}

export async function deleteTrack(
  id: string,
  userId?: string | null
): Promise<void> {
  await deleteTrackLocal(id)

  if (isFirebaseConfigured() && userId) {
    await deleteDoc(trackDoc(userId, id))
  }
}
