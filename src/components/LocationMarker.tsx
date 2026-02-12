import { useMemo } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'

/** Google Maps–style blue dot with optional direction cone. bearing: degrees (0=North), null = no cone */
function createLocationIcon(bearingDeg: number | null) {
  const size = 56
  const hasDirection = bearingDeg !== null

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <g transform="translate(${size / 2},${size / 2}) ${hasDirection ? `rotate(${bearingDeg})` : ''} translate(-${size / 2},-${size / 2})">
        ${hasDirection ? `
        <path
          d="M28 28 L28 2 L44 26 L12 26 Z"
          fill="#4285F4"
          fill-opacity="0.4"
          stroke="none"
        />
        ` : ''}
        <circle
          cx="28"
          cy="28"
          r="5"
          fill="#4285F4"
          stroke="white"
          stroke-width="2.5"
        />
      </g>
    </svg>
  `

  return L.divIcon({
    html: svg,
    className: 'location-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

type Props = {
  position: [number, number]
  bearing: number | null
}

export function LocationMarker({ position, bearing }: Props) {
  const icon = useMemo(() => createLocationIcon(bearing), [bearing])
  return <Marker position={position} icon={icon} zIndexOffset={1000} />
}
