import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TourStep } from '@/lib/tours'

interface TourProps {
  steps: TourStep[]
  onClose: () => void
}

const PAD = 6

export function Tour({ steps, onClose }: TourProps) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[i]

  useLayoutEffect(() => {
    let raf = 0
    function measure() {
      const el = step?.selector
        ? (document.querySelector(step.selector) as HTMLElement | null)
        : null
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        raf = requestAnimationFrame(() => setRect(el.getBoundingClientRect()))
      } else {
        setRect(null)
      }
    }
    measure()
    const t = setTimeout(measure, 280) // settle after scroll
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [i, step])

  if (!step) return null

  const last = i === steps.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Tooltip position: below the target if room, else above; else centered.
  let tip: React.CSSProperties
  if (rect) {
    const below = rect.bottom + 12
    const placeBelow = below + 180 < vh
    tip = {
      top: placeBelow ? below : undefined,
      bottom: placeBelow ? undefined : vh - rect.top + 12,
      left: Math.min(Math.max(rect.left, 16), vw - 360),
    }
  } else {
    tip = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight (dims everything except the target via a huge box-shadow). */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(2, 13, 27, 0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(2,13,27,0.55)]" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute w-[340px] max-w-[92vw] rounded-xl border border-border bg-card p-4 shadow-2xl"
        style={tip}
        role="dialog"
        aria-label="Guide"
      >
        <button
          onClick={onClose}
          aria-label="Close guide"
          className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs font-medium uppercase tracking-wide text-primary">
          Step {i + 1} of {steps.length}
        </div>
        <h3 className="mt-1 font-title text-base font-semibold text-foreground">
          {step.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
