import { useState, useRef, useEffect } from 'react'
import './TrackEditControl.css'

type TrackEditControlProps = {
  editMode: boolean
  selectedIndex: number | null
  pointsCount: number
  processing: boolean
  onToggleEdit: () => void
  onSave: () => void
  onRemovePoint: (index: number) => void
}

export function TrackEditControl({
  editMode,
  selectedIndex,
  pointsCount,
  processing,
  onToggleEdit,
  onSave,
  onRemovePoint,
}: TrackEditControlProps) {
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
    <div className="track-edit-control" ref={ref}>
      <button
        type="button"
        className={`track-edit-map-btn ${editMode ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={editMode ? 'Sortir d\'edició' : 'Editar ruta'}
        aria-expanded={open}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      {open && (
        <div className="track-edit-menu">
          <span className="track-edit-menu-title">Editar ruta</span>
          <div className="track-edit-options">
            <button
              type="button"
              className={`track-edit-opt ${editMode ? 'active' : ''}`}
              onClick={() => {
                onToggleEdit()
                if (editMode) setOpen(false)
              }}
            >
              {editMode ? '✕ Sortir d\'edició' : '✎ Editar ruta al mapa'}
            </button>
            {editMode && (
              <>
                {selectedIndex != null && (
                  <button
                    type="button"
                    className="track-edit-opt track-edit-opt-danger"
                    onClick={() => {
                      onRemovePoint(selectedIndex)
                      setOpen(false)
                    }}
                    disabled={pointsCount <= 2}
                  >
                    Eliminar punt {selectedIndex + 1}
                  </button>
                )}
                <button
                  type="button"
                  className="track-edit-opt track-edit-opt-primary"
                  onClick={() => {
                    onSave()
                    setOpen(false)
                  }}
                  disabled={processing || pointsCount < 2}
                >
                  {processing ? '…' : 'Desar canvis'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
