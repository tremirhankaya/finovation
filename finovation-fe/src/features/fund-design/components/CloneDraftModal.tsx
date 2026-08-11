import { useState, useEffect } from "react"
import { getFundDraftInit } from "@/features/fund-design/api/fundDraftApi"
import {
  FUND_NAME_MIN_LETTERS,
  validateFundName,
} from "@/features/fund-design/lib/fundName"
import styles from "@/features/fund-design/styles/CloneDraftModal.module.css"
import FormAlert from "@/shared/ui/FormAlert"
import TextField from "@/shared/ui/TextField"

export type CloneDraftPayload = {
  name: string
  initialPortfolioSize: number
  unitPrice: number
}

type CloneDraftModalProps = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (payload: CloneDraftPayload) => Promise<void>
  initialName?: string
  initialSize?: number
  initialPrice?: number
}

type CheckStatus = "empty" | "invalid" | "tooLow" | "tooHigh" | "ok"

type FieldCheck = {
  status: CheckStatus
  message: string
  amount: number | null
}

type CreateLimits = {
  minInitialPortfolioSize: number
  maxInitialPortfolioSize: number
  minUnitPrice: number
  maxUnitPrice: number
}

const DEFAULT_LIMITS: CreateLimits = {
  minInitialPortfolioSize: 1_000_000,
  maxInitialPortfolioSize: 100_000_000_000,
  minUnitPrice: 1,
  maxUnitPrice: 1_000,
}

