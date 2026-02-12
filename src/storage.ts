import { openDB } from 'idb'
import type { Track } from './types'

const DB_NAME = 'tracks-recorder'
const DB_VERSION = 1
const STORE_NAME = 'tracks'

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    },
  })
}

export async function saveTrack(track: Track): Promise<void> {
  const db = await initDB()
  await db.put(STORE_NAME, track)
}

export async function getTracks(): Promise<Track[]> {
  const db = await initDB()
  const tracks = await db.getAll(STORE_NAME)
  return tracks.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getTrack(id: string): Promise<Track | undefined> {
  const db = await initDB()
  return db.get(STORE_NAME, id)
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await initDB()
  await db.delete(STORE_NAME, id)
}
