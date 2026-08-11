import { useState, useEffect } from "react"

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
  description?: string
}

type DonutChartProps = {
  slices: DonutSlice[]
  ariaLabel: string
  formatValue: (value: number) => string
  highlightedSliceId?: string | null
  onHighlightChange?: (id: string | null) => void
}

const RADIUS = 58
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const VIEWBOX_CENTER = 80

export default function DonutChart({
  slices,
  ariaLabel,
  formatValue,
  highlightedSliceId,
  onHighlightChange,
}: DonutChartProps) {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null)

  const [isMounted, setIsMounted] = useState(false)

  const activeIndex =
    highlightedSliceId != null
      ? slices.findIndex((s) => s.id === highlightedSliceId)
      : internalHoveredIndex !== null
        ? internalHoveredIndex
        : null

  useEffect(() => {
    // Biraz gecikme ekleyerek animasyonun daha belirgin olmasını sağlayalım
    const timer = setTimeout(() => setIsMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

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
                className={styles.slice}
                cx={VIEWBOX_CENTER}
                cy={VIEWBOX_CENTER}
                r={RADIUS}
                fill="none"
                stroke={slice.color ?? DONUT_COLORS[index % DONUT_COLORS.length]}
                strokeWidth={activeIndex === index ? "32" : "22"}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                strokeDasharray={`${isMounted ? length : 0} ${CIRCUMFERENCE}`}
                strokeDashoffset={isMounted ? offset : 0}
                strokeLinecap="butt"
                transform={`rotate(-90 ${VIEWBOX_CENTER} ${VIEWBOX_CENTER})`}
                tabIndex={0}
                aria-label={`${slice.label}: ${formatValue(slice.value)}`}
                onPointerEnter={() => {
                  setInternalHoveredIndex(index)
                  if (onHighlightChange) onHighlightChange(slice.id)
                }}
                onPointerLeave={() => {
                  setInternalHoveredIndex(null)
                  if (onHighlightChange) onHighlightChange(null)
                }}
                onFocus={() => {
                  setInternalHoveredIndex(index)
                  if (onHighlightChange) onHighlightChange(slice.id)
                }}
                onBlur={() => {
                  setInternalHoveredIndex(null)
                  if (onHighlightChange) onHighlightChange(null)
                }}
                style={{
                  transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
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
