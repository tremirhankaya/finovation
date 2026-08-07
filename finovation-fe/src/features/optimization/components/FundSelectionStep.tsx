import type { FundOption } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type FundSelectionStepProps = {
  funds: FundOption[]
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

      {!isLoading && !errorMessage && funds.length === 0 && (
        <p className={styles.emptyState}>Optimize edilebilir fon yok.</p>
      )}

      {!isLoading && !errorMessage && funds.length > 0 && (
        <table className={styles.assetTable}>
          <thead>
            <tr>
              <th>Fon</th>
              <th>Tür</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => (
              <tr key={fund.id}>
                <td>
                  <span className={styles.fundRowName}>{fund.name}</span>
                </td>
                <td>{fund.type}</td>
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
        {funds.length === 1 && (
          <span className={styles.fundSelectionHint}>
            Yalnızca tek fon varsa fon otomatik seçilir.
          </span>
        )}
      </div>
    </section>
  )
}
