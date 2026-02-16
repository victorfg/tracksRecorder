import { useEffect } from 'react'
import './SimplifyModal.css'

export const SIMPLIFY_TOLERANCES = {
  lleu: 0.00003,   // ~3m - més precisió
  mitja: 0.0001,   // ~11m - equilibri
  fort: 0.00025,  // ~28m - més reducció
} as const

type SimplifyLevel = keyof typeof SIMPLIFY_TOLERANCES

type Props = {
  onChoose: (tolerance: number) => void
  onCancel: () => void
}

export function SimplifyModal({ onChoose, onCancel }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onCancel])

  const levels: { key: SimplifyLevel; label: string; desc: string }[] = [
    { key: 'lleu', label: 'Lleu', desc: 'Manté més punts, ruta molt exacta (~3 m)' },
    { key: 'mitja', label: 'Mitjà', desc: 'Equilibri entre precisió i mida (~11 m)' },
    { key: 'fort', label: 'Fort', desc: 'Redueix molt els punts (~28 m)' },
  ]

  return (
    <div className="simplify-modal-overlay" onClick={onCancel}>
      <div
        className="simplify-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="simplify-modal-title"
      >
        <h3 id="simplify-modal-title" className="simplify-modal-title">
          Nivell de simplificació
        </h3>
        <p className="simplify-modal-message">
          Tria com de molts punts vols eliminar. Menor tolerància = més precisió.
        </p>
        <div className="simplify-modal-options">
          {levels.map(({ key, label, desc }) => (
            <button
              key={key}
              type="button"
              className="simplify-modal-opt"
              onClick={() => onChoose(SIMPLIFY_TOLERANCES[key])}
            >
              <span className="simplify-modal-opt-label">{label}</span>
              <span className="simplify-modal-opt-desc">{desc}</span>
            </button>
          ))}
        </div>
        <div className="simplify-modal-actions">
          <button type="button" className="simplify-modal-btn cancel" onClick={onCancel}>
            Cancel·lar
          </button>
        </div>
      </div>
    </div>
  )
}
