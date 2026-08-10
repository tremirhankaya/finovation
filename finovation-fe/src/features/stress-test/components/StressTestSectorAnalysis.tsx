import { useEffect, useMemo, useState } from "react"

import {
    fetchStressTestSectorPaths,
    fetchStressTestSectors,
} from "@/features/stress-test/api/stressTestService"
import {
    formatStressDate,
    formatStressPercentage,
} from "@/features/stress-test/lib/stressTestFormatters"
import type {
    StressTestSectorImpactResponse,
    StressTestSectorPathResponse,
} from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestCharts.module.css"

type StressTestSectorAnalysisProps = {
    testId: string
}

const SECTOR_COLORS = [
    "#0f766e",
    "#2563eb",
    "#7c3aed",
    "#d97706",
    "#dc2626",
]

const WIDTH = 760
const HEIGHT = 230

const LEFT = 58
const RIGHT = 16
const TOP = 12
const BOTTOM = 30

const PLOT_WIDTH = WIDTH - LEFT - RIGHT
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM

function getPointPosition(
    index: number,
    pointCount: number,
    impact: number,
    min: number,
    max: number,
) {
    const range = max - min || 1

    return {
        x:
            LEFT +
            (index / Math.max(pointCount - 1, 1)) *
            PLOT_WIDTH,

        y:
            TOP +
            (1 - (impact - min) / range) *
            PLOT_HEIGHT,
    }
}

function buildLinePath(
    points: StressTestSectorPathResponse["points"],
    min: number,
    max: number,
) {
    return points
        .map((point, index) => {
            const { x, y } = getPointPosition(
                index,
                points.length,
                point.impact,
                min,
                max,
            )

            return `${index === 0 ? "M" : "L"} ${x} ${y}`
        })
        .join(" ")
}

