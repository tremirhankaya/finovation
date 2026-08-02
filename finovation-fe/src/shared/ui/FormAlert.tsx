import type { ReactNode } from "react"
import styles from "@/shared/ui/FormAlert.module.css"

export default function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className={styles.alert}>
      {children}
    </div>
  )
}
