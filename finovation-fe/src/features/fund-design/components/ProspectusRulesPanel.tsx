import type { FundDraftInit } from "@/features/fund-design/model/fundDraftSchemas"
import { formatPortfolioSize } from "@/features/fund-design/lib/portfolioSize"
import ParamInfoTip from "@/features/fund-design/components/ParamInfoTip"
import styles from "@/features/fund-design/styles/StartFundDraftPage.module.css"

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

export type LivePortfolioCompliance = {
  equityWeightPct: number
  tppWeightPct: number
  maxSingleStockWeightPct: number
  above5PctStockSumWeightPct: number
  maxSectorWeightPct: number
  stockCount: number
  violatingStocks: { code: string; type: "min" | "max" }[]
  missingForcedAssets: string[]
  presentExcludedAssets: string[]
}

type ProspectusRulesPanelProps = {
  init: FundDraftInit | null
  startCreateLimits?: StartCreateLimits | null
  startCreateCompliance?: StartCreateCompliance | null
  liveCompliance?: LivePortfolioCompliance | null
}

function renderProgressBar(
  valueText: string,
  fillPct: number,
  tone: StatusTone,
) {
  const fillClass =
    tone === "ok"
      ? styles.fillOk
      : tone === "warn"
        ? styles.fillWarn
        : tone === "bad"
          ? styles.fillBad
          : styles.fillInfo

  const clampedPct = Math.min(100, Math.max(0, fillPct))

  return (
    <div className={styles.ruleRightColumn}>
      <span className={styles.ruleCurrentValue}>{valueText}</span>
      <div className={styles.progressBarTrack}>
        <div
          className={[styles.progressBarFill, fillClass].join(" ")}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  )
}

