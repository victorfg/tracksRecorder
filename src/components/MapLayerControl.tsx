import { useState, useRef, useEffect } from 'react'
import { useMapLayer } from '../contexts/MapLayerContext'
import { BASEMAPS } from '../config/basemaps'
import './MapLayerControl.css'

export function MapLayerControl() {
  const { basemap, setBasemap } = useMapLayer()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="map-layer-control" ref={ref}>
      <button
        type="button"
        className="map-layer-btn"
        onClick={() => setOpen(!open)}
        aria-label="Canviar capa del mapa"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z" />
        </svg>
      </button>
      {open && (
        <div className="map-layer-menu">
          <span className="map-layer-menu-title">Capa del mapa</span>
          <div className="map-layer-options">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`map-layer-opt ${b.id === basemap.id ? 'active' : ''}`}
                onClick={() => {
                  setBasemap(b.id)
                  setOpen(false)
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