function formatAmount(value: number): string {
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`
}

function normalizeAmountInput(raw: string, allowDecimals: boolean): string {
  const cleaned = raw.replace(/[^\d,]/g, "")
  const [integerPart, ...rest] = cleaned.split(",")
  const digits = integerPart.replace(/^0+(?=\d)/, "")
  const grouped = digits ? Number(digits).toLocaleString("tr-TR") : ""

  if (!allowDecimals || rest.length === 0) return grouped
  return `${grouped},${rest.join("").slice(0, 2)}`
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\./g, "").replace(",", ".")
  if (!cleaned.trim()) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function checkAmount(raw: string, min: number, max: number): FieldCheck {
  const amount = parseAmount(raw)

  if (amount === null) {
    return { status: "empty", message: "", amount: null }
  }
  if (amount <= 0) {
    return { status: "invalid", message: "Geçerli bir tutar girin.", amount }
  }
  if (amount < min) {
    return {
      status: "tooLow",
      message: `En az ${formatAmount(min)} girilmeli.`,
      amount,
    }
  }
  if (amount > max) {
    return {
      status: "tooHigh",
      message: `En fazla ${formatAmount(max)} girilebilir.`,
      amount,
    }
  }
  return { status: "ok", message: "", amount }
}

function checkName(raw: string): FieldCheck {
  if (!raw.trim()) return { status: "empty", message: "", amount: null }

  const message = validateFundName(raw)
  if (message) return { status: "invalid", message, amount: null }

  return { status: "ok", message: "", amount: null }
}

function NameStatus({ check }: { check: FieldCheck }) {
  const isOk = check.status === "ok"
  const isEmpty = check.status === "empty"

  const dotClass = isEmpty
    ? styles.statusDotIdle
    : isOk
      ? styles.statusDotOk
      : styles.statusDotBad

  return (
    <div className={styles.limitMeter}>
      <div className={styles.statusRow}>
        <span className={[styles.statusDot, dotClass].join(" ")} />
        <span className={isOk ? styles.statusValue : styles.statusValueMuted}>
          {isEmpty ? "Ad girilmedi" : isOk ? "Kurallara uygun" : "Geçersiz ad"}
        </span>
      </div>
      <span className={styles.limitRange}>
        En az {FUND_NAME_MIN_LETTERS} harf · sayı içeremez · benzersiz olmalı
      </span>
      {check.message && (
        <span className={styles.limitBad} role="status">
          {check.message}
        </span>
      )}
    </div>
  )
}

type LimitMeterProps = {
  check: FieldCheck
  min: number
  max: number
}

function LimitMeter({ check, min, max }: LimitMeterProps) {
  const isOk = check.status === "ok"
  const isEmpty = check.status === "empty"

  const dotClass = isEmpty
    ? styles.statusDotIdle
    : isOk
      ? styles.statusDotOk
      : styles.statusDotBad

  return (
    <div className={styles.limitMeter}>
      <div className={styles.statusRow}>
        <span className={[styles.statusDot, dotClass].join(" ")} />
        <span className={isOk ? styles.statusValue : styles.statusValueMuted}>
          {check.amount === null ? "Değer girilmedi" : formatAmount(check.amount)}
        </span>
      </div>
      <span className={styles.limitRange}>
        Min: {formatAmount(min)} · Max: {formatAmount(max)}
      </span>
      {check.message && (
        <span className={styles.limitBad} role="status">
          {check.message}
        </span>
      )}
    </div>
  )
}

export default function CloneDraftModal({
  isOpen,
  onClose,
  onSubmit,
  initialName = "",
  initialSize = 10000000,
  initialPrice = 1,
}: CloneDraftModalProps) {
  const [name, setName] = useState(initialName)
  const [size, setSize] = useState(() =>
    normalizeAmountInput(String(initialSize), false),
  )
  const [price, setPrice] = useState(() =>
    normalizeAmountInput(String(initialPrice), true),
  )
  
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [limits, setLimits] = useState<CreateLimits>(DEFAULT_LIMITS)
  const [touched, setTouched] = useState({
    name: false,
    size: false,
    price: false,
  })

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setSize(normalizeAmountInput(String(initialSize), false))
      setPrice(normalizeAmountInput(String(initialPrice), true))
      setError(null)
      setIsSubmitting(false)
      setTouched({ name: false, size: false, price: false })
    }
  }, [isOpen, initialName, initialSize, initialPrice])

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()

    void (async () => {
      try {
        const init = await getFundDraftInit({
          page: "START",
          signal: controller.signal,
        })
        if (init.page !== "START" || controller.signal.aborted) return
        setLimits({
          minInitialPortfolioSize: init.minInitialPortfolioSize,
          maxInitialPortfolioSize: init.maxInitialPortfolioSize,
          minUnitPrice: init.minUnitPrice,
          maxUnitPrice: init.maxUnitPrice,
        })
      } catch {
        if (controller.signal.aborted) return
      }
    })()

    return () => controller.abort()
  }, [isOpen])

  if (!isOpen) return null

  const nameCheck = checkName(name)
  const sizeCheck = checkAmount(
    size,
    limits.minInitialPortfolioSize,
    limits.maxInitialPortfolioSize,
  )
  const priceCheck = checkAmount(price, limits.minUnitPrice, limits.maxUnitPrice)

  const isFormValid =
    nameCheck.status === "ok" &&
    sizeCheck.status === "ok" &&
    priceCheck.status === "ok"

  const fieldError = (check: FieldCheck, isTouched: boolean) => {
    if (!isTouched) return undefined
    if (check.status === "empty") return "Bu alan zorunlu."
    return check.message || undefined
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setTouched({ name: true, size: true, price: true })
    if (!isFormValid) return

    setError(null)
    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        initialPortfolioSize: sizeCheck.amount!,
        unitPrice: priceCheck.amount!,
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.",
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.mainContent}>
          <div className={styles.header}>
            <h2 className={styles.title}>Taslaktan Fon Oluştur</h2>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <p className={styles.description}>
              Fon, seçilen portföydeki hisseler ve güncel ağırlıklarıyla
              oluşturulur. Fon adı benzersiz olmalıdır.
            </p>

            {error && <FormAlert>{error}</FormAlert>}

            <div className={styles.formGroup}>
              <TextField
                id="fundName"
                label="Fon Adı *"
                value={name}
                onChange={setName}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                error={fieldError(nameCheck, touched.name)}
                placeholder="Örn: Teknoloji Şirketleri Fonu"
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <TextField
                  id="portfolioSize"
                  label="Portföy Büyüklüğü *"
                  inputMode="numeric"
                  value={size}
                  onChange={(val) => setSize(normalizeAmountInput(val, false))}
                  onBlur={() => setTouched((prev) => ({ ...prev, size: true }))}
                  endAdornment="TL"
                  error={fieldError(sizeCheck, touched.size)}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <TextField
                  id="unitPrice"
                  label="Pay Fiyatı *"
                  inputMode="decimal"
                  value={price}
                  onChange={(val) => setPrice(normalizeAmountInput(val, true))}
                  onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
                  endAdornment="TL"
                  error={fieldError(priceCheck, touched.price)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isSubmitting}
              >
                İptal
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting || !isFormValid}
              >
                {isSubmitting ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <h3>İzahname Kısıtları</h3>
          </div>
          
          <div className={styles.sidebarSection}>
            <h4>Fon Adı</h4>
            <NameStatus check={nameCheck} />
          </div>
          
          <div className={styles.sidebarSection}>
            <h4>Portföy Büyüklüğü</h4>
            <LimitMeter
              check={sizeCheck}
              min={limits.minInitialPortfolioSize}
              max={limits.maxInitialPortfolioSize}
            />
          </div>

          <div className={styles.sidebarSection}>
            <h4>Pay Fiyatı</h4>
            <LimitMeter
              check={priceCheck}
              min={limits.minUnitPrice}
              max={limits.maxUnitPrice}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
