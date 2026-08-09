import DualRangeSlider from "@/features/optimization/components/DualRangeSlider"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type ConstraintRangeInputsProps = {
  label: string
  min: number
  max: number
  floor: number
  ceiling: number
  minWidth: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
  hint: string
  inputPrefix?: string
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export default function ConstraintRangeInputs({
  label,
  min,
  max,
  floor,
  ceiling,
  minWidth,
  onMinChange,
  onMaxChange,
  hint,
  inputPrefix,
}: ConstraintRangeInputsProps) {
  return (
    <div className={styles.rangeField}>
      <div className={styles.rangeFieldHeader}>
        <span className={styles.rangeFieldLabel}>{label}</span>
        <span className={styles.rangeFieldBounds}>
          Min {floor} — Maks {ceiling}
        </span>
      </div>
      <DualRangeSlider
        id={slugify(label)}
        label={label}
        min={floor}
        max={ceiling}
        valueMin={min}
        valueMax={max}
        minGap={minWidth}
        inputPrefix={inputPrefix}
        hint={hint}
        onChange={({ min: nextMin, max: nextMax }) => {
          onMinChange(nextMin)
          onMaxChange(nextMax)
        }}
      />
    </div>
  )
}
