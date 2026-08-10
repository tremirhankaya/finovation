import { useEffect, useState } from "react"

import {
    checkRlPortfolioCompatibility,
    deleteRlStressTest,
    fetchRlStressTestDetail,
    fetchRlStressTestHistory,
    mapRlStressTestDetailToInference,
    runRlStressTest,
    type RlPortfolioCompatibilityResponse,
} from "@/features/stress-test/api/rlStressTestService"
import { fetchStressTestFunds } from "@/features/stress-test/api/stressTestService"
import type {
    RlInferenceResponse,
    RlStressTestHistoryItem,
} from "@/features/stress-test/model/rlStressTest.types"
import type { StressTestFundResponse } from "@/features/stress-test/model/stressTestSchemas"

const PLAYBACK_INTERVAL_MS = 900

export function useRlStressTest() {
    const [funds, setFunds] = useState<StressTestFundResponse[]>([])
    const [selectedFundId, setSelectedFundId] = useState("")
    const [selectedScenarioCode, setSelectedScenarioCode] = useState("")

    const [isLoadingFunds, setIsLoadingFunds] = useState(true)
    const [fundError, setFundError] = useState("")

    const [compatibility, setCompatibility] =
        useState<RlPortfolioCompatibilityResponse | null>(null)
    const [isCheckingCompatibility, setIsCheckingCompatibility] =
        useState(false)
    const [compatibilityError, setCompatibilityError] = useState("")

    const [result, setResult] =
        useState<RlInferenceResponse | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [runError, setRunError] = useState("")

    const [selectedDayIndex, setSelectedDayIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playbackSpeed, setPlaybackSpeed] = useState(1)

    const [history, setHistory] =
        useState<RlStressTestHistoryItem[]>([])
    const [isHistoryLoading, setIsHistoryLoading] = useState(true)
    const [historyError, setHistoryError] = useState("")

    const [isHistoryDetailLoading, setIsHistoryDetailLoading] =
        useState(false)
    const [historyDetailError, setHistoryDetailError] = useState("")
    const [selectedHistoryId, setSelectedHistoryId] =
        useState<string | null>(null)

    const [deletingHistoryId, setDeletingHistoryId] =
        useState<string | null>(null)
    const [historyDeleteError, setHistoryDeleteError] = useState("")

    useEffect(() => {
        const controller = new AbortController()

        async function loadFunds() {
            setIsLoadingFunds(true)
            setFundError("")

            try {
                const response = await fetchStressTestFunds(
                    controller.signal,
                )

                setFunds(response)
            } catch (error) {
                if (controller.signal.aborted) return

                setFunds([])
                setFundError(
                    error instanceof Error
                        ? error.message
                        : "Fonlar yüklenemedi.",
                )
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoadingFunds(false)
                }
            }
        }

        void loadFunds()

        return () => controller.abort()
    }, [])

    async function loadHistory(signal?: AbortSignal) {
        setIsHistoryLoading(true)
        setHistoryError("")

        try {
            const response = await fetchRlStressTestHistory(signal)
            setHistory(response)
        } catch (error) {
            if (signal?.aborted) return

            setHistory([])
            setHistoryError(
                error instanceof Error
                    ? error.message
                    : "RL analiz geçmişi yüklenemedi.",
            )
        } finally {
            if (!signal?.aborted) {
                setIsHistoryLoading(false)
            }
        }
    }

    useEffect(() => {
        const controller = new AbortController()

        void loadHistory(controller.signal)

        return () => controller.abort()
    }, [])

    useEffect(() => {
        if (!selectedFundId) {
            setCompatibility(null)
            setCompatibilityError("")
            setIsCheckingCompatibility(false)
            return
        }

        const controller = new AbortController()

        async function checkCompatibility() {
            setCompatibility(null)
            setCompatibilityError("")
            setIsCheckingCompatibility(true)

            try {
                const response =
                    await checkRlPortfolioCompatibility(
                        selectedFundId,
                        controller.signal,
                    )

                setCompatibility(response)
            } catch (error) {
                if (controller.signal.aborted) return

                setCompatibility(null)
                setCompatibilityError(
                    error instanceof Error
                        ? error.message
                        : "RL uygunluk kontrolü yapılamadı.",
                )
            } finally {
                if (!controller.signal.aborted) {
                    setIsCheckingCompatibility(false)
                }
            }
        }

        void checkCompatibility()

        return () => controller.abort()
    }, [selectedFundId])

    useEffect(() => {
        if (!isPlaying || !result) return

        if (selectedDayIndex >= result.days.length - 1) {
            setIsPlaying(false)
            return
        }

        const timer = window.setTimeout(() => {
            setSelectedDayIndex((current) => current + 1)
        }, PLAYBACK_INTERVAL_MS / playbackSpeed)

        return () => window.clearTimeout(timer)
    }, [
        isPlaying,
        result,
        selectedDayIndex,
        playbackSpeed,
    ])

    const canRun =
        Boolean(selectedFundId) &&
        Boolean(selectedScenarioCode) &&
        compatibility?.compatible === true &&
        !isCheckingCompatibility

    const selectedDay =
        result?.days[selectedDayIndex] ?? null

    const previousDay =
        selectedDayIndex > 0
            ? result?.days[selectedDayIndex - 1] ?? null
            : null

    async function handleRun() {
        if (!canRun) return

        setSelectedHistoryId(null)
        setIsPlaying(false)
        setIsRunning(true)
        setRunError("")
        setResult(null)

        try {
            const response = await runRlStressTest({
                fundId: selectedFundId,
                scenarioCode: selectedScenarioCode,
            })

            setResult(response)
            setSelectedDayIndex(0)

            await loadHistory()
        } catch (error) {
            setRunError(
                error instanceof Error
                    ? error.message
                    : "RL stres testi çalıştırılamadı.",
            )
        } finally {
            setIsRunning(false)
        }
    }

    async function handleHistorySelect(testId: string) {
        setIsPlaying(false)
        setIsHistoryDetailLoading(true)
        setHistoryDetailError("")
        setSelectedHistoryId(testId)

        try {
            const detail = await fetchRlStressTestDetail(testId)
            const mappedResult =
                mapRlStressTestDetailToInference(detail)

            setResult(mappedResult)
            setSelectedDayIndex(0)
        } catch (error) {
            setHistoryDetailError(
                error instanceof Error
                    ? error.message
                    : "Geçmiş RL analizi yüklenemedi.",
            )
        } finally {
            setIsHistoryDetailLoading(false)
        }
    }

    async function handleHistoryDelete(testId: string) {
        setDeletingHistoryId(testId)
        setHistoryDeleteError("")

        try {
            await deleteRlStressTest(testId)

            setHistory((current) =>
                current.filter((item) => item.id !== testId),
            )

            if (selectedHistoryId === testId) {
                setSelectedHistoryId(null)
                setResult(null)
                setSelectedDayIndex(0)
                setIsPlaying(false)
            }
        } catch (error) {
            setHistoryDeleteError(
                error instanceof Error
                    ? error.message
                    : "RL analizi silinemedi.",
            )
        } finally {
            setDeletingHistoryId(null)
        }
    }

    function togglePlayback() {
        if (!result?.days.length) return

        if (
            !isPlaying &&
            selectedDayIndex === result.days.length - 1
        ) {
            setSelectedDayIndex(0)
        }

        setIsPlaying((current) => !current)
    }

    function handlePreviousDay() {
        setIsPlaying(false)

        setSelectedDayIndex((current) =>
            Math.max(current - 1, 0),
        )
    }

    function handleNextDay() {
        if (!result) return

        setIsPlaying(false)

        setSelectedDayIndex((current) =>
            Math.min(
                current + 1,
                result.days.length - 1,
            ),
        )
    }

    function handleDayChange(index: number) {
        setIsPlaying(false)
        setSelectedDayIndex(index)
    }

    return {
        funds,
        selectedFundId,
        setSelectedFundId,
        selectedScenarioCode,
        setSelectedScenarioCode,

        isLoadingFunds,
        fundError,

        compatibility,
        isCheckingCompatibility,
        compatibilityError,

        result,
        isRunning,
        runError,
        canRun,
        handleRun,

        selectedDayIndex,
        selectedDay,
        previousDay,
        handlePreviousDay,
        handleNextDay,
        handleDayChange,

        isPlaying,
        togglePlayback,
        playbackSpeed,
        setPlaybackSpeed,

        history,
        isHistoryLoading,
        historyError,

        handleHistorySelect,
        isHistoryDetailLoading,
        historyDetailError,
        selectedHistoryId,

        handleHistoryDelete,
        deletingHistoryId,
        historyDeleteError,
    }
}