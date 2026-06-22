import { cn } from '@/lib/utils'

/** Coronavirus mark used as the "o" in the kə lab brand. */
export function VirusMark({ className }: { className?: string }) {
  const cx = 50
  const cy = 50
  const r1 = 25 // spoke start radius (outside the ring)
  const r2 = 36 // spoke tip
  const spokes = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    // perpendicular for the dumbbell cap
    const px = -dy
    const py = dx
    const tip = { x: cx + dx * r2, y: cy + dy * r2 }
    const cap = 6
    return {
      x1: cx + dx * r1,
      y1: cy + dy * r1,
      x2: tip.x,
      y2: tip.y,
      capX1: tip.x - px * cap,
      capY1: tip.y - py * cap,
      capX2: tip.x + px * cap,
      capY2: tip.y + py * cap,
    }
  })

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <circle cx={cx} cy={cy} r="18" strokeWidth="9" />
      {spokes.map((s, i) => (
        <g key={i} strokeWidth="6">
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          <line x1={s.capX1} y1={s.capY1} x2={s.capX2} y2={s.capY2} />
        </g>
      ))}
    </svg>
  )
}

/** Full brand lockup for the sidebar. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="font-title text-2xl font-bold leading-none tracking-tight text-white">
        k
      </span>
      <VirusMark className="-mx-0.5 h-6 w-6 text-primary" />
      <span className="font-title text-2xl font-bold leading-none tracking-tight text-white">
        lab
      </span>
    </div>
  )
}
