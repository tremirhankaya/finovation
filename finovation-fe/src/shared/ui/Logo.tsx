import styles from "@/shared/ui/Logo.module.css"

type LogoProps = {
  variant?: "light" | "dark"
  size?: "default" | "small"
  subtitle?: string
}

export default function Logo({
  variant = "light",
  size = "default",
  subtitle,
}: LogoProps) {
  return (
    <div className={`${styles.logo} ${styles[variant]} ${styles[size]}`}>
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path
            d="M3 14 7 8l4 3 4-6 2 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17" cy="7" r="2" fill="currentColor" />
        </svg>
      </span>
      <span className={styles.wordmark}>
        <span className={styles.text}>Finovation</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </div>
  )
}
