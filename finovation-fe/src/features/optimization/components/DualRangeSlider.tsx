import { useState } from "react"

import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type DualRangeSliderProps = {
  label: string
  min: number
  max: number
  floor: number
  ceiling: number
  step?: number
  minWidth?: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
}

function toPercentage(value: number, floor: number, ceiling: number): number {
  if (ceiling <= floor) return 0
  const clamped = Math.min(Math.max(value, floor), ceiling)
  return ((clamped - floor) / (ceiling - floor)) * 100
}

export default function DualRangeSlider({
  label,
  min,
  max,
  floor,
  ceiling,
  step = 1,
  minWidth = step,
  onMinChange,
  onMaxChange,
}: DualRangeSliderProps) {
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null)

  const minPercentage = toPercentage(min, floor, ceiling)
  const maxPercentage = toPercentage(max, floor, ceiling)
  const ticks = [
    floor,
    floor + (ceiling - floor) * 0.25,
    floor + (ceiling - floor) * 0.5,
    floor + (ceiling - floor) * 0.75,
    ceiling,
  ]

  return (
    <div className={styles.sliderTrackWrap}>
      <div className={styles.sliderTrackArea}>
        <span
          className={styles.sliderBubble}
          style={{ left: `${minPercentage}%` }}
        >
          {min}
        </span>
        <span
          className={styles.sliderBubble}
          style={{ left: `${maxPercentage}%` }}
        >
          {max}
        </span>
        <div className={styles.sliderTrack}>
          <div
            className={styles.sliderTrackFill}
            style={{
              left: `${minPercentage}%`,
              width: `${maxPercentage - minPercentage}%`,
            }}
          />
        </div>
        <input
          type="range"
          className={styles.sliderInput}
          style={{ zIndex: activeThumb === "min" ? 3 : 2 }}
          min={floor}
          max={ceiling}
          step={step}
          value={min}
          aria-label={`${label} minimum kaydırıcı`}
          onPointerDown={() => setActiveThumb("min")}
          onFocus={() => setActiveThumb("min")}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), max - minWidth)
            onMinChange(next)
          }}
        />
        <input
          type="range"
          className={styles.sliderInput}
          style={{ zIndex: activeThumb === "max" ? 3 : 1 }}
          min={floor}
          max={ceiling}
          step={step}
          value={max}
          aria-label={`${label} maksimum kaydırıcı`}
          onPointerDown={() => setActiveThumb("max")}
          onFocus={() => setActiveThumb("max")}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), min + minWidth)
            onMaxChange(next)
          }}
        />
      </div>
      <div className={styles.sliderTicks} aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>
            {Number.isInteger(tick) ? tick : tick.toFixed(1).replace(".0", "")}
          </span>
        ))}
      </div>
    </div>
  )
}
