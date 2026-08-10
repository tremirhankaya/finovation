import type { OptimizableFund } from "@/features/optimization/model/optimizationForm.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type FundSelectionStepProps = {
  funds: OptimizableFund[]
  selectedFundId: string
  onSelectFund: (fundId: string) => void
  onContinue: () => void
  isLoading: boolean
  errorMessage: string
}

export default function FundSelectionStep({
  funds,
  selectedFundId,
  onSelectFund,
  onContinue,
  isLoading,
  errorMessage,
}: FundSelectionStepProps) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelEyebrow}>
        <span className={styles.panelEyebrowDot} aria-hidden="true" />
        Optimize Edilebilir Fonlar
      </h2>

      {isLoading && (
        <div className={styles.loadingBanner} role="status">
          Fonlar yükleniyor…
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && funds.length > 0 && (
        <table className={styles.assetTable}>
          <thead>
            <tr>
              <th aria-hidden="true" />
              <th>Fon</th>
              <th>Durum</th>
              <th>Son Optimizasyon</th>
              <th>Hisse / TPP</th>
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => (
              <tr key={fund.id}>
                <td>
                  <input
                    type="radio"
                    name="optimization-fund"
                    className={styles.assetCheckbox}
                    checked={selectedFundId === fund.id}
                    onChange={() => onSelectFund(fund.id)}
                    aria-label={`${fund.name} fonunu seç`}
                  />
                </td>
                <td>
                  <span className={styles.fundRowName}>{fund.name}</span>
                  <div className={styles.fundRowMeta}>
                    {fund.stockCount} hisse · {fund.sectorCount} sektör
                  </div>
                </td>
                <td>
                  <span
                    className={
                      fund.active
                        ? styles.fundStatusBadgeActive
                        : styles.fundStatusBadge
                    }
                  >
                    {fund.active ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td>
                  {fund.lastOptimizationDate ?? "Optimizasyon yapılmadı"}
                </td>
                <td>
                  %{fund.equityWeightPercent} / %{fund.tppWeightPercent}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.fundSelectionFooter}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={!selectedFundId}
          onClick={onContinue}
        >
          Optimizasyona Başla
        </button>
        <span className={styles.fundSelectionHint}>
          Yalnızca tek fon varsa fon otomatik seçilir.
        </span>
      </div>
    </section>
  )
}
