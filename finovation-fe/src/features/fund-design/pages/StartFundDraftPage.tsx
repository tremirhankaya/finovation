import { type FormEvent, useEffect, useState } from "react"
import { useNavigate } from "react-router"

import { createFundDraft } from "@/features/fund-design/api/fundDraftApi"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import { useFundDraftInit } from "@/features/fund-design/hooks/useFundDraftInit"
import {
  formatUnitPrice,
  isUnitPriceReady,
  parseUnitPrice,
} from "@/features/fund-design/lib/unitPrice"
import { isFundNameReady, validateFundName } from "@/features/fund-design/lib/fundName"
import { ABOVE_5_PCT_SUM_MAX } from "@/features/fund-design/model/prospectusConstants"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import TextField from "@/shared/ui/TextField"
import styles from "@/features/fund-design/styles/StartFundDraftPage.module.css"

const CREATE_ERROR_FALLBACK =
  "Fon taslağı oluşturulamadı. Lütfen tekrar deneyin."

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

function StatusDot({ tone }: { tone: "ok" | "info" }) {
  return (
    <span
      className={[styles.statusDot, tone === "ok" ? styles.dotOk : styles.dotInfo]
        .join(" ")}
      aria-hidden="true"
    />
  )
}

export default function StartFundDraftPage() {
  const navigate = useNavigate()
  const {
    init,
    error: initError,
    reload: reloadInit,
  } = useFundDraftInit()
  const [fundName, setFundName] = useState("")
  const [fundNameError, setFundNameError] = useState("")
  const [unitPriceInput, setUnitPriceInput] = useState("")
  const [currencyCode, setCurrencyCode] = useState("")
  const [formError, setFormError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!init) return
    setCurrencyCode((current) => current || init.defaultCurrency)
    setUnitPriceInput((current) => current || formatUnitPrice("1"))
  }, [init])

  const nameReady = isFundNameReady(fundName)
  const unitPriceReady = isUnitPriceReady(unitPriceInput, init)
  const currencyReady =
    Boolean(currencyCode) &&
    Boolean(init?.currencies.some((currency) => currency.code === currencyCode))
  const canContinue = Boolean(init) && nameReady && unitPriceReady && currencyReady

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nameError = validateFundName(fundName)
    if (nameError) {
      setFundNameError(nameError)
      return
    }

    const unitPrice = parseUnitPrice(unitPriceInput)
    if (!canContinue || !init || unitPrice == null) return

    setFormError("")
    setFundNameError("")
    setIsSubmitting(true)

    try {
      const draft = await createFundDraft({
        name: fundName.trim(),
        initialPortfolioSize: init.minInitialPortfolioSize,
        unitPrice,
      })
      await navigate(`/fund-design/${draft.draftId}/strategy`)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : CREATE_ERROR_FALLBACK,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FundDesignLayout step={1}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.sectionTitle}>1. Taslağı Başlat</h2>
          <p className={styles.introLead}>Fon Tasarımı</p>
          <p className={styles.intro}>
            Yeni fon oluşturmak için temel bilgileri girin ve tasarım sürecini
            başlatın.
          </p>
        </header>

        {formError && <FormAlert>{formError}</FormAlert>}
        {initError && (
          <FormAlert>
            {initError}
            <button
              className={styles.retry}
              type="button"
              onClick={reloadInit}
            >
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
              <h3 className={styles.blockTitle}>Fon Bilgileri</h3>

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

              <div className={styles.fundInfoRow}>
                <TextField
                  id="unitPrice"
                  label={
                    <span className={styles.unitPriceLabel}>
                      Fon Pay Fiyatı (TL) *
                      <span
                        className={styles.infoIcon}
                        title="İzin verilen aralık profil kurallarına göre kontrol edilir."
                      >
                        <InfoIcon />
                      </span>
                    </span>
                  }
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="1"
                  value={unitPriceInput}
                  className={styles.unitPriceInput}
                  onChange={(value) => {
                    setUnitPriceInput(formatUnitPrice(value))
                    setFormError("")
                  }}
                />

                <label className={styles.selectField} htmlFor="currency">
                  <span className={styles.selectLabel}>Para Birimi *</span>
                  <select
                    id="currency"
                    className={styles.select}
                    value={currencyCode}
                    disabled={!init}
                    onChange={(event) => {
                      setCurrencyCode(event.target.value)
                      setFormError("")
                    }}
                  >
                    {!init && <option value="">Yükleniyor…</option>}
                    {init?.currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </form>

            <section className={styles.universeCard} aria-labelledby="universe-title">
              <h3 id="universe-title" className={styles.blockTitle}>
                Yatırım Evreni
              </h3>
              <p className={styles.universeIntro}>
                Tanımlı hisse evreni ve kısa vadeli likidite bileşeni
                kullanılacaktır.
              </p>
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

          <aside className={styles.rulesPanel} aria-label="İzahname ve kural kontrolü">
            <div className={styles.rulesHeader}>
              <h3 className={styles.blockTitle}>İzahname ve Kural Kontrolü</h3>
              <span className={styles.infoIcon} title="Kısıtlar fon izahnamesine göre kontrol edilir.">
                <InfoIcon />
              </span>
            </div>

            {init ? (
              <ul className={styles.ruleList}>
                <li className={styles.ruleItem}>
                  <StatusDot tone="ok" />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Hisse Senedi Oranı</p>
                    <p className={styles.ruleValue}>
                      %{init.minEquityWeightPct} - %{init.maxEquityWeightPct}
                    </p>
                  </div>
                  <span className={styles.ruleDash}>—</span>
                </li>
                <li className={styles.ruleItem}>
                  <StatusDot tone="ok" />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>TPP Oranı</p>
                    <p className={styles.ruleValue}>
                      %{init.minLiquidityTargetPct} - %
                      {init.maxLiquidityTargetPct}
                    </p>
                  </div>
                  <span className={styles.ruleDash}>—</span>
                </li>
                <li className={styles.ruleItem}>
                  <StatusDot tone="ok" />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Tek Hisse Ağırlığı</p>
                    <p className={styles.ruleValue}>
                      %{init.minSingleStockMaxPct} - %
                      {init.maxSingleStockMaxPct}
                    </p>
                  </div>
                  <span className={styles.ruleDash}>—</span>
                </li>
                <li className={styles.ruleItem}>
                  <StatusDot tone="ok" />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>
                      %5 Üzerindeki Hisselerin Toplamı
                    </p>
                    <p className={styles.ruleValue}>
                      ≤ %{ABOVE_5_PCT_SUM_MAX}
                    </p>
                  </div>
                  <span className={styles.ruleDash}>—</span>
                </li>
                <li className={styles.ruleItem}>
                  <StatusDot tone="info" />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Sektör Ağırlığı</p>
                    <p className={styles.ruleValue}>
                      Maks. %{Math.round(init.sectorMaxPct)}
                    </p>
                    <span className={styles.immutableTag}>
                      Kısıt (Değiştirilemez)
                    </span>
                  </div>
                  <span className={styles.ruleDash}>—</span>
                </li>
                <li className={styles.ruleItem}>
                  <StatusDot tone="ok" />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Hisse Sayısı</p>
                    <p className={styles.ruleValue}>
                      {init.minStockCount} - {init.maxStockCount}
                    </p>
                  </div>
                  <span className={styles.ruleDash}>—</span>
                </li>
              </ul>
            ) : (
              <p className={styles.rulesLoading}>Kısıtlar yükleniyor…</p>
            )}

            <div className={styles.legend}>
              <p className={styles.legendTitle}>Durum</p>
              <ul className={styles.legendList}>
                <li>
                  <span className={[styles.legendDot, styles.dotOk].join(" ")} />
                  Yeşil: Kendi Kriterinize ve İzahnameye Uygun
                </li>
                <li>
                  <span
                    className={[styles.legendDot, styles.dotWarn].join(" ")}
                  />
                  Turuncu: Yalnızca İzahnameye Uygun
                </li>
                <li>
                  <span
                    className={[styles.legendDot, styles.dotBad].join(" ")}
                  />
                  Kırmızı: İzahnameye Uygun Değil
                </li>
                <li>
                  <span
                    className={[styles.legendDot, styles.dotInfo].join(" ")}
                  />
                  Gri: Bilgi / Kısıt (Değiştirilemez)
                </li>
              </ul>
              <p className={styles.legendFoot}>
                Kısıtlar fon izahnamesine göre kontrol edilmektedir.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </FundDesignLayout>
  )
}
