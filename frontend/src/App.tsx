import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Boxes,
  Database,
  Dices,
  LayoutDashboard,
  PlayCircle,
  ScanLine,
  TestTube2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

export function SidebarLayout() {
  const { pathname } = useLocation()
  const [tourOpen, setTourOpen] = useState(false)
  const steps = tourFor(pathname)

  return (
    <div className="flex min-h-full bg-background">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-[var(--midnight)] px-3 py-4">
        <div className="mb-5 px-2">
          <Logo />
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
            Sample Management
          </p>
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Floating tour launcher (right edge) */}
      {steps.length > 0 && (
        <button
          onClick={() => setTourOpen(true)}
          aria-label="Play feature tour"
          className="fixed right-5 top-1/2 z-50 inline-flex -translate-y-1/2 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground shadow-lg transition-colors hover:border-primary hover:text-primary"
        >
          <PlayCircle className="h-5 w-5 text-primary" />
          Tour
        </button>
      )}

      {tourOpen && steps.length > 0 && (
        <Tour steps={steps} onClose={() => setTourOpen(false)} />
      )}
    </div>
  )
}
