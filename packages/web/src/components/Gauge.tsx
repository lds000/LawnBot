import { cn } from "@/lib/utils";

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
  const radius = size === "sm" ? 36 : size === "lg" ? 60 : 48;
  const stroke = size === "sm" ? 6 : 8;
  const circumference = 2 * Math.PI * radius;
  const pct = value != null ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const svgSize = (radius + stroke) * 2 + 4;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const fontSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center" style={{ width: svgSize, height: svgSize * 0.75 }}>
        <svg width={svgSize} height={svgSize} className="absolute top-0 left-0 -rotate-[135deg]">
          {/* Background arc */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke="#374151" strokeWidth={stroke}
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${circumference * 0.75 * pct} ${circumference * (1 - 0.75 * pct)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div className="flex flex-col items-center z-10 mt-4">
          <span className={cn("font-bold tabular-nums", fontSize)} style={{ color }}>
            {value != null ? value.toFixed(value < 10 ? 1 : 0) : "—"}
          </span>
          <span className="text-xs text-gray-500">{unit}</span>
        </div>
      </div>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
    </div>
  );
}
