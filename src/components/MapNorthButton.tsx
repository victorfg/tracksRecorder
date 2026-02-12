import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'

type Props = {
  visible?: boolean
}

/** Botó que mostra on és el nord (rota amb el mapa) i en clicar posa el nord amunt. */
export function MapNorthButton({ visible = true }: Props) {
  const map = useMap()
  const [bearing, setBearing] = useState(0)

  useEffect(() => {
    const updateBearing = () => {
      if (typeof map.getBearing === 'function') {
        setBearing(map.getBearing())
      }
    }
    updateBearing()
    map.on('rotate', updateBearing)
    return () => map.off('rotate', updateBearing)
  }, [map])

  if (!visible) return null

  const handleClick = () => {
    if (typeof map.setBearing === 'function') {
      map.setBearing(0)
    }
  }

  return (
    <button
      type="button"
      className="map-north-btn"
      onClick={handleClick}
      title="Nord amunt"
      aria-label="Posicionar el nord geogràfic amunt"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${bearing}deg)` }}>
        <text x="12" y="18" textAnchor="middle" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">N</text>
      </svg>
    </button>
  )
}
