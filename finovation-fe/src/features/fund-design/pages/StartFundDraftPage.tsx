import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router"

import { createFundDraft } from "@/features/fund-design/api/fundDraftApi"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import { useFundDraftLimits } from "@/features/fund-design/hooks/useFundDraftLimits"
import {
  formatPortfolioSize,
  isPortfolioSizeReady,
  limitBarPosition,
  parsePortfolioSize,
} from "@/features/fund-design/lib/portfolioSize"
import { FUND_TYPE_LABELS } from "@/features/fund-design/model/fundDraftSchemas"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import TextField from "@/shared/ui/TextField"
import styles from "@/features/fund-design/styles/StartFundDraftPage.module.css"

const CREATE_ERROR_FALLBACK =
  "Fon taslağı oluşturulamadı. Lütfen tekrar deneyin."

const UNIVERSE_ITEMS = [
  "Sistem tarafından tanımlanan BIST payları",
  "Kısa vadeli likidite bileşeni",
] as const

export default function StartFundDraftPage() {
  const navigate = useNavigate()
  const {
    limits,
    error: limitsError,
    reload: reloadLimits,
  } = useFundDraftLimits()
  const [sizeInput, setSizeInput] = useState("")
  const [formError, setFormError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canContinue = isPortfolioSizeReady(sizeInput, limits)
  const marker = limits == null ? null : limitBarPosition(sizeInput, limits)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = parsePortfolioSize(sizeInput)
    if (!canContinue || value == null) return

    setFormError("")
    setIsSubmitting(true)

    try {
      const draft = await createFundDraft(value)
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
        <header>
          <p className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            YENİ FON TASLAĞI
          </p>
          <h2 className={styles.sectionTitle}>Fon taslağını başlatın</h2>
          <p className={styles.intro}>
            Başlangıç portföy büyüklüğünü belirleyin. Strateji ve kurallar bir
            sonraki adımda tanımlanacaktır.
          </p>
        </header>

        {formError && <FormAlert>{formError}</FormAlert>}
        {limitsError && (
          <FormAlert>
            {limitsError}
            <button
              className={styles.retry}
              type="button"
              onClick={reloadLimits}
            >
              Tekrar dene
            </button>
          </FormAlert>
        )}

        <div className={styles.grid}>
          <form
            id="start-fund-draft-form"
            className={styles.formCard}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <h3 className={styles.blockTitle}>Başlangıç Bilgisi</h3>
            <TextField
              id="initialPortfolioSize"
              label="Başlangıç Portföy Büyüklüğü *"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Tutar girin"
              value={sizeInput}
              endAdornment="TL"
              className={styles.sizeInput}
              onChange={(value) => {
                setSizeInput(formatPortfolioSize(value))
                setFormError("")
              }}
            />
            <p className={styles.hint}>
              Bu tutar önerilen ağırlıkların parasal karşılıklarının
              hesaplanmasında kullanılır.
            </p>
            {limits && (
              <div
                className={styles.limitBar}
                aria-label={`İzin verilen aralık ${formatPortfolioSize(limits.minInitialPortfolioSize)} TL ile ${formatPortfolioSize(limits.maxInitialPortfolioSize)} TL arası`}
              >
                <div className={styles.limitLabels}>
                  <span>
                    Min {formatPortfolioSize(limits.minInitialPortfolioSize)} TL
                  </span>
                  <span>
                    Max {formatPortfolioSize(limits.maxInitialPortfolioSize)} TL
                  </span>
                </div>
                <div className={styles.limitTrack}>
                  {marker != null && (
                    <span
                      className={[
                        styles.limitMarker,
                        canContinue
                          ? styles.limitMarkerOk
                          : styles.limitMarkerOff,
                      ].join(" ")}
                      style={{ left: `${marker * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}
          </form>

          <aside className={styles.summary} aria-label="Fon taslağı özeti">
            <h3 className={styles.blockTitle}>Fon Taslağı Özeti</h3>

            <p className={styles.summaryLabel}>FON TÜRÜ</p>
            <p className={styles.summaryValue}>
              {FUND_TYPE_LABELS.EQUITY_INTENSIVE}
            </p>

            <p className={styles.summaryLabel}>YATIRIM EVRENİ</p>
            <ul className={styles.summaryList}>
              {UNIVERSE_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className={styles.summaryLabel}>PARA BİRİMİ</p>
            <p className={styles.summaryValue}>TRY</p>

            <p className={styles.summaryLabel}>İZAHNAME VE KURAL KONTROLÜ</p>
            <div className={styles.progressHead}>
              <span>Portföy uygunluğu</span>
              <span className={styles.progressStatus}>Henüz hesaplanmadı</span>
            </div>
            <div className={styles.progressTrack} />
            <p className={styles.statusNote}>
              AI analizi sonrasında aktifleşir.
            </p>

            <Button
              className={styles.continue}
              type="submit"
              form="start-fund-draft-form"
              disabled={!canContinue}
              isLoading={isSubmitting}
              loadingText="Oluşturuluyor…"
            >
              Devam Et →
            </Button>
          </aside>
        </div>

        <p className={styles.disclaimer}>
          Bu modül gerçek fon kuruluşu veya emir iletimi yapmaz; karar destek
          amaçlı fon taslağı üretir.
        </p>
      </section>
    </FundDesignLayout>
  )
}
