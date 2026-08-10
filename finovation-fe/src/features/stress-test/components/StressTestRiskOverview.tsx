import { useEffect, useMemo, useState } from "react"

import { fetchStressTestPortfolioPath } from "@/features/stress-test/api/stressTestService"
import {
    formatStressDate,
    formatStressPercentage,
} from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestPortfolioPathPointResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestCharts.module.css"

type StressTestRiskOverviewProps = {
    testId: string
}

const CHART_WIDTH = 760
const CHART_HEIGHT = 220

const CHART_LEFT = 58
const CHART_RIGHT = 16
const CHART_TOP = 12
const CHART_BOTTOM = 30

export default function StressTestRiskOverview({
                                                   testId,
                                               }: StressTestRiskOverviewProps) {
    const [points, setPoints] = useState<
        StressTestPortfolioPathPointResponse[]
    >([])

    const [hoveredPointIndex, setHoveredPointIndex] =
        useState<number | null>(null)

    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const controller = new AbortController()

        fetchStressTestPortfolioPath(testId, controller.signal)
            .then((portfolioPath) => {
                setPoints(portfolioPath.points)
                setErrorMessage("")
            })
            .catch((error) => {
                if (controller.signal.aborted) return

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Portföy stres yolu yüklenemedi.",
                )
            })

        return () => controller.abort()
    }, [testId])

    const plotWidth =
        CHART_WIDTH - CHART_LEFT - CHART_RIGHT

    const plotHeight =
        CHART_HEIGHT - CHART_TOP - CHART_BOTTOM

    const chartRange = useMemo(() => {
        const values = points.map(
            (point) => point.portfolioImpact,
        )

        return {
            min: Math.min(...values, 0),
            max: Math.max(...values, 0),
        }
    }, [points])

    const getPointPosition = (index: number) => {
        const point = points[index]
        const range =
            chartRange.max - chartRange.min || 1

        const x =
            CHART_LEFT +
            (index / Math.max(points.length - 1, 1)) *
            plotWidth

        const y =
            CHART_TOP +
            (1 -
                (point.portfolioImpact - chartRange.min) /
                range) *
            plotHeight

        return { x, y }
    }

    const path = useMemo(() => {
        if (points.length === 0) return ""

        return points
            .map((_, index) => {
                const { x, y } = getPointPosition(index)

                return `${index === 0 ? "M" : "L"} ${x} ${y}`
            })
            .join(" ")
    }, [points, chartRange])

    const areaPath = useMemo(() => {
        if (!path) return ""

        return [
            path,
            `L ${CHART_WIDTH - CHART_RIGHT} ${CHART_HEIGHT - CHART_BOTTOM}`,
            `L ${CHART_LEFT} ${CHART_HEIGHT - CHART_BOTTOM}`,
            "Z",
        ].join(" ")
    }, [path])

    const yTicks = useMemo(() => {
        const tickCount = 4
        const range =
            chartRange.max - chartRange.min || 1

        return Array.from(
            { length: tickCount + 1 },
            (_, index) => {
                const ratio = index / tickCount

                return {
                    value:
                        chartRange.max -
                        ratio * range,
                    y:
                        CHART_TOP +
                        ratio * plotHeight,
                }
            },
        )
    }, [chartRange, plotHeight])

    const xTicks = useMemo(() => {
        if (points.length === 0) return []

        const indexes = [
            0,
            Math.floor((points.length - 1) / 3),
            Math.floor(
                ((points.length - 1) * 2) / 3,
            ),
            points.length - 1,
        ]

        return [...new Set(indexes)].map((index) => ({
            index,
            point: points[index],
            x:
                CHART_LEFT +
                (index /
                    Math.max(points.length - 1, 1)) *
                plotWidth,
        }))
    }, [points, plotWidth])

    const worstPointIndex = useMemo(() => {
        if (points.length === 0) return -1

        return points.reduce(
            (worstIndex, point, index) =>
                point.portfolioImpact <
                points[worstIndex].portfolioImpact
                    ? index
                    : worstIndex,
            0,
        )
    }, [points])

    if (errorMessage) {
        return (
            <div
                className={styles.analyticsError}
                role="alert"
            >
                {errorMessage}
            </div>
        )
    }

    if (points.length === 0) {
        return (
            <div
                className={styles.analyticsLoading}
                role="status"
            >
                Portföy stres yolu yükleniyor…
            </div>
        )
    }

    return (
        <section className={styles.riskOverview}>
            <article className={styles.portfolioPathCard}>
                <div className={styles.chartHeader}>
                    <div>
                        <span>Portföy Stres Yolu</span>
                        <h2>
                            Senaryo boyunca portföy değişimi
                        </h2>
                    </div>

                    <p>
                        Portföyün senaryo başlangıcından
                        itibaren kümülatif etkisi.
                    </p>
                </div>

                <div className={styles.portfolioPathChart}>
                    <svg
                        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                        role="img"
                        aria-label="Portföy stres yolu grafiği"
                        onMouseLeave={() =>
                            setHoveredPointIndex(null)
                        }
                    >
                        {yTicks.map((tick, index) => (
                            <g key={`y-tick-${index}`}>
                                <line
                                    x1={CHART_LEFT}
                                    x2={
                                        CHART_WIDTH -
                                        CHART_RIGHT
                                    }
                                    y1={tick.y}
                                    y2={tick.y}
                                    className={
                                        styles.axisGridLine
                                    }
                                />

                                <text
                                    x={CHART_LEFT - 10}
                                    y={tick.y + 4}
                                    textAnchor="end"
                                    className={
                                        styles.axisLabel
                                    }
                                >
                                    {formatStressPercentage(
                                        tick.value,
                                    )}
                                </text>
                            </g>
                        ))}

                        <path
                            d={areaPath}
                            className={
                                styles.portfolioPathArea
                            }
                        />

                        <path
                            d={path}
                            className={
                                styles.portfolioPathLine
                            }
                        />

                        {points.map((point, index) => {
                            const { x, y } =
                                getPointPosition(index)

                            return (
                                <circle
                                    key={`${point.date}-${point.dayIndex}`}
                                    cx={x}
                                    cy={y}
                                    r={
                                        index ===
                                        worstPointIndex
                                            ? 5
                                            : 9
                                    }
                                    className={
                                        index ===
                                        worstPointIndex
                                            ? styles.pathWorstPoint
                                            : styles.pathHitPoint
                                    }
                                    onMouseEnter={() =>
                                        setHoveredPointIndex(
                                            index,
                                        )
                                    }
                                />
                            )
                        })}

                        {xTicks.map((tick) => (
                            <text
                                key={`x-tick-${tick.index}`}
                                x={tick.x}
                                y={CHART_HEIGHT - 6}
                                textAnchor={
                                    tick.index === 0
                                        ? "start"
                                        : tick.index ===
                                        points.length - 1
                                            ? "end"
                                            : "middle"
                                }
                                className={
                                    styles.axisLabel
                                }
                            >
                                {formatStressDate(
                                    tick.point.date,
                                )}
                            </text>
                        ))}
                    </svg>

                    {hoveredPointIndex !== null && (
                        <div
                            className={
                                styles.pathTooltip
                            }
                        >
                            <span>
                                {formatStressDate(
                                    points[
                                        hoveredPointIndex
                                        ].date,
                                )}
                            </span>

                            <strong>
                                {formatStressPercentage(
                                    points[
                                        hoveredPointIndex
                                        ].portfolioImpact,
                                )}
                            </strong>
                        </div>
                    )}
                </div>
            </article>
        </section>
    )
}