import { useState, type ReactNode, type ReactElement } from "react"
import styles from "./Tooltip.module.css"

interface TooltipProps {
  content: ReactNode
  children: ReactElement
  position?: "top" | "bottom" | "left" | "right" | "top-start"
  fullWidth?: boolean
  forceVisible?: boolean
}

export function Tooltip({
  content,
  children,
  position = "top",
  fullWidth = false,
  forceVisible = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const showTooltip = isVisible || forceVisible

  return (
    <div
      className={styles.tooltipContainer}
      style={fullWidth ? { display: "block", width: "100%" } : undefined}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {showTooltip && (
        <div className={`${styles.tooltipBox} ${styles[position]}`}>
          {content}
          <div className={styles.tooltipArrow} />
        </div>
      )}
    </div>
  )
}
