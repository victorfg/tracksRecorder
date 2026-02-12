import { useMap } from 'react-leaflet'

type Props = {
  visible?: boolean
}

/** Botó per tornar el mapa amb el nord amunt. Només visible i útil en mobile amb rotació. */
export function MapNorthButton({ visible = true }: Props) {
  const map = useMap()

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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <text x="12" y="18" textAnchor="middle" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">N</text>
      </svg>
    </button>
  )
}
