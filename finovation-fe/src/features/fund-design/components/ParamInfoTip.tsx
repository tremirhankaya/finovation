import { useEffect, useId, useRef, useState } from "react"

import styles from "@/features/fund-design/styles/ParamInfoTip.module.css"

type ParamInfoTipProps = {
  label: string
  children: string
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10.5v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
    </svg>
  )
}

export default function ParamInfoTip({ label, children }: ParamInfoTipProps) {
  const tipId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div
      className={styles.root}
      ref={rootRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={[styles.trigger, open ? styles.triggerOpen : ""]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={open}
        aria-controls={tipId}
        aria-label={`${label} hakkında bilgi`}
        onClick={() => setOpen((current) => !current)}
      >
        <InfoIcon />
      </button>
      <div
        id={tipId}
        className={[styles.panel, open ? styles.panelOpen : ""]
          .filter(Boolean)
          .join(" ")}
        role="tooltip"
        aria-hidden={!open}
      >
        {children}
      </div>
    </div>
  )
}
