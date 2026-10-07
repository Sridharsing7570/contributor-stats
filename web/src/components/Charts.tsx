import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ContributorRow, WeekPoint } from '../lib/aggregate';
import type { SeriesScale } from '../lib/colors';
import { fmt, fmtCompact, fmtWeek } from '../lib/format';

const axis = { stroke: 'var(--border)', tick: { fill: 'var(--text-muted)', fontSize: 12 }, tickLine: false } as const;
const tooltip = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow)' },
  labelStyle: { color: 'var(--text)', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: 'var(--text)', padding: 0 },
  cursor: { fill: 'var(--hover)', stroke: 'var(--border-strong)' },
} as const;

export function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card chart-card">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

function Legend({ keys, scale }: { keys: string[]; scale: SeriesScale }) {
  if (keys.length < 2) return null;
  return (
    <ul className="legend">
      {keys.map((k) => (
        <li key={k}>
          <span className="swatch" style={{ background: scale.color(k) }} />
          {scale.label(k)}
        </li>
      ))}
    </ul>
  );
}

const Empty = () => <p className="empty">No commits match these filters.</p>;

/** Commits per contributor. One measure, so one colour; names sit on the axis. */
export function CommitsBar({ rows, limit = 12 }: { rows: ContributorRow[]; limit?: number }) {
  if (rows.length === 0) return <Empty />;
  const data = rows.slice(0, limit).map((r) => ({ name: r.name, commits: r.commits }));
  return (
    <>
      <ResponsiveContainer width="100%" height={data.length * 30 + 36}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" allowDecimals={false} tickFormatter={fmtCompact} {...axis} />
          <YAxis type="category" dataKey="name" width={118} {...axis} tick={{ fill: 'var(--text)', fontSize: 12 }} interval={0} />
          <Tooltip {...tooltip} formatter={(v: number) => [fmt(v), 'Commits']} />
          <Bar dataKey="commits" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}
            label={{ position: 'right', fill: 'var(--text-muted)', fontSize: 12, formatter: (v: number) => fmtCompact(v) }} />
        </BarChart>
      </ResponsiveContainer>
      {rows.length > limit && <p className="footnote">Top {limit} of {rows.length} contributors. The table below lists everyone.</p>}
    </>
  );
}

interface SeriesProps {
  data: WeekPoint[];
  keys: string[];
  scale: SeriesScale;
}

/** Weekly commits as lines (one per series) or as stacked bars. */
export function WeeklyChart({ data, keys, scale, kind = 'line' }: SeriesProps & { kind?: 'line' | 'bar' }) {
  if (data.length === 0) return <Empty />;
  const ordered = scale.order(keys);
  const common = { data, margin: { top: 8, right: 12, bottom: 0, left: -12 } };
  const parts = (
    <>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="week" tickFormatter={fmtWeek} minTickGap={36} {...axis} />
      <YAxis allowDecimals={false} tickFormatter={fmtCompact} {...axis} axisLine={false} />
      <Tooltip {...tooltip} labelFormatter={(w: string) => `Week of ${fmtWeek(w)}`} formatter={(v: number, k: string) => [fmt(v), scale.label(k)]} />
    </>
  );
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        {kind === 'line' ? (
          <LineChart {...common}>
            {parts}
            {ordered.map((k) => (
              <Line key={k} dataKey={k} name={k} type="monotone" stroke={scale.color(k)} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart {...common} barCategoryGap={1}>
            {parts}
            {ordered.map((k) => (
              <Bar key={k} dataKey={k} name={k} stackId="s" fill={scale.color(k)} isAnimationActive={false} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
      <Legend keys={ordered} scale={scale} />
    </>
  );
}

/** Each repo as a full-width bar split by who made its commits. */
export function RepoShareChart({ data, keys, scale }: { data: Array<Record<string, number | string>>; keys: string[]; scale: SeriesScale }) {
  if (data.length === 0) return <Empty />;
  const ordered = scale.order(keys);
  return (
    <>
      <ResponsiveContainer width="100%" height={data.length * 44 + 36}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap={8}>
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} {...axis} />
          <YAxis type="category" dataKey="repo" width={118} {...axis} tick={{ fill: 'var(--text)', fontSize: 12 }} interval={0} />
          <Tooltip {...tooltip} formatter={(v: number, k: string) => [`${v.toFixed(1)}%`, scale.label(k)]} />
          {ordered.map((k) => (
            <Bar key={k} dataKey={k} name={k} stackId="s" fill={scale.color(k)} stroke="var(--card)" strokeWidth={2} maxBarSize={26} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <Legend keys={ordered} scale={scale} />
    </>
  );
}
