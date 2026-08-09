import finovationLogo from "@/shared/assets/finovation-logo.png"
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
        <img src={finovationLogo} alt="" />
      </span>
      <span className={styles.wordmark}>
        <span className={styles.text}>Finovation</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </div>
  )
}
