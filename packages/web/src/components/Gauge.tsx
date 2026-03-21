interface GaugeProps {
  value: number | null;
  min?: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}

export function Gauge({ value, min = 0, max, label, unit, color = "#22c55e", size = "md" }: GaugeProps) {
  const radius = size === "sm" ? 36 : size === "lg" ? 64 : 52;
  const stroke = size === "sm" ? 6 : 8;
  const circumference = 2 * Math.PI * radius;
  const pct = value != null ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  // Circle center
  const cx = radius + stroke + 2;
  const cy = radius + stroke + 2;
  const svgW = cx * 2;

  // 270° arc: gap at bottom-center.
  // Stroke starts at 3-o-clock (0°). Offset by 225° to place start at bottom-left.
  const arcLength = circumference * 0.75;
  const dashOffset = circumference * 0.625;

  // The label sits BELOW the arc inside the SVG.
  // We extend the SVG height to include a label row below the circle.
  const labelY = cy + radius + stroke + 20;
  const unitY  = cy - radius * 0.18;
  const valueY = cy - radius * 0.18 - (size === "sm" ? 10 : size === "lg" ? 16 : 13);
  const svgH = labelY + 16;

  const valueFontSize = size === "sm" ? 16 : size === "lg" ? 32 : 26;
  const unitFontSize  = 11;
  const labelFontSize = 12;

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Background arc */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke="#374151"
        strokeWidth={stroke}
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
      {/* Value arc */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${arcLength * pct} ${circumference - arcLength * pct}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      {/* Numeric value */}
      <text
        x={cx} y={valueY}
        textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={valueFontSize} fontWeight="bold" fontFamily="inherit"
      >
        {value != null ? value.toFixed(value < 10 ? 1 : 0) : "—"}
      </text>
      {/* Unit */}
      <text
        x={cx} y={unitY}
        textAnchor="middle" dominantBaseline="middle"
        fill="#6b7280" fontSize={unitFontSize} fontFamily="inherit"
      >
        {unit}
      </text>
      {/* Label — rendered AFTER the arcs so it paints on top */}
      <text
        x={cx} y={labelY}
        textAnchor="middle" dominantBaseline="middle"
        fill="#d1d5db" fontSize={labelFontSize} fontWeight="500" fontFamily="inherit"
      >
        {label}
      </text>
    </svg>
  );
}
