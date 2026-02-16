import { useState, useRef, useEffect } from 'react'
import './TrackEditControl.css'

type TrackEditControlProps = {
  editMode: boolean
  pointsCount: number
  processing: boolean
  canUndo: boolean
  measureSegmentMode: boolean
  onToggleEdit: () => boolean
  onSave: () => void
  onUndo: () => void
  onToggleMeasureSegment: () => void
  onOpenSimplifyModal: () => void
}

export function TrackEditControl({
  editMode,
  pointsCount,
  processing,
  canUndo,
  measureSegmentMode,
  onToggleEdit,
  onSave,
  onUndo,
  onToggleMeasureSegment,
  onOpenSimplifyModal,
}: TrackEditControlProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editMode) return
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [editMode])

  return (
    <div className="track-edit-control" ref={ref}>
      <button
        type="button"
        className={`track-edit-map-btn ${editMode ? 'active' : ''}`}
        onClick={() => {
          if (editMode) {
            setOpen(!open)
          } else {
            onToggleEdit()
            setOpen(true)
          }
        }}
        aria-label={editMode ? 'Sortir d\'edició' : 'Editar ruta'}
        aria-expanded={open}
        title={editMode ? 'Menú d\'edició' : 'Entrar en mode edició per modificar la ruta al mapa'}
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
          <div className="track-edit-options">
            {editMode && (
              <>
                <span className="track-edit-menu-section">Operacions</span>
                <button
                  type="button"
                  className="track-edit-opt track-edit-opt-primary track-edit-opt-with-tooltip"
                  onClick={onOpenSimplifyModal}
                  disabled={processing || pointsCount < 3}
                  data-tooltip="Elimina punts redundants de la ruta sense perdre la forma. Útil per reduir la mida del fitxer. Pots triar el nivell: lleu (més precisió), mitjà o fort (més reducció)."
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 14 L 9 8 L 14 14 L 19 9 L 22 12" />
                    <circle cx="4" cy="14" r="1.5" fill="currentColor" />
                    <circle cx="9" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="14" cy="14" r="1.5" fill="currentColor" />
                    <circle cx="19" cy="9" r="1.5" fill="currentColor" />
                    <circle cx="22" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                  Simplificar punts
                </button>
                <span className="track-edit-menu-section">Consulta</span>
                <button
                  type="button"
                  className={`track-edit-opt track-edit-opt-primary track-edit-opt-with-tooltip ${measureSegmentMode ? 'active' : ''}`}
                  onClick={onToggleMeasureSegment}
                  disabled={processing || pointsCount < 2}
                  data-tooltip="Activa el mode mesura. Després clica un punt com a inici i un altre com a final. Et mostrarà la distància del tram seleccionat sobre el mapa."
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12h16" />
                    <path d="M4 8v8M20 8v8" />
                  </svg>
                  Mesurar segment
                </button>
              </>
            )}
            {editMode && (
              <>
                <span className="track-edit-menu-separator" />
                <button
                  type="button"
                  className="track-edit-opt track-edit-opt-primary"
                  onClick={onUndo}
                  disabled={processing || !canUndo}
                  title="Desfà l'últim canvi fet (afegir, eliminar, moure o simplificar punts)."
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M19 12H5" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Desfer canvis
                </button>
                <button
                type="button"
                className="track-edit-opt track-edit-opt-primary"
                onClick={() => {
                  onSave()
                  setOpen(false)
                }}
                disabled={processing || pointsCount < 2}
                title="Guarda els canvis fets a la ruta."
              >
                {processing ? (
                  '…'
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Desar canvis
                  </>
                )}
              </button>
              </>
            )}
            <button
              type="button"
              className={`track-edit-opt ${editMode ? 'track-edit-opt-primary' : ''}`}
              onClick={() => {
                const didExit = onToggleEdit()
                if (editMode && didExit) setOpen(false)
              }}
              title={editMode ? 'Surt del mode edició. Si hi ha canvis sense desar, et demanarà confirmació.' : 'Entra en mode edició per modificar la ruta al mapa.'}
            >
              {editMode ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Sortir d&apos;edició
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Editar ruta al mapa
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