export default function StressTestSectorAnalysis({
                                                     testId,
                                                 }: StressTestSectorAnalysisProps) {
    const [sectors, setSectors] = useState<
        StressTestSectorImpactResponse[]
    >([])

    const [sectorPaths, setSectorPaths] = useState<
        StressTestSectorPathResponse[]
    >([])

    const [activeSectorCode, setActiveSectorCode] =
        useState<string | null>(null)

    const [hoveredPointIndex, setHoveredPointIndex] =
        useState<number | null>(null)

    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const controller = new AbortController()

        Promise.all([
            fetchStressTestSectors(testId, controller.signal),
            fetchStressTestSectorPaths(testId, controller.signal),
        ])
            .then(([sectorResults, paths]) => {
                setSectors(sectorResults)
                setSectorPaths(paths)
                setErrorMessage("")
            })
            .catch((error) => {
                if (controller.signal.aborted) return

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Sektörel analiz yüklenemedi.",
                )
            })

        return () => controller.abort()
    }, [testId])

    const visibleSectors = useMemo(
        () =>
            [...sectors]
                .sort(
                    (a, b) =>
                        Math.abs(b.portfolioContribution) -
                        Math.abs(a.portfolioContribution),
                )
                .slice(0, 5),
        [sectors],
    )

    const visiblePaths = useMemo(
        () =>
            visibleSectors
                .map((sector) =>
                    sectorPaths.find(
                        (path) =>
                            path.sectorCode ===
                            sector.sectorCode,
                    ),
                )
                .filter(
                    (
                        path,
                    ): path is StressTestSectorPathResponse =>
                        path !== undefined,
                ),
        [sectorPaths, visibleSectors],
    )

    const pathRange = useMemo(() => {
        const values = visiblePaths.flatMap((path) =>
            path.points.map((point) => point.impact),
        )

        return {
            min: Math.min(...values, 0),
            max: Math.max(...values, 0),
        }
    }, [visiblePaths])

    const maxSectorImpact = useMemo(
        () =>
            Math.max(
                ...visibleSectors.map((sector) =>
                    Math.abs(sector.impact),
                ),
                0.01,
            ),
        [visibleSectors],
    )

    const yTicks = useMemo(() => {
        const range = pathRange.max - pathRange.min || 1

        return [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
            value: pathRange.max - ratio * range,
            y: TOP + ratio * PLOT_HEIGHT,
        }))
    }, [pathRange])

    const xTicks = useMemo(() => {
        const points = visiblePaths[0]?.points ?? []

        if (points.length === 0) return []

        const indexes = [
            0,
            Math.floor((points.length - 1) / 3),
            Math.floor(((points.length - 1) * 2) / 3),
            points.length - 1,
        ]

        return [...new Set(indexes)].map((index) => ({
            index,
            point: points[index],
            x:
                LEFT +
                (index / Math.max(points.length - 1, 1)) *
                PLOT_WIDTH,
        }))
    }, [visiblePaths])

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

    if (sectors.length === 0 || sectorPaths.length === 0) {
        return (
            <div
                className={styles.analyticsLoading}
                role="status"
            >
                Sektörel analiz yükleniyor…
            </div>
        )
    }

    return (
        <section className={styles.sectorAnalysis}>
            <article className={styles.sectorImpactCard}>
                <div className={styles.chartHeader}>
                    <div>
                        <span>Sektörel Etki</span>
                        <h2>En çok etkilenen sektörler</h2>
                    </div>

                    <p>
                        Portföydeki pozisyonların sektör bazında
                        ağırlıklı stres etkisi.
                    </p>
                </div>

                <div className={styles.sectorImpactList}>
                    {visibleSectors.map((sector) => {
                        const width =
                            (Math.abs(sector.impact) /
                                maxSectorImpact) *
                            100

                        return (
                            <div
                                key={sector.sectorCode}
                                className={
                                    styles.sectorImpactRow
                                }
                            >
                                <div
                                    className={
                                        styles.sectorImpactLabel
                                    }
                                >
                                    <strong>
                                        {sector.sectorName}
                                    </strong>

                                    <span>
                                        Portföy ağırlığı %
                                        {sector.weight.toFixed(2)}
                                    </span>
                                </div>

                                <div
                                    className={
                                        styles.sectorImpactTrack
                                    }
                                >
                                    <div
                                        className={[
                                            styles.sectorImpactBar,
                                            sector.impact < 0
                                                ? styles.negativeBar
                                                : styles.positiveBar,
                                        ].join(" ")}
                                        style={{
                                            width: `${width}%`,
                                        }}
                                    />
                                </div>

                                <strong
                                    className={
                                        sector.impact < 0
                                            ? styles.negativeValue
                                            : styles.positiveValue
                                    }
                                >
                                    {formatStressPercentage(
                                        sector.impact,
                                    )}
                                </strong>
                            </div>
                        )
                    })}
                </div>
            </article>

            <article className={styles.sectorPathCard}>
                <div className={styles.chartHeader}>
                    <div>
                        <span>Sektör Stres Yolu</span>

                        <h2>
                            Sektörlerin senaryo boyunca değişimi
                        </h2>
                    </div>

                    <p>
                        En yüksek portföy katkısına sahip sektörlerin
                        zaman içindeki hareketi.
                    </p>
                </div>

                <div className={styles.sectorPathLegend}>
                    {visiblePaths.map((path, index) => (
                        <button
                            key={path.sectorCode}
                            type="button"
                            className={[
                                styles.sectorLegendItem,
                                activeSectorCode === path.sectorCode
                                    ? styles.sectorLegendItemActive
                                    : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            onMouseEnter={() =>
                                setActiveSectorCode(
                                    path.sectorCode,
                                )
                            }
                            onMouseLeave={() =>
                                setActiveSectorCode(null)
                            }
                            onFocus={() =>
                                setActiveSectorCode(
                                    path.sectorCode,
                                )
                            }
                            onBlur={() =>
                                setActiveSectorCode(null)
                            }
                        >
                            <span
                                style={{
                                    backgroundColor:
                                        SECTOR_COLORS[index],
                                }}
                            />

                            {path.sectorName}
                        </button>
                    ))}
                </div>

                <div className={styles.sectorPathChart}>
                    <svg
                        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                        role="img"
                        aria-label="Sektör stres yolları"
                        onMouseLeave={() =>
                            setHoveredPointIndex(null)
                        }
                    >
                        {yTicks.map((tick, index) => (
                            <g key={`sector-y-${index}`}>
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

                        {visiblePaths.map((path, index) => {
                            const isDimmed =
                                activeSectorCode !== null &&
                                activeSectorCode !==
                                path.sectorCode

                            return (
                                <path
                                    key={path.sectorCode}
                                    d={buildLinePath(
                                        path.points,
                                        pathRange.min,
                                        pathRange.max,
                                    )}
                                    fill="none"
                                    stroke={
                                        SECTOR_COLORS[index]
                                    }
                                    strokeWidth={
                                        activeSectorCode ===
                                        path.sectorCode
                                            ? 4
                                            : 2.5
                                    }
                                    className={
                                        isDimmed
                                            ? styles.sectorPathDimmed
                                            : styles.sectorPathLine
                                    }
                                />
                            )
                        })}

                        {visiblePaths[0]?.points.map(
                            (point, index) => {
                                const { x } =
                                    getPointPosition(
                                        index,
                                        visiblePaths[0].points
                                            .length,
                                        point.impact,
                                        pathRange.min,
                                        pathRange.max,
                                    )

                                return (
                                    <rect
                                        key={`${point.date}-${point.dayIndex}`}
                                        x={x - 10}
                                        y={TOP}
                                        width={20}
                                        height={PLOT_HEIGHT}
                                        fill="transparent"
                                        onMouseEnter={() =>
                                            setHoveredPointIndex(
                                                index,
                                            )
                                        }
                                    />
                                )
                            },
                        )}

                        {xTicks.map((tick) => (
                            <text
                                key={`sector-x-${tick.index}`}
                                x={tick.x}
                                y={HEIGHT - 6}
                                textAnchor={
                                    tick.index === 0
                                        ? "start"
                                        : tick.index ===
                                        visiblePaths[0]
                                            .points.length -
                                        1
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
                                styles.sectorPathTooltip
                            }
                        >
                            {visiblePaths.map(
                                (path, index) => {
                                    const point =
                                        path.points[
                                            hoveredPointIndex
                                            ]

                                    if (!point) return null

                                    return (
                                        <div
                                            key={
                                                path.sectorCode
                                            }
                                        >
                                            <span
                                                style={{
                                                    backgroundColor:
                                                        SECTOR_COLORS[
                                                            index
                                                            ],
                                                }}
                                            />

                                            <strong>
                                                {
                                                    path.sectorName
                                                }
                                            </strong>

                                            <em>
                                                {formatStressPercentage(
                                                    point.impact,
                                                )}
                                            </em>
                                        </div>
                                    )
                                },
                            )}
                        </div>
                    )}
                </div>
            </article>
        </section>
    )
}