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

  const heldExcludedPositions = (form.snapshot?.positions ?? []).filter(
    (position) => form.excludedHeldAssetIds.has(position.assetId),
  )

  const keepAtLimit = form.keepCount >= form.maxAssetSelectionsPerType
  const heldExcludeAtLimit =
    form.heldExcludeCount >= form.maxAssetSelectionsPerType
  const universeExcludeAtLimit =
    form.universeExcludeCount >= form.maxAssetSelectionsPerType
  const forceAddAtLimit = form.forceAddCount >= form.maxAssetSelectionsPerType

  const excludeDisabledCodes = new Set<string>()
  if (universeExcludeAtLimit) {
    for (const asset of form.unheldUniverseAssets) {
      if (!excludedAssetCodes.has(asset.assetCode)) {
        excludeDisabledCodes.add(asset.assetCode)
      }
    }
  }
  const excludePanelAssets = form.unheldUniverseAssets.filter(
    (asset) => !forceAddedAssetCodes.has(asset.assetCode),
  )

  const forceAddDisabledCodes = new Set<string>()
  if (forceAddAtLimit) {
    for (const asset of form.unheldUniverseAssets) {
      if (!forceAddedAssetCodes.has(asset.assetCode)) {
        forceAddDisabledCodes.add(asset.assetCode)
      }
    }
  }
  const forceAddPanelAssets = form.unheldUniverseAssets.filter(
    (asset) => !excludedAssetCodes.has(asset.assetCode),
  )

  const hasNoFunds =
    !form.isLoadingFunds && !form.loadErrorMessage && form.funds.length === 0

  const headerTitle = form.step === 2 ? "Optimizasyon Tercihleri" : "Fon Optimizasyonu"

  const headerSubtitle =
    form.step === 1
      ? "Optimize etmek istediğiniz fonu seçin"
      : form.step === 2 && form.selectedFundSummary
        ? `${form.selectedFundSummary.name} · ${form.selectedFundSummary.stockCount} hisse · Hisse %${form.selectedFundSummary.equityWeightPercent} / TPP %${form.selectedFundSummary.tppWeightPercent} · Sistem önerir, son söz sizindir`
        : (form.snapshot?.fundName ??
          "Optimizasyon tercihlerinizi belirleyin")

  return (
    <main className={styles.page}>
      <div className={styles.wizardShell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1>{headerTitle}</h1>
            <p>{headerSubtitle}</p>
          </div>
          {form.step === 2 ? (
            <button
              type="button"
              className={styles.changeFundButton}
              onClick={form.goToFundSelection}
            >
              Fon Değiştir
            </button>
          ) : (
            <button
              type="button"
              className={styles.changeFundButton}
              onClick={() => navigate("/optimization-requests/logs")}
            >
              İşlem Loglarını Gör
            </button>
          )}
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
                excludedAssetIds={form.excludedHeldAssetIds}
                keptWeightSum={keptWeightSum}
                keepAtLimit={keepAtLimit}
                excludeAtLimit={heldExcludeAtLimit}
                onToggle={form.toggleHeldKeep}
                onToggleExclude={form.toggleHeldExclude}
              />

              <div className={styles.togglePanelGrid}>
                <AssetTogglePanel
                  title="C · Dahil Edilmeyecek Hisseler"
                  description="İşaretlenen hisse optimizasyona hiç girmez; model bu hisseyi portföye ekleyemez. En fazla 3 hisse işaretlenebilir."
                  assets={excludePanelAssets}
                  selectedAssetCodes={excludedAssetCodes}
                  disabledAssetCodes={excludeDisabledCodes}
                  disabledTitle="En fazla 3 hisse hariç tutulabilir"
                  toggleLabel="Hariç Tut"
                  variant="exclude"
                  onToggle={(assetCode) =>
                    form.toggleSelection(assetCode, "EXCLUDE")
                  }
                  pinnedAssets={heldExcludedPositions}
                  pinnedBadgeLabel="Yukarıdan"
                  onTogglePinned={form.toggleHeldExclude}
                />

                <AssetTogglePanel
                  title="D · Zorunlu Eklenecek Hisseler"
                  description="İşaretlenen hisse portföye mutlaka girer; sistem her biri için en az %3 ağırlık ayırır. En fazla 3 hisse işaretlenebilir."
                  assets={forceAddPanelAssets}
                  selectedAssetCodes={forceAddedAssetCodes}
                  disabledAssetCodes={forceAddDisabledCodes}
                  disabledTitle="En fazla 3 hisse zorunlu eklenebilir"
                  toggleLabel="Ekle"
                  variant="forceAdd"
                  onToggle={(assetCode) =>
                    form.toggleSelection(assetCode, "FORCE_ADD")
                  }
                />
              </div>

              <section className={styles.panel}>
                <div className={styles.sectionHeading}>
                  <h2 className={styles.panelTitle}>E · Kısıt Tanımlama</h2>
                  <button
                    type="button"
                    className={styles.resetDefaults}
                    disabled={!form.constraintsDeviateFromProfile}
                    onClick={form.resetConstraintsToSuggested}
                  >
                    Varsayılana Dön
                  </button>
                </div>
                <ConstraintRangeInputs
                  label="TPP Ağırlık Aralığı (%)"
                  min={form.tppMinWeight}
                  max={form.tppMaxWeight}
                  floor={5}
                  ceiling={15}
                  minWidth={3}
                  inputPrefix="%"
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
                      state: { fundName: form.snapshot?.fundName },
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
