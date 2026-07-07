import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database } from 'lucide-react'
import { api, type FileMeta, type Overview } from '@/lib/api'
import { DataTableView } from '@/components/DataTableView'
import { OverviewCharts } from '@/components/OverviewCharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, InlineError, ResultsSkeleton } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'
import { fileStatusBadge } from '@/lib/match'
import { feedName, formatBytes, relativeTime } from '@/lib/utils'

export function DashboardPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState<FileMeta | null | undefined>(undefined)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
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
    return <InlineError message={error} />
  }

  if (active === undefined) {
    return <ResultsSkeleton />
  }

  if (active === null) {
    return (
      <EmptyState
        icon={Database}
        title="No active data feed"
        description="Upload a file or pick one in Data Feeds to get started."
        action={<Button onClick={() => navigate('/feeds')}>Go to Data Feeds</Button>}
        className="py-20"
      />
    )
  }

  const badge = fileStatusBadge(active.validation_status)

  return (
    <div className="flex flex-col gap-6">
      <div data-tour="feed-title">
        <PageHeader
          eyebrow="Active feed"
          title={feedName(active.original_filename)}
          description={active.primary_sheet ? `sheet "${active.primary_sheet}"` : undefined}
          actions={<Badge variant={badge.variant}>{badge.label}</Badge>}
          meta={
            <>
              <Badge variant="outline">{active.sheet_count} sheets</Badge>
              <Badge variant="outline">{formatBytes(active.size)}</Badge>
              <Badge variant="neutral">Uploaded {relativeTime(active.uploaded_at)}</Badge>
              <Button variant="outline" size="sm" onClick={() => navigate('/feeds')}>
                Manage feeds
              </Button>
            </>
          }
        />
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
