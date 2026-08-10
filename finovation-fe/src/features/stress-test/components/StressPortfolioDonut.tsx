import { useMemo, useState } from "react"

import type { StressTestAssetResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestCharts.module.css"

type StressPortfolioDonutProps = {
    assets: StressTestAssetResponse[]
}

type DonutSlice = {
    label: string
    weight: number
    color: string
    startAngle: number
    endAngle: number
}

const PALETTE = [
    "#007f78",
    "#11a99d",
    "#17456f",
    "#3178d4",
    "#5856c7",
    "#8667d6",
    "#4b647c",
]

function polarPoint(
    cx: number,
    cy: number,
    radius: number,
    angle: number,
) {
    const radians = ((angle - 90) * Math.PI) / 180

    return {
        x: cx + radius * Math.cos(radians),
        y: cy + radius * Math.sin(radians),
    }
}

function createDonutPath(
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number,
    startAngle: number,
    endAngle: number,
) {
    const sweep = Math.max(0.01, endAngle - startAngle)
    const largeArc = sweep > 180 ? 1 : 0

    const outerStart = polarPoint(
        cx,
        cy,
        outerRadius,
        startAngle,
    )
    const outerEnd = polarPoint(
        cx,
        cy,
        outerRadius,
        startAngle + sweep,
    )
    const innerStart = polarPoint(
        cx,
        cy,
        innerRadius,
        startAngle + sweep,
    )
    const innerEnd = polarPoint(
        cx,
        cy,
        innerRadius,
        startAngle,
    )

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
        "Z",
    ].join(" ")
}

function buildSlices(
    assets: StressTestAssetResponse[],
): DonutSlice[] {
    const sortedAssets = [...assets].sort(
        (a, b) => b.weight - a.weight,
    )

    const visibleAssets = sortedAssets.slice(0, 6)
    const otherWeight = sortedAssets
        .slice(6)
        .reduce((sum, asset) => sum + asset.weight, 0)

    const items = [
        ...visibleAssets.map((asset) => ({
            label: asset.assetCode,
            weight: asset.weight,
        })),
        ...(otherWeight > 0
            ? [{ label: "Diğer", weight: otherWeight }]
            : []),
    ]

    const totalWeight =
        items.reduce((sum, item) => sum + item.weight, 0) || 1

    let angle = 0

    return items.map((item, index) => {
        const span = (item.weight / totalWeight) * 360
        const startAngle = angle
        const endAngle = angle + span

        angle = endAngle

        return {
            ...item,
            color: PALETTE[index],
            startAngle,
            endAngle,
        }
    })
}

export default function StressPortfolioDonut({
                                                 assets,
                                             }: StressPortfolioDonutProps) {
    const [activeLabel, setActiveLabel] =
        useState<string | null>(null)

    const slices = useMemo(
        () => buildSlices(assets),
        [assets],
    )

    if (assets.length === 0) return null

    const activeSlice =
        slices.find((slice) => slice.label === activeLabel) ??
        null

    const size = 220
    const center = size / 2
    const outerRadius = 94
    const innerRadius = 57

    return (
        <section
            className={styles.donutCard}
            aria-labelledby="portfolio-distribution-title"
        >
            <div className={styles.chartHeader}>
                <div>
                    <span>Portföy Dağılımı</span>
                    <h2 id="portfolio-distribution-title">
                        Varlık ağırlıkları
                    </h2>
                </div>

                <p>
                    Stres testine giren portföyün mevcut dağılımı.
                </p>
            </div>

            <div className={styles.donutContent}>
                <div
                    className={styles.donutVisual}
                    onMouseLeave={() => setActiveLabel(null)}
                >
                    <svg
                        className={styles.donutSvg}
                        viewBox={`0 0 ${size} ${size}`}
                        role="img"
                        aria-label="Portföy varlık dağılımı"
                    >
                        {slices.map((slice) => {
                            const isActive =
                                activeLabel === slice.label
                            const isDimmed =
                                activeLabel !== null &&
                                !isActive

                            return (
                                <path
                                    key={slice.label}
                                    d={createDonutPath(
                                        center,
                                        center,
                                        isActive
                                            ? outerRadius + 5
                                            : outerRadius,
                                        innerRadius,
                                        slice.startAngle,
                                        slice.endAngle,
                                    )}
                                    fill={slice.color}
                                    className={[
                                        styles.donutSlice,
                                        isActive
                                            ? styles.donutSliceActive
                                            : "",
                                        isDimmed
                                            ? styles.donutSliceDimmed
                                            : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    onMouseEnter={() =>
                                        setActiveLabel(slice.label)
                                    }
                                />
                            )
                        })}

                        <circle
                            cx={center}
                            cy={center}
                            r={innerRadius - 1}
                            className={styles.donutCenterCircle}
                        />

                        <text
                            x={center}
                            y={center - 7}
                            textAnchor="middle"
                            className={styles.donutCenterLabel}
                        >
                            {activeSlice
                                ? activeSlice.label
                                : `${assets.length} Varlık`}
                        </text>

                        <text
                            x={center}
                            y={center + 15}
                            textAnchor="middle"
                            className={styles.donutCenterValue}
                        >
                            {activeSlice
                                ? `%${activeSlice.weight.toFixed(2)}`
                                : "Portföy"}
                        </text>
                    </svg>
                </div>

                <div className={styles.donutLegend}>
                    {slices.map((slice) => {
                        const isActive =
                            activeLabel === slice.label
                        const isDimmed =
                            activeLabel !== null &&
                            !isActive

                        return (
                            <button
                                type="button"
                                className={[
                                    styles.donutLegendItem,
                                    isActive
                                        ? styles.donutLegendItemActive
                                        : "",
                                    isDimmed
                                        ? styles.donutLegendItemDimmed
                                        : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                key={slice.label}
                                onMouseEnter={() =>
                                    setActiveLabel(slice.label)
                                }
                                onMouseLeave={() =>
                                    setActiveLabel(null)
                                }
                                onFocus={() =>
                                    setActiveLabel(slice.label)
                                }
                                onBlur={() =>
                                    setActiveLabel(null)
                                }
                            >
                                <span
                                    className={
                                        styles.donutLegendColor
                                    }
                                    style={{
                                        backgroundColor:
                                        slice.color,
                                    }}
                                    aria-hidden="true"
                                />

                                <strong>{slice.label}</strong>

                                <span>
                                    {slice.weight.toFixed(2)}%
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}