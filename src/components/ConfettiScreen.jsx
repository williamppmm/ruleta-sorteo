import { useEffect, useRef } from 'react'

/**
 * Pantalla de confetti en canvas — adaptada del prototipo a React.
 * Corre en bucle mientras el componente esté montado.
 */
export default function ConfettiScreen() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COLORS = ['#FFD700','#DC143C','#0047AB','#FFFFFF','#DAA520','#B91C1C','#1e3a8a','#C0C0C0']
    const parts = Array.from({ length: 200 }, () => ({
      x:    Math.random() * canvas.width,
      y:   -Math.random() * canvas.height,
      vy:   2 + Math.random() * 4,
      vx:  -1 + Math.random() * 2,
      size: 4 + Math.random() * 8,
      rot:  Math.random() * Math.PI * 2,
      vr:  -0.08 + Math.random() * 0.16,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    let animId
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width }
        if (p.x < -20) p.x = canvas.width + 20
        if (p.x > canvas.width + 20) p.x = -20
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      }
      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  )
}
