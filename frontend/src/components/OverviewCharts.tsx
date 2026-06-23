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
import { Boxes, FolderTree, Snowflake } from 'lucide-react'
import type { Overview } from '@/lib/api'

// Categorical brand-blue scale for bar series (intentional data palette, not semantic tokens).
const BAR_COLORS = ['#0e8ed6', '#0b76b0', '#0112b8', '#3aa3df', '#010b24']

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes
  label: string
  value: string
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-100 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <div className="font-title text-xl font-semibold leading-none text-foreground">
          {value}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

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
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-title text-sm font-semibold text-foreground">
        {title}
      </h3>
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
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
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
              <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-300)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--neutral-400)' }}
                  interval={0}
                  height={24}
                />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
                <Tooltip cursor={{ fill: 'var(--neutral-300)' }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                  {bars}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}

export function OverviewCharts({ overview }: { overview: Overview }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Stat icon={Boxes} label="Total tubes" value={overview.total.toLocaleString()} />
        <Stat
          icon={FolderTree}
          label="Projects"
          value={overview.projectCount.toLocaleString()}
        />
        <Stat
          icon={Snowflake}
          label="Freezers"
          value={overview.byFreezer.length.toLocaleString()}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tubes by freezer" data={overview.byFreezer} />
        <ChartCard title="Top projects" data={overview.byProject} horizontal />
      </div>
    </div>
  )
}
