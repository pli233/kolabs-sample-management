import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Boxes,
  Database,
  Dices,
  LayoutDashboard,
  Menu,
  PlayCircle,
  ScanLine,
  TestTube2,
  X,
} from 'lucide-react'
import { cn, feedName } from '@/lib/utils'
import { api } from '@/lib/api'
import { Logo } from '@/components/Logo'
import { Tour } from '@/components/Tour'
import { tourFor } from '@/lib/tours'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/box-lookup', label: 'Box Lookup', icon: Boxes },
  { to: '/qc-sampler', label: 'QC Sampler', icon: Dices },
  { to: '/aliquot-finder', label: 'Aliquot Finder', icon: TestTube2 },
  { to: '/scan-reconcile', label: 'Scan Reconcile', icon: ScanLine },
  { to: '/feeds', label: 'Data Feeds', icon: Database },
]

type FeedState =
  | { kind: 'loading' }
  | { kind: 'offline' }
  | { kind: 'none' }
  | { kind: 'feed'; name: string; status: string }

/** Live system status pinned to the sidebar foot: backend reachability +
 *  active feed + schema health. Reflects real state, not a decorative dot. */
function StatusFooter() {
  const [state, setState] = useState<FeedState>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    api
      .getActiveFeed()
      .then(({ active }) => {
        if (!alive) return
        setState(
          active
            ? {
                kind: 'feed',
                name: feedName(active.original_filename),
                status: active.validation_status,
              }
            : { kind: 'none' }
        )
      })
      .catch(() => alive && setState({ kind: 'offline' }))
    return () => {
      alive = false
    }
  }, [])

  const ok = state.kind === 'feed' && state.status === 'valid'
  const dot =
    state.kind === 'loading'
      ? 'var(--neutral-500)'
      : state.kind === 'offline'
        ? 'var(--destructive)'
        : ok
          ? 'var(--success)'
          : 'var(--warning-solid)'

  const primary =
    state.kind === 'loading'
      ? 'Connecting…'
      : state.kind === 'offline'
        ? 'Backend offline'
        : state.kind === 'none'
          ? 'No active feed'
          : state.name
  const secondary =
    state.kind === 'feed'
      ? ok
        ? 'Schema OK'
        : state.status === 'issues'
          ? 'Column mismatch'
          : 'Unvalidated'
      : state.kind === 'offline'
        ? 'Set a feed in Data Feeds'
        : null

  return (
    <div className="mt-auto border-t border-white/10 px-2 pt-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          {ok && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden"
              style={{ backgroundColor: dot }}
            />
          )}
          <span
            className="inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: dot }}
          />
        </span>
        <span className="truncate text-xs font-medium text-white/80">{primary}</span>
      </div>
      {secondary && (
        <p className="mt-1 truncate pl-4 text-[10px] text-white/40">{secondary}</p>
      )}
      <p className="mt-3 pl-4 text-[10px] uppercase tracking-[0.16em] text-white/25">
        Kolaboratory
      </p>
    </div>
  )
}

const guideSeenKey = (path: string) => `guide.seen:${path}`

export function SidebarLayout() {
  const { pathname } = useLocation()
  const [tourOpen, setTourOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const steps = tourFor(pathname)

  // Auto-open the guide the first time a page with one is visited.
  useEffect(() => {
    if (tourFor(pathname).length && !localStorage.getItem(guideSeenKey(pathname))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to navigation
      setTourOpen(true)
    }
  }, [pathname])

  const closeGuide = () => {
    setTourOpen(false)
    localStorage.setItem(guideSeenKey(pathname), '1')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar (below md) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-[var(--midnight)] px-4 md:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
          className="grid h-9 w-9 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
      </header>

      {/* Backdrop when drawer is open (mobile only) */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-56 flex-col gap-1 overflow-y-auto border-r border-border bg-[var(--midnight)] px-3 py-4 transition-transform md:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="relative mb-6 px-2 pt-1">
          <Logo className="justify-center" imgClassName="h-11 w-auto" />
          <p className="mt-3 whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Sample Management
          </p>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
            className="absolute right-0 top-0 grid h-8 w-8 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}

        <StatusFooter />
      </aside>

      <main className="min-w-0 px-6 pb-8 pt-20 md:ml-56 md:pt-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Floating guide launcher (right edge) */}
      {steps.length > 0 && (
        <button
          onClick={() => setTourOpen(true)}
          aria-label="Open guide"
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg transition-colors hover:border-primary hover:text-primary"
        >
          <PlayCircle className="h-5 w-5 text-primary" />
          Guide
        </button>
      )}

      {tourOpen && steps.length > 0 && (
        <Tour steps={steps} onClose={closeGuide} />
      )}
    </div>
  )
}
