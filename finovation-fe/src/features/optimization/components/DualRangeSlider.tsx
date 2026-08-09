import { useEffect, useId, useState, type KeyboardEvent } from "react"

import styles from "@/features/optimization/styles/DualRangeSlider.module.css"

export type DualRangeSliderProps = {
  id: string
  label?: string
  min: number
  max: number
  step?: number
  valueMin: number
  valueMax: number
  minGap?: number
  disabled?: boolean
  inputPrefix?: string
  formatBound?: (value: number) => string
  hint?: string
  onChange: (next: { min: number; max: number }) => void
}

type FieldFeedback = "idle" | "accepted" | "adjusted" | "rejected"

function toPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return ((value - min) / (max - min)) * 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseInputValue(raw: string): number | null {
  if (raw.trim() === "") return null
  const next = Number(raw)
  return Number.isFinite(next) ? next : null
}

export default function DualRangeSlider({
  id,
  label,
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  minGap = 0,
  disabled = false,
  inputPrefix = "",
  formatBound = (value) => String(value),
  hint,
  onChange,
}: DualRangeSliderProps) {
  const minFieldLabel = label ? `${label} Minimum` : "Minimum"
  const maxFieldLabel = label ? `${label} Maksimum` : "Maksimum"
  const minSliderLabel = label ? `${label} Minimum kaydırıcı` : "Minimum kaydırıcı"
  const maxSliderLabel = label ? `${label} Maksimum kaydırıcı` : "Maksimum kaydırıcı"
  const gap = Math.min(Math.max(minGap, step), max - min)
  const lowPercent = toPercent(valueMin, min, max)
  const highPercent = toPercent(valueMax, min, max)
  const hintId = useId()

  const [minDraft, setMinDraft] = useState(String(valueMin))
  const [maxDraft, setMaxDraft] = useState(String(valueMax))
  const [minFeedback, setMinFeedback] = useState<FieldFeedback>("idle")
  const [maxFeedback, setMaxFeedback] = useState<FieldFeedback>("idle")
  const [liveHint, setLiveHint] = useState("")
  const [announce, setAnnounce] = useState("")

  useEffect(() => {
    setMinDraft(String(valueMin))
  }, [valueMin])

  useEffect(() => {
    setMaxDraft(String(valueMax))
  }, [valueMax])

  function pulseFeedback(
    which: "min" | "max",
    kind: Exclude<FieldFeedback, "idle">,
  ) {
    const setFeedback = which === "min" ? setMinFeedback : setMaxFeedback
    setFeedback("idle")
    requestAnimationFrame(() => setFeedback(kind))
    window.setTimeout(() => setFeedback("idle"), 480)
  }

  function applyRange(nextMin: number, nextMax: number, message?: string) {
    onChange({ min: nextMin, max: nextMax })
    setMinDraft(String(nextMin))
    setMaxDraft(String(nextMax))
    if (message) setAnnounce(message)
  }

  function handleMinChange(nextMin: number) {
    let nextValueMin = clamp(nextMin, min, max)
    let nextValueMax = valueMax

    if (nextValueMax - nextValueMin < gap) {
      nextValueMax = nextValueMin + gap
      if (nextValueMax > max) {
        nextValueMax = max
        nextValueMin = nextValueMax - gap
      }
    }

    applyRange(nextValueMin, nextValueMax)
  }

  function handleMaxChange(nextMax: number) {
    let nextValueMax = clamp(nextMax, min, max)
    let nextValueMin = valueMin

    if (nextValueMax - nextValueMin < gap) {
      nextValueMin = nextValueMax - gap
      if (nextValueMin < min) {
        nextValueMin = min
        nextValueMax = nextValueMin + gap
      }
    }

    applyRange(nextValueMin, nextValueMax)
  }

  function previewMinHint(raw: string) {
    const next = parseInputValue(raw)
    if (next == null || !Number.isInteger(next)) {
      setLiveHint("")
      return
    }
    if (next < min || next > max) {
      setLiveHint(`İzin verilen aralık: ${formatBound(min)} – ${formatBound(max)}`)
      return
    }
    if (valueMax - next < gap) {
      const pushedMax = Math.min(max, next + gap)
      setLiveHint(`Maksimum ${formatBound(pushedMax)} olacak`)
      return
    }
    setLiveHint("")
  }

  function previewMaxHint(raw: string) {
    const next = parseInputValue(raw)
    if (next == null || !Number.isInteger(next)) {
      setLiveHint("")
      return
    }
    if (next < min || next > max) {
      setLiveHint(`İzin verilen aralık: ${formatBound(min)} – ${formatBound(max)}`)
      return
    }
    if (next - valueMin < gap) {
      const pushedMin = Math.max(min, next - gap)
      setLiveHint(`Minimum ${formatBound(pushedMin)} olacak`)
      return
    }
    setLiveHint("")
  }

  function commitMinDraft() {
    setLiveHint("")
    const next = parseInputValue(minDraft)

    if (next == null || !Number.isInteger(next) || next < min || next > max) {
      setMinDraft(String(valueMin))
      pulseFeedback("min", "rejected")
      return
    }

    let nextValueMin = next
    let nextValueMax = valueMax
    let adjusted = false

    if (nextValueMax - nextValueMin < gap) {
      nextValueMax = nextValueMin + gap
      adjusted = true
      if (nextValueMax > max) {
        nextValueMax = max
        nextValueMin = nextValueMax - gap
      }
    }

    if (nextValueMin < min || nextValueMax > max || nextValueMax - nextValueMin < gap) {
      setMinDraft(String(valueMin))
      pulseFeedback("min", "rejected")
      return
    }

    applyRange(
      nextValueMin,
      nextValueMax,
      `Aralık ${formatBound(nextValueMin)} – ${formatBound(nextValueMax)}`,
    )
    pulseFeedback("min", adjusted ? "adjusted" : "accepted")
    if (adjusted) pulseFeedback("max", "adjusted")
  }

  function commitMaxDraft() {
    setLiveHint("")
    const next = parseInputValue(maxDraft)

    if (next == null || !Number.isInteger(next) || next < min || next > max) {
      setMaxDraft(String(valueMax))
      pulseFeedback("max", "rejected")
      return
    }

    let nextValueMax = next
    let nextValueMin = valueMin
    let adjusted = false

    if (nextValueMax - nextValueMin < gap) {
      nextValueMin = nextValueMax - gap
      adjusted = true
      if (nextValueMin < min) {
        nextValueMin = min
        nextValueMax = nextValueMin + gap
      }
    }

    if (nextValueMin < min || nextValueMax > max || nextValueMax - nextValueMin < gap) {
      setMaxDraft(String(valueMax))
      pulseFeedback("max", "rejected")
      return
    }

    applyRange(
      nextValueMin,
      nextValueMax,
      `Aralık ${formatBound(nextValueMin)} – ${formatBound(nextValueMax)}`,
    )
    pulseFeedback("max", adjusted ? "adjusted" : "accepted")
    if (adjusted) pulseFeedback("min", "adjusted")
  }

  function revertMinDraft() {
    setMinDraft(String(valueMin))
    setLiveHint("")
  }

  function revertMaxDraft() {
    setMaxDraft(String(valueMax))
    setLiveHint("")
  }

  function handleMinKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur()
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      revertMinDraft()
      event.currentTarget.blur()
    }
  }

  function handleMaxKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur()
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      revertMaxDraft()
      event.currentTarget.blur()
    }
  }

  function fieldClass(feedback: FieldFeedback): string {
    if (feedback === "rejected") return styles.valueFieldRejected
    if (feedback === "adjusted") return styles.valueFieldAdjusted
    if (feedback === "accepted") return styles.valueFieldAccepted
    return styles.valueFieldActive
  }

  const defaultHint = inputPrefix
    ? `Minimum aralık: ${gap} puan`
    : `Minimum aralık: ${gap}`

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <label
          className={[styles.valueField, fieldClass(minFeedback)].join(" ")}
          htmlFor={`${id}-min-input`}
        >
          {inputPrefix ? (
            <span className={styles.valuePrefix}>{inputPrefix}</span>
          ) : null}
          <input
            id={`${id}-min-input`}
            className={styles.valueInput}
            type="text"
            inputMode="numeric"
            value={minDraft}
            disabled={disabled}
            aria-label={minFieldLabel}
            aria-describedby={hintId}
            onChange={(event) => {
              setMinDraft(event.target.value)
              previewMinHint(event.target.value)
            }}
            onBlur={commitMinDraft}
            onKeyDown={handleMinKeyDown}
          />
        </label>
        <span className={styles.separator}>–</span>
        <label
          className={[styles.valueField, fieldClass(maxFeedback)].join(" ")}
          htmlFor={`${id}-max-input`}
        >
          {inputPrefix ? (
            <span className={styles.valuePrefix}>{inputPrefix}</span>
          ) : null}
          <input
            id={`${id}-max-input`}
            className={styles.valueInput}
            type="text"
            inputMode="numeric"
            value={maxDraft}
            disabled={disabled}
            aria-label={maxFieldLabel}
            aria-describedby={hintId}
            onChange={(event) => {
              setMaxDraft(event.target.value)
              previewMaxHint(event.target.value)
            }}
            onBlur={commitMaxDraft}
            onKeyDown={handleMaxKeyDown}
          />
        </label>
      </div>

      <p id={hintId} className={styles.hint} aria-live="polite">
        {liveHint || hint || defaultHint}
      </p>

      <div className={styles.trackWrap}>
        <div className={styles.track} aria-hidden="true" />
        <div
          className={styles.range}
          style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
          aria-hidden="true"
        />

        <input
          id={`${id}-min`}
          className={[styles.input, styles.inputMin].join(" ")}
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          disabled={disabled}
          aria-label={minSliderLabel}
          style={{ zIndex: valueMin > max - (max - min) * 0.1 ? 5 : 3 }}
          onChange={(event) => handleMinChange(Number(event.target.value))}
        />
        <input
          id={`${id}-max`}
          className={[styles.input, styles.inputMax].join(" ")}
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          disabled={disabled}
          aria-label={maxSliderLabel}
          style={{ zIndex: 4 }}
          onChange={(event) => handleMaxChange(Number(event.target.value))}
        />
      </div>

      <div className={styles.meta}>
        <span>{formatBound(min)}</span>
        <span>{formatBound(max)}</span>
      </div>

      <span className={styles.srOnly} aria-live="polite">
        {announce}
      </span>
    </div>
  )
}
