import styles from "@/features/fund-design/styles/FundDesignModeOptions.module.css"

export type FundDesignMode = "AI_ASSISTED" | "MANUAL"

type ModeOption = {
  mode: FundDesignMode
  label: string
  description: string
  benefits: string[]
  recommended: boolean
  icon: React.ReactNode
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: "AI_ASSISTED",
    label: "AI Destekli Fon Oluştur",
    description:
      "Kendi kısıtlarınızı girin, yapay zeka izahnameye ve kısıtlarınıza uygun portföy alternatifleri önersin.",
    benefits: [
      "İzahname kurallarına uygun alternatifler",
      "Sektör dağılımı ve likidite dengesi hazır",
      "Öneriyi dilediğiniz gibi düzenleyin",
    ],
    recommended: true,
    icon: (
      <>
        <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5 10.1 10.9 5.5 9l4.6-1.4L12 3z" />
        <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
      </>
    ),
  },
  {
    mode: "MANUAL",
    label: "Manuel Fon Oluştur",
    description:
      "Portföyü sıfırdan kendiniz kurun. Hisseleri tek tek ekleyip ağırlıkları elinizle belirlersiniz.",
    benefits: [],
    recommended: false,
    icon: (
      <>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <path d="M1 14h6M9 8h6M17 16h6" />
      </>
    ),
  },
]

type FundDesignModeOptionsProps = {
  selectedMode: FundDesignMode
  onSelect: (mode: FundDesignMode) => void
}

export default function FundDesignModeOptions({
  selectedMode,
  onSelect,
}: FundDesignModeOptionsProps) {
  return (
    <div className={styles.options} role="radiogroup" aria-label="Tasarım modu">
      {MODE_OPTIONS.map((option) => {
        const isSelected = option.mode === selectedMode

        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={[
              styles.option,
              isSelected ? styles.optionSelected : "",
            ].join(" ")}
            onClick={() => onSelect(option.mode)}
          >
            <span className={styles.optionHeader}>
              <span className={styles.optionIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">{option.icon}</svg>
              </span>
              {option.recommended && (
                <span className={styles.recommendedBadge}>Tavsiye Edilen</span>
              )}
              <span className={styles.radio} aria-hidden="true">
                <span className={styles.radioDot} />
              </span>
            </span>

            <span className={styles.optionBody}>
              <span className={styles.optionTitle}>{option.label}</span>
              <span className={styles.optionDescription}>
                {option.description}
              </span>

              {option.benefits.length > 0 && (
                <ul className={styles.benefits}>
                  {option.benefits.map((benefit) => (
                    <li key={benefit} className={styles.benefit}>
                      <span className={styles.benefitIcon}>
                        <CheckIcon />
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
