import './ElevationProfile.css'

function axisTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min, max]
  const ticks: number[] = [min]
  for (let i = 1; i < count - 1; i++) {
    ticks.push(min + ((max - min) * i) / (count - 1))
  }
  ticks.push(max)
  return ticks
}

export function ElevationProfile({
  points,
  altMin,
  altMax,
}: {
  points: { dist: number; alt: number }[]
  altMin: number
  altMax: number
}) {
  const chartW = 240
  const chartH = 70
  const padLeft = 42
  const padRight = 8
  const padTop = 8
  const padBottom = 24
  const totalW = padLeft + chartW + padRight
  const totalH = padTop + chartH + padBottom

  const maxDist = points.length ? points[points.length - 1].dist : 1
  const range = altMax - altMin || 1

  const scaleX = (d: number) => padLeft + (d / maxDist) * chartW
  const scaleY = (alt: number) =>
    padTop + chartH - ((alt - altMin) / range) * chartH

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.dist)} ${scaleY(p.alt)}`)
    .join(' ')

  const xTicks = axisTicks(0, maxDist, 5)
  const yTicks = axisTicks(altMin, altMax, 4)

  return (
    <svg
      className="elevation-profile"
      viewBox={`0 0 ${totalW} ${totalH}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {xTicks.slice(1, -1).map((v) => (
        <line
          key={`gx-${v}`}
          x1={scaleX(v)}
          y1={padTop}
          x2={scaleX(v)}
          y2={padTop + chartH}
          stroke="var(--border-subtle)"
          strokeDasharray="2 2"
        />
      ))}
      {yTicks.slice(1, -1).map((v) => (
        <line
          key={`gy-${v}`}
          x1={padLeft}
          y1={scaleY(v)}
          x2={padLeft + chartW}
          y2={scaleY(v)}
          stroke="var(--border-subtle)"
          strokeDasharray="2 2"
        />
      ))}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {xTicks.map((v) => (
        <text
          key={`x-${v}`}
          x={scaleX(v)}
          y={totalH - 6}
          textAnchor="middle"
          className="elevation-profile-axistext"
        >
          {v < 0.1 ? v.toFixed(2) : v.toFixed(1)} km
        </text>
      ))}
      {yTicks.map((v) => (
        <text
          key={`y-${v}`}
          x={padLeft - 6}
          y={scaleY(v) + 4}
          textAnchor="end"
          className="elevation-profile-axistext"
        >
          {Math.round(v)} m
        </text>
      ))}
    </svg>
  )
}
