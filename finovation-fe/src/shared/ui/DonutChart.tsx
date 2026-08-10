import { useState } from "react"

import styles from "@/shared/ui/DonutChart.module.css"

export const DONUT_COLORS = [
  "#0d9488",
  "#14b8a6",
  "#2dd4bf",
  "#5eead4",
  "#0f766e",
  "#134e4a",
  "#94a3b8",
] as const

export type DonutSlice = {
  id: string
  label: string
  value: number
  color?: string
}

type DonutChartProps = {
  slices: DonutSlice[]
  ariaLabel: string
  formatValue: (value: number) => string
}

const RADIUS = 58
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const VIEWBOX_CENTER = 80

export default function DonutChart({
  slices,
  ariaLabel,
  formatValue,
}: DonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const activeSlice = activeIndex === null ? null : slices[activeIndex]
  let consumed = 0

  return (
    <div className={styles.chart}>
      <svg viewBox="0 0 160 160" role="img" aria-label={ariaLabel}>
        <circle
          cx={VIEWBOX_CENTER}
          cy={VIEWBOX_CENTER}
          r={RADIUS}
          fill="none"
          stroke="#e8eef4"
          strokeWidth="23"
        />
        {total > 0 &&
          slices.map((slice, index) => {
            const fraction = slice.value / total
            const length = fraction * CIRCUMFERENCE
            const offset = -consumed * CIRCUMFERENCE
            consumed += fraction

            return (
              <circle
                key={slice.id}
                cx={VIEWBOX_CENTER}
                cy={VIEWBOX_CENTER}
                r={RADIUS}
                fill="none"
                stroke={slice.color ?? DONUT_COLORS[index % DONUT_COLORS.length]}
                strokeWidth={activeIndex === index ? "27" : "23"}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${VIEWBOX_CENTER} ${VIEWBOX_CENTER})`}
                tabIndex={0}
                aria-label={`${slice.label}: ${formatValue(slice.value)}`}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              />
            )
          })}
      </svg>

      {activeSlice && (
        <div className={styles.hoverDetail} role="status" aria-live="polite">
          <strong>{activeSlice.label}</strong>
          <span>{formatValue(activeSlice.value)}</span>
        </div>
      )}
    </div>
  )
}
