import { ABOVE_5_PCT_SUM_MAX } from "@/features/fund-design/model/prospectusConstants"
import type { FundDraftInitLimits } from "@/features/fund-design/model/fundDraftSchemas"
import { formatPortfolioSize } from "@/features/fund-design/lib/portfolioSize"
import styles from "@/features/fund-design/styles/StartFundDraftPage.module.css"

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

type StatusTone = "ok" | "warn" | "bad" | "info"

function StatusDot({ tone }: { tone: StatusTone }) {
  const toneClass =
    tone === "ok"
      ? styles.dotOk
      : tone === "warn"
        ? styles.dotWarn
        : tone === "bad"
          ? styles.dotBad
          : styles.dotInfo

  return (
    <span
      className={[styles.statusDot, toneClass].join(" ")}
      aria-hidden="true"
    />
  )
}

export type StartCreateLimits = {
  minInitialPortfolioSize: number
  maxInitialPortfolioSize: number
  minUnitPrice: number
  maxUnitPrice: number
}

export type StartCreateCompliance = {
  portfolioSizeOk: boolean
  unitPriceOk: boolean
}

type ProspectusRulesPanelProps = {
  init: FundDraftInitLimits | null
  startCreateLimits?: StartCreateLimits | null
  startCreateCompliance?: StartCreateCompliance | null
}

export default function ProspectusRulesPanel({
  init,
  startCreateLimits = null,
  startCreateCompliance = null,
}: ProspectusRulesPanelProps) {
  return (
    <aside className={styles.rulesPanel} aria-label="İzahname ve kural kontrolü">
      <div className={styles.rulesHeader}>
        <h3 className={styles.blockTitle}>İzahname ve Kural Kontrolü</h3>
        <span
          className={styles.infoIcon}
          title="Kısıtlar fon izahnamesine göre kontrol edilir."
        >
          <InfoIcon />
        </span>
      </div>

      {init ? (
        <ul className={styles.ruleList}>
          {startCreateLimits ? (
            <>
              <li className={styles.ruleItem}>
                <StatusDot
                  tone={
                    startCreateCompliance == null ||
                    startCreateCompliance.portfolioSizeOk
                      ? "ok"
                      : "bad"
                  }
                />
                <div className={styles.ruleBody}>
                  <p className={styles.ruleLabel}>Portföy Büyüklüğü</p>
                  <p className={styles.ruleValue}>
                    {formatPortfolioSize(startCreateLimits.minInitialPortfolioSize)}{" "}
                    –{" "}
                    {formatPortfolioSize(startCreateLimits.maxInitialPortfolioSize)}{" "}
                    TL
                  </p>
                </div>
                <span className={styles.ruleDash}>—</span>
              </li>
              <li className={styles.ruleItem}>
                <StatusDot
                  tone={
                    startCreateCompliance == null ||
                    startCreateCompliance.unitPriceOk
                      ? "ok"
                      : "bad"
                  }
                />
                <div className={styles.ruleBody}>
                  <p className={styles.ruleLabel}>Fon Pay Fiyatı</p>
                  <p className={styles.ruleValue}>
                    {startCreateLimits.minUnitPrice} –{" "}
                    {startCreateLimits.maxUnitPrice} TL
                  </p>
                </div>
                <span className={styles.ruleDash}>—</span>
              </li>
            </>
          ) : null}
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
                %{init.minLiquidityTargetPct} - %{init.maxLiquidityTargetPct}
              </p>
            </div>
            <span className={styles.ruleDash}>—</span>
          </li>
          <li className={styles.ruleItem}>
            <StatusDot tone="ok" />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>Tek Hisse Ağırlığı</p>
              <p className={styles.ruleValue}>
                %{init.minSingleStockMaxPct} - %{init.maxSingleStockMaxPct}
              </p>
            </div>
            <span className={styles.ruleDash}>—</span>
          </li>
          <li className={styles.ruleItem}>
            <StatusDot tone="ok" />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>%5 Üzerindeki Hisselerin Toplamı</p>
              <p className={styles.ruleValue}>≤ %{ABOVE_5_PCT_SUM_MAX}</p>
            </div>
            <span className={styles.ruleDash}>—</span>
          </li>
          <li className={[styles.ruleItem, styles.ruleItemLocked].join(" ")}>
            <StatusDot tone="info" />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>Sektör Ağırlığı</p>
              <p className={styles.ruleValue}>
                Maks. %{Math.round(init.sectorMaxPct)}
              </p>
              <span className={styles.immutableTag}>Kısıt (Değiştirilemez)</span>
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
            <span className={[styles.legendDot, styles.dotWarn].join(" ")} />
            Turuncu: Yalnızca İzahnameye Uygun
          </li>
          <li>
            <span className={[styles.legendDot, styles.dotBad].join(" ")} />
            Kırmızı: İzahnameye Uygun Değil
          </li>
          <li>
            <span className={[styles.legendDot, styles.dotInfo].join(" ")} />
            Gri: Bilgi / Kısıt (Değiştirilemez)
          </li>
        </ul>
        <p className={styles.legendFoot}>
          Kısıtlar fon izahnamesine göre kontrol edilmektedir.
        </p>
      </div>
    </aside>
  )
}