export default function ProspectusRulesPanel({
  init,
  startCreateLimits = null,
  startCreateCompliance = null,
  liveCompliance = null,
}: ProspectusRulesPanelProps) {
  const equityTone: StatusTone =
    liveCompliance && init
      ? liveCompliance.equityWeightPct >= init.minEquityWeightPct &&
        liveCompliance.equityWeightPct <= init.maxEquityWeightPct
        ? "ok"
        : "bad"
      : "ok"

  const tppTone: StatusTone =
    liveCompliance && init
      ? liveCompliance.tppWeightPct >= init.minLiquidityTargetPct &&
        liveCompliance.tppWeightPct <= init.maxLiquidityTargetPct
        ? "ok"
        : "bad"
      : "ok"

  const singleStockTone: StatusTone =
    liveCompliance && init
      ? liveCompliance.violatingStocks.length > 0
        ? "bad"
        : liveCompliance.maxSingleStockWeightPct >
            init.maxSingleStockMaxPct * 0.85
          ? "warn"
          : "ok"
      : "ok"

  const above5Tone: StatusTone =
    liveCompliance && init
      ? liveCompliance.above5PctStockSumWeightPct <= init.aboveThresholdSumMax
        ? "ok"
        : "bad"
      : "ok"

  const sectorTone: StatusTone =
    liveCompliance && init
      ? liveCompliance.maxSectorWeightPct <= init.sectorMaxPct
        ? "info"
        : "bad"
      : "info"

  const stockCountTone: StatusTone =
    liveCompliance && init
      ? liveCompliance.stockCount >= init.minStockCount &&
        liveCompliance.stockCount <= init.maxStockCount
        ? "ok"
        : "bad"
      : "ok"

  return (
    <aside
      className={styles.rulesPanel}
      aria-label="İzahname ve kural kontrolü"
    >
      <div className={styles.rulesHeader}>
        <h3 className={styles.blockTitle}>İzahname ve Kural Kontrolü</h3>
        <ParamInfoTip label="İzahname ve kural kontrolü">
          Bu panel, seçtiğiniz kuralların fon izahnamesindeki ağırlık, likidite,
          hisse sayısı ve yoğunlaşma limitleriyle uyumunu gösterir. Yeşil uygun,
          turuncu dikkat gerektiren, kırmızı ise düzeltme gereken durumu belirtir.
        </ParamInfoTip>
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
                    {formatPortfolioSize(
                      startCreateLimits.minInitialPortfolioSize,
                    )}{" "}
                    –{" "}
                    {formatPortfolioSize(
                      startCreateLimits.maxInitialPortfolioSize,
                    )}{" "}
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
            <StatusDot tone={equityTone} />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>Hisse Senedi Oranı</p>
              <p className={styles.ruleValue}>
                %{init.minEquityWeightPct} - %{init.maxEquityWeightPct}
              </p>
              {liveCompliance && equityTone === "bad" && (
                <p className={styles.violationHint}>
                  {liveCompliance.equityWeightPct < init.minEquityWeightPct
                    ? `↓ Min %${init.minEquityWeightPct}'nin altında`
                    : `↑ Maks %${init.maxEquityWeightPct} aşıldı`}
                </p>
              )}
            </div>
            {liveCompliance ? (
              renderProgressBar(
                `%${liveCompliance.equityWeightPct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                liveCompliance.equityWeightPct,
                equityTone,
              )
            ) : (
              <span className={styles.ruleDash}>—</span>
            )}
          </li>

          <li className={styles.ruleItem}>
            <StatusDot tone={tppTone} />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>TPP Oranı</p>
              <p className={styles.ruleValue}>
                %{init.minLiquidityTargetPct} - %{init.maxLiquidityTargetPct}
              </p>
              {liveCompliance && tppTone === "bad" && (
                <p className={styles.violationHint}>
                  {liveCompliance.tppWeightPct < init.minLiquidityTargetPct
                    ? `↓ Min %${init.minLiquidityTargetPct}'nin altında`
                    : `↑ Maks %${init.maxLiquidityTargetPct} aşıldı`}
                </p>
              )}
            </div>
            {liveCompliance ? (
              renderProgressBar(
                `%${liveCompliance.tppWeightPct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                init.maxLiquidityTargetPct > 0
                  ? (liveCompliance.tppWeightPct / init.maxLiquidityTargetPct) *
                      100
                  : 0,
                tppTone,
              )
            ) : (
              <span className={styles.ruleDash}>—</span>
            )}
          </li>

          <li className={styles.ruleItem}>
            <StatusDot tone={singleStockTone} />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>Tek Hisse Ağırlığı</p>
              <p className={styles.ruleValue}>
                {init.minSingleStockMaxPct > 0
                  ? `%${init.minSingleStockMaxPct} - %${init.maxSingleStockMaxPct}`
                  : `Maks %${init.maxSingleStockMaxPct}`}
              </p>
              {liveCompliance && liveCompliance.violatingStocks.length > 0 && (
                <div className={styles.violatingList}>
                  {liveCompliance.violatingStocks.map((v) => (
                    <span key={v.code} className={styles.violatingChip}>
                      {v.type === "min" ? `↓ ${v.code}` : `↑ ${v.code}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {liveCompliance ? (
              renderProgressBar(
                `%${liveCompliance.maxSingleStockWeightPct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                init.maxSingleStockMaxPct > 0
                  ? (liveCompliance.maxSingleStockWeightPct /
                      init.maxSingleStockMaxPct) *
                      100
                  : 0,
                singleStockTone,
              )
            ) : (
              <span className={styles.ruleDash}>—</span>
            )}
          </li>

          <li className={styles.ruleItem}>
            <StatusDot tone={above5Tone} />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>
                %5 Üzerindeki Hisselerin Toplamı
              </p>
              <p className={styles.ruleValue}>≤ %{init.aboveThresholdSumMax}</p>
              {liveCompliance && above5Tone === "bad" && (
                <p className={styles.violationHint}>
                  ↑ Maks %{init.aboveThresholdSumMax} aşıldı
                </p>
              )}
            </div>
            {liveCompliance ? (
              renderProgressBar(
                `%${liveCompliance.above5PctStockSumWeightPct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                (liveCompliance.above5PctStockSumWeightPct /
                  init.aboveThresholdSumMax) *
                  100,
                above5Tone,
              )
            ) : (
              <span className={styles.ruleDash}>—</span>
            )}
          </li>

          <li className={[styles.ruleItem, styles.ruleItemLocked].join(" ")}>
            <StatusDot tone={sectorTone} />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>Sektör Ağırlığı</p>
              <p className={styles.ruleValue}>
                Maks. %{Math.round(init.sectorMaxPct)}
              </p>
              <span className={styles.immutableTag}>
                Kısıt (Değiştirilemez)
              </span>
              {liveCompliance && sectorTone === "bad" && (
                <p className={styles.violationHint}>
                  ↑ Maks %{Math.round(init.sectorMaxPct)} aşıldı
                </p>
              )}
            </div>
            {liveCompliance ? (
              renderProgressBar(
                `%${liveCompliance.maxSectorWeightPct.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                init.sectorMaxPct > 0
                  ? (liveCompliance.maxSectorWeightPct / init.sectorMaxPct) *
                      100
                  : 0,
                sectorTone,
              )
            ) : (
              <span className={styles.ruleDash}>—</span>
            )}
          </li>

          <li className={styles.ruleItem}>
            <StatusDot tone={stockCountTone} />
            <div className={styles.ruleBody}>
              <p className={styles.ruleLabel}>Hisse Sayısı</p>
              <p className={styles.ruleValue}>
                {init.minStockCount} - {init.maxStockCount}
              </p>
              {liveCompliance && stockCountTone === "bad" && (
                <p className={styles.violationHint}>
                  {liveCompliance.stockCount < init.minStockCount
                    ? `↓ Min ${init.minStockCount} hisse gerekli`
                    : `↑ Maks ${init.maxStockCount} hisse aşıldı`}
                </p>
              )}
            </div>
            {liveCompliance ? (
              renderProgressBar(
                `${liveCompliance.stockCount}`,
                init.maxStockCount > 0
                  ? (liveCompliance.stockCount / init.maxStockCount) * 100
                  : 0,
                stockCountTone,
              )
            ) : (
              <span className={styles.ruleDash}>—</span>
            )}
          </li>
        </ul>
      ) : (
        <p className={styles.rulesLoading}>Kısıtlar yükleniyor…</p>
      )}

      {init &&
        "draft" in init &&
        init.draft != null &&
        init.draft.designMode !== "MANUAL" &&
        liveCompliance && (
          <>
            <div className={styles.rulesHeader} style={{ marginTop: "1.5rem" }}>
              <h3 className={styles.blockTitle}>Kriterlerinize Uygunluk</h3>
            </div>
            <ul className={styles.ruleList}>
              {(init.draft.tppMinPct != null ||
                init.draft.tppMaxPct != null) && (
                <li className={styles.ruleItem}>
                  <StatusDot
                    tone={
                      liveCompliance.tppWeightPct >=
                        (init.draft.tppMinPct ?? 0) &&
                      liveCompliance.tppWeightPct <=
                        (init.draft.tppMaxPct ?? 100)
                        ? "ok"
                        : "warn"
                    }
                  />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Özel TPP Oranı</p>
                    <p className={styles.ruleValue}>
                      %{init.draft.tppMinPct ?? 0} - %
                      {init.draft.tppMaxPct ?? 100}
                    </p>
                    {(liveCompliance.tppWeightPct <
                      (init.draft.tppMinPct ?? 0) ||
                      liveCompliance.tppWeightPct >
                        (init.draft.tppMaxPct ?? 100)) && (
                      <p className={styles.violationHint}>
                        {liveCompliance.tppWeightPct <
                        (init.draft.tppMinPct ?? 0)
                          ? `↓ Min %${init.draft.tppMinPct} gerekli`
                          : `↑ Maks %${init.draft.tppMaxPct} aşıldı`}
                      </p>
                    )}
                  </div>
                  {renderProgressBar(
                    `%${liveCompliance.tppWeightPct.toFixed(1)}`,
                    (init.draft.tppMaxPct ?? 15) > 0
                      ? (liveCompliance.tppWeightPct /
                          (init.draft.tppMaxPct ?? 15)) *
                          100
                      : 0,
                    liveCompliance.tppWeightPct >=
                      (init.draft.tppMinPct ?? 0) &&
                      liveCompliance.tppWeightPct <=
                        (init.draft.tppMaxPct ?? 100)
                      ? "ok"
                      : "warn",
                  )}
                </li>
              )}

              {(init.draft.minStockCount != null ||
                init.draft.maxStockCount != null) && (
                <li className={styles.ruleItem}>
                  <StatusDot
                    tone={
                      liveCompliance.stockCount >=
                        (init.draft.minStockCount ?? 0) &&
                      liveCompliance.stockCount <=
                        (init.draft.maxStockCount ?? 9999)
                        ? "ok"
                        : "warn"
                    }
                  />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Özel Hisse Sayısı</p>
                    <p className={styles.ruleValue}>
                      {init.draft.minStockCount != null &&
                      init.draft.maxStockCount != null
                        ? `${init.draft.minStockCount} - ${init.draft.maxStockCount}`
                        : init.draft.minStockCount != null
                          ? `Min ${init.draft.minStockCount}`
                          : `Maks ${init.draft.maxStockCount}`}
                    </p>
                    {(liveCompliance.stockCount <
                      (init.draft.minStockCount ?? 0) ||
                      liveCompliance.stockCount >
                        (init.draft.maxStockCount ?? 9999)) && (
                      <p className={styles.violationHint}>
                        {liveCompliance.stockCount <
                        (init.draft.minStockCount ?? 0)
                          ? `↓ Min ${init.draft.minStockCount} gerekli`
                          : `↑ Maks ${init.draft.maxStockCount} aşıldı`}
                      </p>
                    )}
                  </div>
                  {renderProgressBar(
                    `${liveCompliance.stockCount}`,
                    (init.draft.maxStockCount ?? 1) > 0
                      ? (liveCompliance.stockCount /
                          (init.draft.maxStockCount ?? 1)) *
                          100
                      : 0,
                    liveCompliance.stockCount >=
                      (init.draft.minStockCount ?? 0) &&
                      liveCompliance.stockCount <=
                        (init.draft.maxStockCount ?? 9999)
                      ? "ok"
                      : "warn",
                  )}
                </li>
              )}

              {init.draft.forcedAssetCodes.length > 0 && (
                <li className={styles.ruleItem}>
                  <StatusDot
                    tone={
                      liveCompliance.missingForcedAssets.length > 0
                        ? "warn"
                        : "ok"
                    }
                  />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Zorunlu Hisseler</p>
                    <p className={styles.ruleValue}>
                      {init.draft.forcedAssetCodes.join(", ")}
                    </p>
                    {liveCompliance.missingForcedAssets.length > 0 && (
                      <>
                        <p className={styles.softViolationHint}>
                          Portföyden çıkarılmış
                        </p>
                        <div className={styles.violatingList}>
                          {liveCompliance.missingForcedAssets.map((code) => (
                            <span
                              key={code}
                              className={styles.softViolatingChip}
                            >
                              ↓ {code}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <span className={styles.ruleCurrentValue}>
                    {init.draft.forcedAssetCodes.length -
                      liveCompliance.missingForcedAssets.length}
                    /{init.draft.forcedAssetCodes.length}
                  </span>
                </li>
              )}

              {init.draft.excludedAssetCodes.length > 0 && (
                <li className={styles.ruleItem}>
                  <StatusDot
                    tone={
                      liveCompliance.presentExcludedAssets.length > 0
                        ? "warn"
                        : "ok"
                    }
                  />
                  <div className={styles.ruleBody}>
                    <p className={styles.ruleLabel}>Hariç Tutulan Hisseler</p>
                    <p className={styles.ruleValue}>
                      {init.draft.excludedAssetCodes.join(", ")}
                    </p>
                    {liveCompliance.presentExcludedAssets.length > 0 && (
                      <>
                        <p className={styles.softViolationHint}>
                          Portföye geri eklenmiş
                        </p>
                        <div className={styles.violatingList}>
                          {liveCompliance.presentExcludedAssets.map((code) => (
                            <span
                              key={code}
                              className={styles.softViolatingChip}
                            >
                              ↑ {code}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <span className={styles.ruleCurrentValue}>
                    {liveCompliance.presentExcludedAssets.length}/
                    {init.draft.excludedAssetCodes.length}
                  </span>
                </li>
              )}
            </ul>
          </>
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
            Turuncu: İzahnameye Uygun, Kriterlerinize Uygun Değil
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
