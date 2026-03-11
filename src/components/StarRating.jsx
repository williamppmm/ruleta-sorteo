/**
 * Selector visual de estrellas (0–3).
 * Click en estrella activa con el mismo valor → baja a valor-1 (permite llegar a 0).
 * Rescata la lógica de interacción del prototipo.
 *
 * @param {{ value: number, onChange: (n: number) => void, readonly?: boolean, size?: string }} props
 */
export default function StarRating({ value = 0, onChange, readonly = false, size = 'text-2xl' }) {
  function handleClick(estrella) {
    if (readonly || !onChange) return
    // Si ya tiene ese valor, bajar a valor-1 (permite poner 0)
    const nuevo = value === estrella ? estrella - 1 : estrella
    onChange(Math.max(0, Math.min(3, nuevo)))
  }

  return (
    <div className="flex gap-0.5 items-center" role="group" aria-label="Calificación de estrellas">
      {[1, 2, 3].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => handleClick(n)}
          disabled={readonly}
          aria-label={`${n} estrella${n !== 1 ? 's' : ''}`}
          className={`${size} leading-none transition-all
            ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
            ${n <= value ? 'text-yellow-400' : 'text-gray-600'}
          `}
        >
          ★
        </button>
      ))}
    </div>
  )
}
