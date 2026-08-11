import { type FormEvent, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"

import { createFundDraft } from "@/features/fund-design/api/fundDraftApi"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import ProspectusRulesPanel from "@/features/fund-design/components/ProspectusRulesPanel"
import { useFundDraftInit } from "@/features/fund-design/hooks/useFundDraftInit"
import {
  formatPortfolioSize,
  isPortfolioSizeReady,
  parsePortfolioSize,
} from "@/features/fund-design/lib/portfolioSize"
import {
  formatUnitPrice,
  isUnitPriceReady,
  parseUnitPrice,
} from "@/features/fund-design/lib/unitPrice"
import {
  isFundNameReady,
  validateFundName,
} from "@/features/fund-design/lib/fundName"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import TextField from "@/shared/ui/TextField"
import styles from "@/features/fund-design/styles/StartFundDraftPage.module.css"

const CREATE_ERROR_FALLBACK =
  "Fon taslağı oluşturulamadı. Lütfen tekrar deneyin."

function EquityIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 16.5 9 11l3.5 3.5L20 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 7h5v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LiquidityIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="4"
        width="14"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 9h6M9 13h6M9 17h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function StartFundDraftPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const designMode =
    searchParams.get("mode") === "MANUAL" ? "MANUAL" : "AI_ASSISTED"
  const {
    init,
    error: initError,
    isLoading,
    reload: reloadInit,
  } = useFundDraftInit({ page: "START" })
  const startInit = init?.page === "START" ? init : null
  const [fundName, setFundName] = useState("")
  const [fundNameError, setFundNameError] = useState("")
  const [portfolioSizeInput, setPortfolioSizeInput] = useState("")
  const [unitPriceInput, setUnitPriceInput] = useState("")
  const [portfolioSizeError, setPortfolioSizeError] = useState("")
  const [unitPriceError, setUnitPriceError] = useState("")
  const [portfolioFeedback, setPortfolioFeedback] =
    useState<"idle" | "rejected">("idle")
  const [unitPriceFeedback, setUnitPriceFeedback] =
    useState<"idle" | "rejected">("idle")
  const [formError, setFormError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!startInit) return
    setPortfolioSizeInput(
      (current) =>
        current || formatPortfolioSize(startInit.minInitialPortfolioSize),
    )
    setUnitPriceInput((current) => current || formatUnitPrice("1"))
  }, [startInit])

  const nameReady = isFundNameReady(fundName)
  const portfolioSizeReady = isPortfolioSizeReady(portfolioSizeInput, startInit)
  const unitPriceReady = isUnitPriceReady(unitPriceInput, startInit)
  const canContinue =
    Boolean(startInit) && nameReady && portfolioSizeReady && unitPriceReady

  useEffect(() => {
    if (portfolioSizeReady) setPortfolioSizeError("")
  }, [portfolioSizeReady])

  useEffect(() => {
    if (unitPriceReady) setUnitPriceError("")
  }, [unitPriceReady])

  function pulseReject(field: "portfolio" | "unit") {
    const setFeedback =
      field === "portfolio" ? setPortfolioFeedback : setUnitPriceFeedback
    setFeedback("idle")
    requestAnimationFrame(() => setFeedback("rejected"))
    window.setTimeout(() => setFeedback("idle"), 450)
  }

  function portfolioSizeRangeText() {
    if (!startInit) return "Portföy büyüklüğü izin verilen aralıkta olmalıdır."
    return `İzin verilen aralık: ${formatPortfolioSize(startInit.minInitialPortfolioSize)} – ${formatPortfolioSize(startInit.maxInitialPortfolioSize)} TL`
  }

  function unitPriceRangeText() {
    if (!startInit) return "Fon pay fiyatı izin verilen aralıkta olmalıdır."
    return `İzin verilen aralık: ${startInit.minUnitPrice} – ${startInit.maxUnitPrice} TL`
  }

  function validatePortfolioSizeField(raw: string) {
    if (!startInit) return
    if (isPortfolioSizeReady(raw, startInit)) {
      setPortfolioSizeError("")
      return
    }
    setPortfolioSizeError(portfolioSizeRangeText())
    pulseReject("portfolio")
  }

  function validateUnitPriceField(raw: string) {
    if (!startInit) return
    if (isUnitPriceReady(raw, startInit)) {
      setUnitPriceError("")
      return
    }
    setUnitPriceError(unitPriceRangeText())
    pulseReject("unit")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nameError = validateFundName(fundName)
    if (nameError) {
      setFundNameError(nameError)
      return
    }

    validatePortfolioSizeField(portfolioSizeInput)
    validateUnitPriceField(unitPriceInput)

    const portfolioSize = parsePortfolioSize(portfolioSizeInput)
    const unitPrice = parseUnitPrice(unitPriceInput)
    if (
      !canContinue ||
      !startInit ||
      portfolioSize == null ||
      unitPrice == null
    ) {
      return
    }

    setFormError("")
    setFundNameError("")
    setPortfolioSizeError("")
    setUnitPriceError("")
    setIsSubmitting(true)

    try {
      const draft = await createFundDraft({
        name: fundName.trim(),
        initialPortfolioSize: portfolioSize,
        unitPrice,
        designMode,
      })
      await navigate(
        designMode === "MANUAL"
          ? `/fund-design/${draft.draftId}/edit`
          : `/fund-design/${draft.draftId}/strategy`,
      )
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : CREATE_ERROR_FALLBACK,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FundDesignLayout step={1} designMode={designMode} isLoading={isLoading}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>FON TASARIMI · ADIM 1</span>
          <h2 className={styles.sectionTitle}>Fonunuzu oluşturmaya başlayın</h2>
          <p className={styles.intro}>
            Temel bilgileri girin; tasarım akışında portföyünüzü adım adım
            şekillendirin.
          </p>
        </header>

        {formError && <FormAlert>{formError}</FormAlert>}
        {initError && (
          <FormAlert>
            {initError}
            <button className={styles.retry} type="button" onClick={reloadInit}>
              Tekrar dene
            </button>
          </FormAlert>
        )}

        <div className={styles.grid}>
          <div className={styles.mainColumn}>
            <form
              id="start-fund-draft-form"
              className={styles.formCard}
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className={styles.formCardHeader}>
                <div>
                  <span className={styles.cardKicker}>TEMEL BİLGİLER</span>
                  <h3 className={styles.blockTitle}>Fon Bilgileri</h3>
                </div>
                <span
                  className={styles.currencyBadge}
                  title="Para birimi sistem tarafından atanır"
                >
                  {startInit?.defaultCurrency ?? "TRY"}
                </span>
              </div>

              <div className={styles.fieldStack}>
                <TextField
                  id="fundName"
                  label="Fon Adı *"
                  autoComplete="off"
                  placeholder="Örn. Finovation Hisse Senedi Fonu"
                  value={fundName}
                  error={fundNameError}
                  onChange={(value) => {
                    setFundName(value)
                    setFundNameError(
                      value.trim() ? (validateFundName(value) ?? "") : "",
                    )
                    setFormError("")
                  }}
                />

                <div className={styles.moneyRow}>
                  <TextField
                    id="initialPortfolioSize"
                    label="Portföy Büyüklüğü *"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={
                      startInit
                        ? formatPortfolioSize(startInit.minInitialPortfolioSize)
                        : "1.000.000"
                    }
                    value={portfolioSizeInput}
                    endAdornment="TL"
                    error={portfolioSizeError}
                    className={
                      portfolioFeedback === "rejected"
                        ? styles.inputRejected
                        : ""
                    }
                    onBlur={() =>
                      validatePortfolioSizeField(portfolioSizeInput)
                    }
                    onChange={(value) => {
                      const next = formatPortfolioSize(value)
                      setPortfolioSizeInput(next)
                      setFormError("")
                      if (
                        portfolioSizeError &&
                        isPortfolioSizeReady(next, startInit)
                      ) {
                        setPortfolioSizeError("")
                      }
                    }}
                  />

                  <TextField
                    id="unitPrice"
                    label="Fon Pay Fiyatı *"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="1"
                    value={unitPriceInput}
                    endAdornment="TL"
                    error={unitPriceError}
                    className={
                      unitPriceFeedback === "rejected"
                        ? styles.inputRejected
                        : ""
                    }
                    onBlur={() => validateUnitPriceField(unitPriceInput)}
                    onChange={(value) => {
                      const next = formatUnitPrice(value)
                      setUnitPriceInput(next)
                      setFormError("")
                      if (unitPriceError && isUnitPriceReady(next, startInit)) {
                        setUnitPriceError("")
                      }
                    }}
                  />
                </div>
              </div>
            </form>

            <section
              className={styles.universeCard}
              aria-labelledby="universe-title"
            >
              <div className={styles.universeHeader}>
                <div>
                  <span className={styles.cardKicker}>MODEL EVRENİ</span>
                  <h3 id="universe-title" className={styles.blockTitle}>
                    Yatırım Evreni
                  </h3>
                  <p className={styles.universeIntro}>
                    Tasarımda kullanılacak varlık türleri.
                  </p>
                </div>
                <span className={styles.universeBadge}>2 bileşen</span>
              </div>
              <div className={styles.universeTiles}>
                <article className={styles.universeTile}>
                  <span className={styles.universeIcon}>
                    <EquityIcon />
                  </span>
                  <div>
                    <p className={styles.universeTitle}>Hisse Senetleri</p>
                    <p className={styles.universeText}>
                      BIST&apos;te işlem gören uygun hisseler
                    </p>
                  </div>
                </article>
                <article className={styles.universeTile}>
                  <span className={styles.universeIcon}>
                    <LiquidityIcon />
                  </span>
                  <div>
                    <p className={styles.universeTitle}>TPP (1 Gün)</p>
                    <p className={styles.universeText}>
                      Takasbank Para Piyasası (1 Gün)
                    </p>
                  </div>
                </article>
              </div>
            </section>

            <div className={styles.actions}>
              <Button
                className={styles.continue}
                type="submit"
                form="start-fund-draft-form"
                disabled={!canContinue}
                isLoading={isSubmitting}
                loadingText="Oluşturuluyor…"
              >
                İleri →
              </Button>
            </div>
          </div>

          <ProspectusRulesPanel
            init={startInit}
            startCreateLimits={startInit}
            startCreateCompliance={{
              portfolioSizeOk: portfolioSizeReady,
              unitPriceOk: unitPriceReady,
            }}
          />
        </div>
      </section>
    </FundDesignLayout>
  )
}
