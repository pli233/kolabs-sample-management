import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as RCell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Boxes, ChevronDown, FolderTree, Snowflake } from 'lucide-react'
import type { Bucket, Overview } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEscapeKey } from '@/lib/interactions'

// Categorical brand-blue scale for bar series (intentional data palette, not semantic tokens).
const BAR_COLORS = ['#0e8ed6', '#0b76b0', '#0112b8', '#3aa3df', '#010b24']

function Stat({
  icon: Icon,
  label,
  value,
  details,
}: {
  icon: typeof Boxes
  label: string
  value: string
  /** When present, the card is clickable and lists these in a popover. */
  details?: Bucket[]
}) {
  const [open, setOpen] = useState(false)
  const clickable = !!details?.length
  useEscapeKey(open, () => setOpen(false))

  const card = (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <div>
        <div className="font-title text-2xl font-semibold leading-none text-foreground">
          {value}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {label}
          {clickable && <ChevronDown className="h-3 w-3" />}
        </div>
      </div>
    </div>
  )

  if (!clickable) {
    return <Card>{card}</Card>
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {card}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
            {details!.map((d) => (
              <div
                key={d.name}
                className="flex items-center justify-between gap-3 rounded px-2.5 py-1.5 text-sm hover:bg-muted"
              >
                <span className="truncate text-foreground">{d.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {d.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const numFmt = (v: number) =>
  v >= 1000 ? `${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`

const AXIS_TICK = { fontSize: 11, fill: 'var(--neutral-600)' }
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--neutral-400)',
  fontSize: 12,
}

function ChartCard({
  title,
  data,
  horizontal = false,
}: {
  title: string
  data: { name: string; count: number }[]
  horizontal?: boolean
}) {
  const bars = data.map((_, i) => (
    <RCell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
  ))
  const height = horizontal ? Math.max(220, data.length * 22) : 220

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
      ) : (
        <>
          <p className="sr-only">
            {`${title}: ${data.map((d) => `${d.name} ${d.count}`).join(', ')}`}
          </p>
          <ResponsiveContainer width="100%" height={height}>
            {horizontal ? (
              <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-300)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={numFmt}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--neutral-400)' }}
                  width={56}
                />
                <Tooltip cursor={{ fill: 'var(--neutral-300)' }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                  {bars}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-300)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--neutral-400)' }}
                  interval={0}
                  height={24}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={numFmt}
                />
                <Tooltip cursor={{ fill: 'var(--neutral-300)' }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                  {bars}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </>
      )}
      </CardContent>
    </Card>
  )
}

export function OverviewCharts({ overview }: { overview: Overview }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Stat icon={Boxes} label="Total tubes" value={overview.total.toLocaleString()} />
        <Stat
          icon={FolderTree}
          label="Projects"
          value={overview.projectCount.toLocaleString()}
          details={overview.byProject}
        />
        <Stat
          icon={Snowflake}
          label="Freezers"
          value={overview.byFreezer.length.toLocaleString()}
          details={overview.byFreezer}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tubes by freezer" data={overview.byFreezer} />
        <ChartCard title="Top projects" data={overview.byProject.slice(0, 12)} horizontal />
      </div>
    </div>
  )
}
