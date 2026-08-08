import { useEffect, useState } from "react"

import {
    fetchStressScenarios,
    fetchStressTestFunds,
} from "@/features/stress-test/api/stressTestService"
import type {
    StressScenarioResponse,
    StressTestFundResponse,
} from "@/features/stress-test/model/stressTestSchemas"

export function useStressTestSetup() {
    const [funds, setFunds] = useState<StressTestFundResponse[]>([])
    const [scenarios, setScenarios] = useState<StressScenarioResponse[]>([])
    const [selectedFundId, setSelectedFundId] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const controller = new AbortController()

        async function load() {
            setIsLoading(true)
            setErrorMessage("")

            try {
                const [fundResponse, scenarioResponse] = await Promise.all([
                    fetchStressTestFunds(controller.signal),
                    fetchStressScenarios(controller.signal),
                ])

                setFunds(fundResponse)
                setScenarios(scenarioResponse)
                setSelectedFundId(fundResponse[0]?.id ?? "")
            } catch (error) {
                if (controller.signal.aborted) return

                setFunds([])
                setScenarios([])
                setSelectedFundId("")
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Stres testi verileri yüklenemedi.",
                )
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => controller.abort()
    }, [])

    return {
        funds,
        scenarios,
        selectedFundId,
        isLoading,
        errorMessage,
        selectFund: setSelectedFundId,
    }
}