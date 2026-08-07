import DualRangeSlider from "@/features/optimization/components/DualRangeSlider"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type ConstraintRangeInputsProps = {
  label: string
  min: number
  max: number
  floor: number
  ceiling: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
  hint: string
}

export default function ConstraintRangeInputs({
  label,
  min,
  max,
  floor,
  ceiling,
  onMinChange,
  onMaxChange,
  hint,
}: ConstraintRangeInputsProps) {
  return (
    <div className={styles.rangeField}>
      <div className={styles.rangeFieldHeader}>
        <span className={styles.rangeFieldLabel}>{label}</span>
        <span className={styles.rangeFieldBounds}>
          Min {floor} — Maks {ceiling}
        </span>
      </div>
      <div className={styles.rangeInputs}>
        <input
          type="number"
          value={min}
          min={floor}
          max={ceiling}
          onChange={(event) => onMinChange(Number(event.target.value))}
          aria-label={`${label} minimum`}
        />
        <DualRangeSlider
          label={label}
          min={min}
          max={max}
          floor={floor}
          ceiling={ceiling}
          onMinChange={onMinChange}
          onMaxChange={onMaxChange}
        />
        <input
          type="number"
          value={max}
          min={floor}
          max={ceiling}
          onChange={(event) => onMaxChange(Number(event.target.value))}
          aria-label={`${label} maksimum`}
        />
      </div>
      <p className={styles.rangeHint}>{hint}</p>
    </div>
  )
}
