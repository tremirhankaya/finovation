import type { InputHTMLAttributes, ReactNode } from "react"
import styles from "@/shared/ui/TextField.module.css"

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  endAdornment?: ReactNode
}

export default function TextField({
  id,
  label,
  value,
  onChange,
  error,
  endAdornment,
  className = "",
  ...inputProps
}: TextFieldProps) {
  const inputClasses = [
    styles.input,
    error && styles.errorInput,
    endAdornment && styles.withAdornment,
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          {...inputProps}
          id={id}
          name={inputProps.name ?? id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClasses}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {endAdornment && (
          <span className={styles.adornment}>{endAdornment}</span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.errorMessage}>
          {error}
        </p>
      )}
    </div>
  )
}
