// Custom SVG charts — no chart library dependency.

export function ProgressBars({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 100);
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      {data.map((d, i) => {
        const h = (d.value / max) * 160;
        const x = 30 + i * 70;
        return (
          <g key={d.label}>
            <rect x={x} y={180 - h} width={50} height={h} fill={d.color} rx={6}>
              <animate attributeName="height" from="0" to={h} dur="0.8s" fill="freeze" />
              <animate attributeName="y" from="180" to={180 - h} dur="0.8s" fill="freeze" />
            </rect>
            <text x={x + 25} y={200} textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.8">{d.label}</text>
            <text x={x + 25} y={175 - h} textAnchor="middle" fill={d.color} fontSize="12" fontWeight="bold">{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StreakRing({ value, max = 7 }: { value: number; max?: number }) {
  const pct = Math.min(value / max, 1);
  const r = 55;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 140 140" className="w-32 h-32">
      <circle cx={70} cy={70} r={r} fill="none" stroke="oklch(0.28 0.06 285)" strokeWidth={12} />
      <circle
        cx={70} cy={70} r={r} fill="none"
        stroke="oklch(0.82 0.18 80)" strokeWidth={12} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 70 70)"
      >
        <animate attributeName="stroke-dashoffset" from={c} to={c * (1 - pct)} dur="1s" fill="freeze" />
      </circle>
      <text x={70} y={68} textAnchor="middle" fontSize="28" fontWeight="bold" fill="currentColor">{value}</text>
      <text x={70} y={88} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">DAY STREAK</text>
    </svg>
  );
}
