import { useEffect, useMemo, useState } from "react"

import { fetchStressTestAssetPath } from "@/features/stress-test/api/stressTestService"
import {
    formatStressDate,
    formatStressPercentage,
} from "@/features/stress-test/lib/stressTestFormatters"
import type {
    StressTestAssetPathResponse,
    StressTestAssetResponse,
} from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestCharts.module.css"

type StressTestAssetPathChartProps = {
    testId: string
    assets: StressTestAssetResponse[]
}

const WIDTH = 760
const HEIGHT = 220

const LEFT = 58
const RIGHT = 16
const TOP = 12
const BOTTOM = 30

const PLOT_WIDTH = WIDTH - LEFT - RIGHT
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM

function getAssetLabel(asset: StressTestAssetResponse): string {
    return asset.assetType === "TPP"
        ? "Nakit ve Para Piyasası"
        : asset.assetCode
}

function buildPath(
    points: StressTestAssetPathResponse["points"],
): string {
    if (points.length === 0) return ""

    const values = points.map((point) => point.impact)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 0)
    const range = max - min || 1

    return points
        .map((point, index) => {
            const x =
                LEFT +
                (index / Math.max(points.length - 1, 1)) *
                PLOT_WIDTH

            const y =
                TOP +
                (1 - (point.impact - min) / range) *
                PLOT_HEIGHT

            return `${index === 0 ? "M" : "L"} ${x} ${y}`
        })
        .join(" ")
}

export default function StressTestAssetPathChart({
                                                     testId,
                                                     assets,
                                                 }: StressTestAssetPathChartProps) {
    const [selectedAssetCode, setSelectedAssetCode] = useState(
        assets[0]?.assetCode ?? "",
    )

    const [pathData, setPathData] =
        useState<StressTestAssetPathResponse | null>(null)

    const [errorMessage, setErrorMessage] = useState("")

    const [hoveredPointIndex, setHoveredPointIndex] =
        useState<number | null>(null)

    useEffect(() => {
        if (!selectedAssetCode) return

        const controller = new AbortController()

        setPathData(null)
        setErrorMessage("")

        fetchStressTestAssetPath(
            testId,
            selectedAssetCode,
            controller.signal,
        )
            .then(setPathData)
            .catch((error) => {
                if (controller.signal.aborted) return

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Varlık stres yolu yüklenemedi.",
                )
            })

        return () => controller.abort()
    }, [selectedAssetCode, testId])

    const path = useMemo(
        () => buildPath(pathData?.points ?? []),
        [pathData],
    )

    const chartRange = useMemo(() => {
        const values =
            pathData?.points.map((point) => point.impact) ?? []

        return {
            min: Math.min(...values, 0),
            max: Math.max(...values, 0),
        }
    }, [pathData])

    const yTicks = useMemo(() => {
        const range = chartRange.max - chartRange.min || 1

        return [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
            value: chartRange.max - ratio * range,
            y: TOP + ratio * PLOT_HEIGHT,
        }))
    }, [chartRange])

    function getPointPosition(index: number) {
        if (!pathData) return { x: 0, y: 0 }

        const point = pathData.points[index]
        const range = chartRange.max - chartRange.min || 1

        return {
            x:
                LEFT +
                (index /
                    Math.max(pathData.points.length - 1, 1)) *
                PLOT_WIDTH,

            y:
                TOP +
                (1 -
                    (point.impact - chartRange.min) / range) *
                PLOT_HEIGHT,
        }
    }

    const selectedAsset = assets.find(
        (asset) => asset.assetCode === selectedAssetCode,
    )

    if (assets.length === 0) return null

    return (
        <section className={styles.assetPathCard}>
            <div className={styles.chartHeader}>
                <div>
                    <span>Varlık Stres Yolu</span>
                    <h2>Varlığın senaryo boyunca değişimi</h2>
                </div>

                <select
                    className={styles.assetPathSelect}
                    value={selectedAssetCode}
                    onChange={(event) =>
                        setSelectedAssetCode(event.target.value)
                    }
                >
                    {assets.map((asset) => (
                        <option
                            key={asset.assetCode}
                            value={asset.assetCode}
                        >
                            {getAssetLabel(asset)}
                        </option>
                    ))}
                </select>
            </div>

            {errorMessage && (
                <div
                    className={styles.analyticsError}
                    role="alert"
                >
                    {errorMessage}
                </div>
            )}

            {!pathData && !errorMessage && (
                <div
                    className={styles.analyticsLoading}
                    role="status"
                >
                    Varlık yolu yükleniyor…
                </div>
            )}

            {pathData && pathData.points.length > 0 && (
                <>
                    <div className={styles.assetPathMeta}>
                        <div>
                            <span>Final Etki</span>

                            <strong>
                                {formatStressPercentage(
                                    pathData.points[
                                    pathData.points.length - 1
                                        ].impact,
                                )}
                            </strong>
                        </div>

                        {selectedAsset && (
                            <div>
                                <span>Portföy Ağırlığı</span>

                                <strong>
                                    %{selectedAsset.weight.toFixed(2)}
                                </strong>
                            </div>
                        )}
                    </div>

                    <div className={styles.assetPathChart}>
                        <svg
                            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                            role="img"
                            aria-label={`${selectedAssetCode} stres yolu`}
                            onMouseLeave={() =>
                                setHoveredPointIndex(null)
                            }
                        >
                            {yTicks.map((tick, index) => (
                                <g key={`asset-y-${index}`}>
                                    <line
                                        x1={LEFT}
                                        x2={WIDTH - RIGHT}
                                        y1={tick.y}
                                        y2={tick.y}
                                        className={
                                            styles.axisGridLine
                                        }
                                    />

                                    <text
                                        x={LEFT - 10}
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
                                d={path}
                                className={styles.assetPathLine}
                            />

                            {pathData.points.map(
                                (point, index) => {
                                    const { x, y } =
                                        getPointPosition(index)

                                    return (
                                        <circle
                                            key={`${point.date}-${point.dayIndex}`}
                                            cx={x}
                                            cy={y}
                                            r="9"
                                            className={
                                                styles.pathHitPoint
                                            }
                                            onMouseEnter={() =>
                                                setHoveredPointIndex(
                                                    index,
                                                )
                                            }
                                        />
                                    )
                                },
                            )}

                            {[
                                0,
                                Math.floor(
                                    (pathData.points.length - 1) /
                                    3,
                                ),
                                Math.floor(
                                    ((pathData.points.length - 1) *
                                        2) /
                                    3,
                                ),
                                pathData.points.length - 1,
                            ].map((index) => {
                                const { x } =
                                    getPointPosition(index)

                                return (
                                    <text
                                        key={`asset-x-${index}`}
                                        x={x}
                                        y={HEIGHT - 6}
                                        textAnchor={
                                            index === 0
                                                ? "start"
                                                : index ===
                                                pathData.points
                                                    .length -
                                                1
                                                    ? "end"
                                                    : "middle"
                                        }
                                        className={
                                            styles.axisLabel
                                        }
                                    >
                                        {formatStressDate(
                                            pathData.points[index]
                                                .date,
                                        )}
                                    </text>
                                )
                            })}
                        </svg>

                        {hoveredPointIndex !== null && (
                            <div
                                className={styles.pathTooltip}
                            >
                                <span>
                                    {formatStressDate(
                                        pathData.points[
                                            hoveredPointIndex
                                            ].date,
                                    )}
                                </span>

                                <strong>
                                    {formatStressPercentage(
                                        pathData.points[
                                            hoveredPointIndex
                                            ].impact,
                                    )}
                                </strong>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    )
}