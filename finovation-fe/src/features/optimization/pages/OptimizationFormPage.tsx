import { useNavigate } from "react-router"

import AssetTogglePanel from "@/features/optimization/components/AssetTogglePanel"
import ComplianceSummaryPanel from "@/features/optimization/components/ComplianceSummaryPanel"
import ConstraintRangeInputs from "@/features/optimization/components/ConstraintRangeInputs"
import FundSelectionStep from "@/features/optimization/components/FundSelectionStep"
import KeptAssetsPanel from "@/features/optimization/components/KeptAssetsPanel"
import NoFundsAvailableStep from "@/features/optimization/components/NoFundsAvailableStep"
import OptimizationWizardSteps from "@/features/optimization/components/OptimizationWizardSteps"
import RiskProfilePanel from "@/features/optimization/components/RiskProfilePanel"
import { useOptimizationForm } from "@/features/optimization/hooks/useOptimizationForm"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export default function OptimizationFormPage() {
  const navigate = useNavigate()
  const form = useOptimizationForm()

  const keptAssetCodes = new Set(
    Object.entries(form.selection)
      .filter(([, type]) => type === "KEEP")
      .map(([assetCode]) => assetCode),
  )
  const excludedAssetCodes = new Set(
    Object.entries(form.selection)
      .filter(([, type]) => type === "EXCLUDE")
      .map(([assetCode]) => assetCode),
  )
  const forceAddedAssetCodes = new Set(
    Object.entries(form.selection)
      .filter(([, type]) => type === "FORCE_ADD")
      .map(([assetCode]) => assetCode),
  )

  const keptWeightSum = (form.snapshot?.positions ?? [])
    .filter((position) => keptAssetCodes.has(position.assetId))
    .reduce((sum, position) => sum + position.weightPercentage, 0)

  const hasNoFunds =
    !form.isLoadingFunds && !form.loadErrorMessage && form.funds.length === 0

  return (
    <main className={styles.page}>
      <div className={styles.wizardShell}>
        <header className={styles.header}>
          <h1>Fon Optimizasyonu</h1>
          <p className={styles.subtitle}>
            {form.step === 1
              ? "Optimize etmek istediğiniz fonu seçin"
              : (form.snapshot?.fund.name ??
                "Optimizasyon tercihlerinizi belirleyin")}
          </p>
        </header>

        <OptimizationWizardSteps currentStep={form.step} />

        {form.step === 1 ? (
          hasNoFunds ? (
            <NoFundsAvailableStep />
          ) : (
            <FundSelectionStep
              funds={form.funds}
              selectedFundId={form.selectedFundId}
              onSelectFund={form.selectFund}
              onContinue={form.goToPreferences}
              isLoading={form.isLoadingFunds}
              errorMessage={form.loadErrorMessage}
            />
          )
        ) : (
          <div className={styles.layout}>
            <div className={styles.main}>
              <button
                type="button"
                className={styles.backLink}
                onClick={form.goToFundSelection}
              >
                ← Fon seçimine dön
              </button>

              {form.isLoading && (
                <div className={styles.loadingBanner} role="status">
                  Fon verileri yükleniyor…
                </div>
              )}

              {form.loadErrorMessage && (
                <div className={styles.errorBanner} role="alert">
                  {form.loadErrorMessage}
                </div>
              )}

              {form.submitErrorMessage && (
                <div className={styles.errorBanner} role="alert">
                  {form.submitErrorMessage}
                </div>
              )}

              <RiskProfilePanel
                value={form.riskProfile}
                onChange={form.setRiskProfile}
              />

              <KeptAssetsPanel
                positions={form.snapshot?.positions ?? []}
                keptAssetCodes={keptAssetCodes}
                keptWeightSum={keptWeightSum}
                onToggle={(assetCode) =>
                  form.toggleSelection(assetCode, "KEEP")
                }
              />

              <div className={styles.togglePanelGrid}>
                <AssetTogglePanel
                  title="C · Dahil Edilmeyecek Hisseler"
                  description="İşaretlenen hisse optimizasyona hiç girmez; model bu hisseyi portföye ekleyemez."
                  assets={form.universeAssets}
                  selectedAssetCodes={excludedAssetCodes}
                  disabledAssetCodes={forceAddedAssetCodes}
                  toggleLabel="Hariç Tut"
                  variant="exclude"
                  onToggle={(assetCode) =>
                    form.toggleSelection(assetCode, "EXCLUDE")
                  }
                />

                <AssetTogglePanel
                  title="D · Zorunlu Eklenecek Hisseler"
                  description="İşaretlenen hisse portföye mutlaka girer; sistem her biri için en az %3 ağırlık ayırır."
                  assets={form.universeAssets}
                  selectedAssetCodes={forceAddedAssetCodes}
                  disabledAssetCodes={excludedAssetCodes}
                  toggleLabel="Ekle"
                  variant="forceAdd"
                  onToggle={(assetCode) =>
                    form.toggleSelection(assetCode, "FORCE_ADD")
                  }
                />
              </div>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>E · Kısıt Tanımlama</h2>
                <ConstraintRangeInputs
                  label="TPP Ağırlık Aralığı (%)"
                  min={form.tppMinWeight}
                  max={form.tppMaxWeight}
                  floor={5}
                  ceiling={15}
                  minWidth={3}
                  onMinChange={form.setTppMinWeight}
                  onMaxChange={form.setTppMaxWeight}
                  hint="İzahname: TPP ağırlığı %5 ile %15 arasında · aralık genişliği en az 3 puan"
                />
                <ConstraintRangeInputs
                  label="Hisse Sayısı Aralığı"
                  min={form.stockCountMin}
                  max={form.stockCountMax}
                  floor={16}
                  ceiling={30}
                  minWidth={5}
                  onMinChange={form.setStockCountMin}
                  onMaxChange={form.setStockCountMax}
                  hint="Sistem sınırı: 16 ≤ hisse sayısı ≤ 30 · aralık genişliği en az 5 hisse"
                />

                <div className={styles.rangeField}>
                  <div className={styles.rangeFieldHeader}>
                    <span className={styles.rangeFieldLabel}>
                      Eklenebilecek En Fazla Yeni Hisse
                    </span>
                    <span className={styles.rangeFieldBounds}>
                      Min {form.maxAdditionsFloor} — Maks {form.maxAdditionsCeiling}
                    </span>
                  </div>
                  <div className={styles.rangeInputs}>
                    <input
                      type="number"
                      value={form.maxAdditions}
                      min={form.maxAdditionsFloor}
                      max={form.maxAdditionsCeiling}
                      onChange={(event) =>
                        form.setMaxAdditions(Number(event.target.value))
                      }
                      aria-label="Eklenebilecek en fazla yeni hisse"
                    />
                  </div>
                  <p className={styles.rangeHint}>
                    Optimizasyon sırasında portföye eklenebilecek yeni hisse
                    sayısının üst sınırı
                  </p>
                </div>
              </section>
            </div>

            <ComplianceSummaryPanel
              rows={form.complianceRows}
              canSubmit={form.canSubmit}
              isSubmitting={form.isSubmitting}
              onSubmit={() =>
                void form.submit((createdRequestId) =>
                  navigate(
                    `/optimization-requests/${createdRequestId}/running`,
                    {
                      state: { fundName: form.snapshot?.fund.name },
                    },
                  ),
                )
              }
            />
          </div>
        )}
      </div>
    </main>
  )
}
