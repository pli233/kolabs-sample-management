import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database } from 'lucide-react'
import { api, type FileMeta, type Overview } from '@/lib/api'
import { DataTableView } from '@/components/DataTableView'
import { OverviewCharts } from '@/components/OverviewCharts'
import { Button } from '@/components/ui/button'
import { fileStatusBadge } from '@/lib/match'

export function DashboardPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState<FileMeta | null | undefined>(undefined)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setOverview(null)
    api
      .getActiveFeed()
      .then((r) => {
        if (cancelled) return
        setActive(r.active)
        if (r.active) {
          api
            .getOverview(r.active.id)
            .then((o) => !cancelled && setOverview(o))
            .catch(() => {})
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <p className="text-sm text-[var(--destructive)]" role="alert">
        {error}
      </p>
    )
  }

  if (active === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (active === null) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted px-6 py-20 text-center">
        <Database className="h-10 w-10 text-muted-foreground" />
        <div>
          <h1 className="font-title text-lg font-semibold text-foreground">
            No active data feed
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a file or pick one in Data Feeds to get started.
          </p>
        </div>
        <Button onClick={() => navigate('/feeds')}>Go to Data Feeds</Button>
      </div>
    )
  }

  const badge = fileStatusBadge(active.validation_status)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3" data-tour="feed-title">
          <h1 className="truncate font-title text-xl font-semibold text-foreground">
            {active.original_filename}
          </h1>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        {active.primary_sheet && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Active feed · sheet “{active.primary_sheet}”
          </p>
        )}
      </div>

      {overview && (
        <div data-tour="overview">
          <OverviewCharts overview={overview} />
        </div>
      )}

      <DataTableView fileId={active.id} />
    </div>
  )
}
