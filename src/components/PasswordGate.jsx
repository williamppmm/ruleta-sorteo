import { useState, useRef, useEffect } from 'react'

const PASSWORD = '1980'

/**
 * Protege contenido con una contraseña local.
 * No requiere seguridad real — es solo una barrera de acceso visual.
 *
 * @param {{ children: React.ReactNode, onClose: () => void }} props
 */
export default function PasswordGate({ children, onClose }) {
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!desbloqueado) inputRef.current?.focus()
  }, [desbloqueado])

  function verificar(e) {
    e.preventDefault()
    if (input === PASSWORD) {
      setDesbloqueado(true)
      setError(false)
    } else {
      setError(true)
      setInput('')
      inputRef.current?.focus()
    }
  }

  if (desbloqueado) return children

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h2 className="text-2xl font-bold text-yellow-400 text-center mb-1">SuperAdmin</h2>
        <p className="text-gray-400 text-center text-sm mb-6">Acceso restringido</p>

        <form onSubmit={verificar} className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            placeholder="Contraseña"
            className={`w-full bg-gray-800 text-white text-center text-xl tracking-widest
              rounded-xl px-4 py-3 border outline-none transition
              ${error
                ? 'border-red-500 placeholder-red-400'
                : 'border-gray-600 placeholder-gray-500 focus:border-yellow-400'
              }`}
          />

          {error && (
            <p className="text-red-400 text-sm text-center -mt-2">Contraseña incorrecta</p>
          )}

          <button
            type="submit"
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition"
          >
            Ingresar
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition"
            >
              Cancelar
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
