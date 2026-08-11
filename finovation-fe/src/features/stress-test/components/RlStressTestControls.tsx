import type { RlPortfolioCompatibilityResponse } from "@/features/stress-test/api/rlStressTestService"
import type { StressTestFundResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/RlStressTestPage.module.css"

type Props = {
    funds: StressTestFundResponse[]
    selectedFundId: string
    selectedScenarioCode: string
    isLoadingFunds: boolean
    fundError: string
    compatibility: RlPortfolioCompatibilityResponse | null
    isCheckingCompatibility: boolean
    compatibilityError: string
    isRunning: boolean
    canRun: boolean
    onFundChange: (value: string) => void
    onScenarioChange: (value: string) => void
    onRun: () => Promise<void>
}

export default function RlStressTestControls({
                                                 funds,
                                                 selectedFundId,
                                                 selectedScenarioCode,
                                                 isLoadingFunds,
                                                 fundError,
                                                 compatibility,
                                                 isCheckingCompatibility,
                                                 compatibilityError,
                                                 isRunning,
                                                 canRun,
                                                 onFundChange,
                                                 onScenarioChange,
                                                 onRun,
                                             }: Props) {
    return (
        <section className={styles.controlCard}>
            <div className={styles.controlGrid}>
                <div className={styles.fieldGroup}>
                    <label htmlFor="rl-fund">
                        Test edilecek fon
                    </label>

                    <select
                        id="rl-fund"
                        value={selectedFundId}
                        disabled={isLoadingFunds}
                        onChange={(event) =>
                            onFundChange(event.target.value)
                        }
                    >
                        <option value="">
                            {isLoadingFunds
                                ? "Fonlar yükleniyor..."
                                : "Fon seçin"}
                        </option>

                        {funds.map((fund) => (
                            <option
                                key={fund.id}
                                value={fund.id}
                            >
                                {fund.name}
                            </option>
                        ))}
                    </select>

                    <CompatibilityStatus
                        selectedFundId={selectedFundId}
                        fundError={fundError}
                        compatibility={compatibility}
                        isChecking={isCheckingCompatibility}
                        compatibilityError={compatibilityError}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="rl-scenario">
                        Stres senaryosu
                    </label>

                    <select
                        id="rl-scenario"
                        value={selectedScenarioCode}
                        onChange={(event) =>
                            onScenarioChange(event.target.value)
                        }
                    >
                        <option value="">
                            Senaryo seçin
                        </option>

                        <option value="S49_IMAMOGLU_POLITICAL_SHOCK_2025">
                            2025 İmamoğlu Politik Şoku
                        </option>

                        <option value="S52_CHP_MUTLAK_BUTLAN_2025">
                            Uzayan Politik Belirsizlik
                        </option>
                    </select>

                    <span className={styles.helperText}>
                        RL modeli yalnızca desteklenen senaryolarda çalışır.
                    </span>
                </div>

                <div className={styles.actionArea}>
                    <button
                        type="button"
                        className={styles.runButton}
                        disabled={!canRun || isRunning}
                        onClick={() => void onRun()}
                    >
                        {isRunning
                            ? "RL Analizi Çalışıyor..."
                            : "RL Analizini Çalıştır"}
                    </button>
                </div>
            </div>
        </section>
    )
}

type CompatibilityStatusProps = {
    selectedFundId: string
    fundError: string
    compatibility: RlPortfolioCompatibilityResponse | null
    isChecking: boolean
    compatibilityError: string
}

function CompatibilityStatus({
                                 selectedFundId,
                                 fundError,
                                 compatibility,
                                 isChecking,
                                 compatibilityError,
                             }: CompatibilityStatusProps) {
    if (fundError) {
        return (
            <span className={styles.errorText}>
                {fundError}
            </span>
        )
    }

    if (isChecking) {
        return (
            <span className={styles.checkingText}>
                RL uygunluğu kontrol ediliyor...
            </span>
        )
    }

    if (compatibility?.compatible) {
        return (
            <span className={styles.compatibleText}>
                ✓ Bu fon RL analizine uygun.
            </span>
        )
    }

    if (compatibility && !compatibility.compatible) {
        return (
            <span className={styles.incompatibleText}>
                ⚠ Bu fon RL analizine uygun değil.
            </span>
        )
    }

    if (compatibilityError) {
        return (
            <span className={styles.errorText}>
                {compatibilityError}
            </span>
        )
    }

    if (!selectedFundId) {
        return (
            <span className={styles.helperText}>
                Fon seçildiğinde RL uygunluk kontrolü yapılacak.
            </span>
        )
    }

    return null
}