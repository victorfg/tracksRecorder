import { createContext, useContext, useState, useCallback } from 'react'
import {
  BASEMAPS,
  type Basemap,
  type BasemapId,
  getStoredBasemapId,
  storeBasemapId,
} from '../config/basemaps'

type MapLayerContextValue = {
  basemap: Basemap
  setBasemap: (id: BasemapId) => void
}

const MapLayerContext = createContext<MapLayerContextValue | null>(null)

export function MapLayerProvider({ children }: { children: React.ReactNode }) {
  const [basemapId, setBasemapIdState] = useState<BasemapId>(getStoredBasemapId)

  const basemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]

  const setBasemap = useCallback((id: BasemapId) => {
    setBasemapIdState(id)
    storeBasemapId(id)
  }, [])


  return (
    <MapLayerContext.Provider value={{ basemap, setBasemap }}>
      {children}
    </MapLayerContext.Provider>
  )
}

export function useMapLayer() {
  const ctx = useContext(MapLayerContext)
  if (!ctx) throw new Error('useMapLayer must be used within MapLayerProvider')
  return ctx
}
