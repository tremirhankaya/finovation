import type { ButtonHTMLAttributes, ReactNode } from "react"
import styles from "@/css/Button.module.css"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: "primary" | "link" | "icon"
  fullWidth?: boolean
  isLoading?: boolean
  loadingText?: string
}

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  isLoading = false,
  loadingText = "İşlem yapılıyor…",
  className = "",
  disabled,
  type = "button",
  ...buttonProps
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? loadingText : children}
    </button>
  )
}
