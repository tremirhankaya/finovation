import { type MouseEvent, type ReactNode, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import styles from "@/shared/ui/Dialog.module.css"

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

type DialogProps = {
  open: boolean
  children: ReactNode
  className: string
  labelledBy: string
  describedBy?: string
  role?: "dialog" | "alertdialog"
  isBusy?: boolean
  onClose: () => void
}

export default function Dialog({
  open,
  children,
  className,
  labelledBy,
  describedBy,
  role = "dialog",
  isBusy = false,
  onClose,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const isBusyRef = useRef(isBusy)

  useEffect(() => {
    onCloseRef.current = onClose
    isBusyRef.current = isBusy
  }, [isBusy, onClose])

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      )

    const initialFocus = window.setTimeout(() => {
      const [firstElement] = focusableElements()
      ;(firstElement ?? dialogRef.current)?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusyRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== "Tab") return

      const elements = focusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const firstElement = elements[0]
      const lastElement = elements[elements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(initialFocus)
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isBusy) {
      onClose()
    }
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className={className}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
