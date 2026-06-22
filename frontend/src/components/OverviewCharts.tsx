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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="font-title text-xl font-semibold leading-tight text-foreground">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  data,
}: {
  title: string
  data: { name: string; count: number }[]
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-title text-sm font-semibold text-foreground">
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#4e5561' }}
              tickLine={false}
              axisLine={{ stroke: '#d4dce3' }}
              interval={0}
              angle={data.length > 6 ? -35 : 0}
              textAnchor={data.length > 6 ? 'end' : 'middle'}
              height={data.length > 6 ? 48 : 24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#4e5561' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: '#f2f4f7' }}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #d4dce3',
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((_, i) => (
                <RCell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function OverviewCharts({ overview }: { overview: Overview }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        <ChartCard title="Top projects" data={overview.byProject} />
      </div>
    </div>
  )
}
