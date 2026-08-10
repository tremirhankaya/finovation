import { useState } from "react"

import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

export const DONUT_COLORS = [
  "#0d9488",
  "#2563eb",
  "#d97706",
  "#7c3aed",
  "#65a30d",
  "#db2777",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#059669",
  "#c026d3",
  "#ca8a04",
  "#9333ea",
  "#475569",
] as const

const RADIUS = 58
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const DIMMED_OPACITY = 0.28

type SectorSlice = {
  sectorName: string
  weight: number
}

function bySectorDescending(
  assets: OptimizationResultAsset[],
  pickWeight: (asset: OptimizationResultAsset) => number,
): SectorSlice[] {
  const weightBySector = new Map<string, number>()
  for (const asset of assets) {
    if (asset.assetType === "TPP") continue
    const weight = pickWeight(asset)
    if (weight <= 0) continue
    const sectorName = asset.sectorName ?? "Diğer"
    weightBySector.set(sectorName, (weightBySector.get(sectorName) ?? 0) + weight)
  }
  return [...weightBySector.entries()]
    .map(([sectorName, weight]) => ({ sectorName, weight }))
    .sort((a, b) => b.weight - a.weight)
}

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value)
  if (rounded > 0) return `+%${rounded}`
  if (rounded < 0) return `-%${Math.abs(rounded)}`
  return "—"
}

function Donut({
  title,
  meta,
  totalLabel,
  slices,
  colorFor,
  hoveredSector,
  onHoverSector,
}: {
  title: string
  meta: string
  totalLabel: string
  slices: SectorSlice[]
  colorFor: (sectorName: string) => string
  hoveredSector: string | null
  onHoverSector: (sectorName: string | null) => void
}) {
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0)
  let consumed = 0

  return (
    <div className={styles.donutCard}>
      <div className={styles.donutCardHeader}>
        <span className={styles.donutCardTitle}>{title}</span>
        <span className={styles.donutCardMeta}>{meta}</span>
      </div>
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={`${title} sektörel ağırlık dağılımı`}
        className={styles.donutSvg}
      >
        <circle
          cx="80"
          cy="80"
          r={RADIUS}
          fill="none"
          stroke="#e8eef4"
          strokeWidth="23"
        />
        {total > 0 &&
          slices.map((slice) => {
            const fraction = slice.weight / total
            const length = fraction * CIRCUMFERENCE
            const offset = -consumed * CIRCUMFERENCE
            consumed += fraction
            const isDimmed =
              hoveredSector != null && hoveredSector !== slice.sectorName
            const isActive = hoveredSector === slice.sectorName

            return (
              <circle
                key={slice.sectorName}
                cx="80"
                cy="80"
                r={RADIUS}
                fill="none"
                stroke={colorFor(slice.sectorName)}
                strokeWidth={isActive ? "27" : "23"}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={offset}
                transform="rotate(-90 80 80)"
                opacity={isDimmed ? DIMMED_OPACITY : 1}
                className={`${styles.donutSlice} ${isActive ? styles.donutSliceActive : ""}`}
                style={isActive ? { color: colorFor(slice.sectorName) } : undefined}
                onMouseEnter={() => onHoverSector(slice.sectorName)}
                onMouseLeave={() => onHoverSector(null)}
              />
            )
          })}
        {hoveredSector != null ? (
          <foreignObject x="18" y="58" width="124" height="44">
            <div className={styles.donutCenterHover}>
              <span className={styles.donutCenterHoverName}>
                {hoveredSector}
              </span>
              <span
                className={styles.donutCenterHoverValue}
                style={{ color: colorFor(hoveredSector) }}
              >
                %
                {(
                  slices.find((slice) => slice.sectorName === hoveredSector)
                    ?.weight ?? 0
                ).toFixed(0)}
              </span>
            </div>
          </foreignObject>
        ) : (
          <>
            <text
              x="80"
              y="76"
              textAnchor="middle"
              className={styles.donutCenterValue}
            >
              {totalLabel}
            </text>
            <text
              x="80"
              y="94"
              textAnchor="middle"
              className={styles.donutCenterLabel}
            >
              hisse ağırlığı
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

export type PortfolioDonutComparisonProps = {
  assets: OptimizationResultAsset[]
}

export default function PortfolioDonutComparison({
  assets,
}: PortfolioDonutComparisonProps) {
  const [hoveredSector, setHoveredSector] = useState<string | null>(null)

  const currentSlices = bySectorDescending(assets, (asset) => asset.currentWeight)
  const proposedSlices = bySectorDescending(
    assets,
    (asset) => asset.finalWeight ?? asset.proposedWeight,
  )

  const currentEquityTotal = currentSlices.reduce(
    (sum, slice) => sum + slice.weight,
    0,
  )
  const proposedEquityTotal = proposedSlices.reduce(
    (sum, slice) => sum + slice.weight,
    0,
  )
  const currentStockCount = assets.filter(
    (asset) => asset.assetType === "EQUITY" && asset.currentWeight > 0.001,
  ).length
  const proposedStockCount = assets.filter(
    (asset) =>
      asset.assetType === "EQUITY" &&
      (asset.finalWeight ?? asset.proposedWeight) > 0.001,
  ).length

  const allSectors = [
    ...new Set([
      ...currentSlices.map((slice) => slice.sectorName),
      ...proposedSlices.map((slice) => slice.sectorName),
    ]),
  ].sort((a, b) => {
    const proposedA =
      proposedSlices.find((slice) => slice.sectorName === a)?.weight ?? 0
    const proposedB =
      proposedSlices.find((slice) => slice.sectorName === b)?.weight ?? 0
    return proposedB - proposedA
  })

  const colorBySector = new Map(
    allSectors.map((sectorName, index) => [
      sectorName,
      DONUT_COLORS[index % DONUT_COLORS.length],
    ]),
  )
  const colorFor = (sectorName: string) =>
    colorBySector.get(sectorName) ?? "#94a3b8"

  return (
    <div className={styles.donutSection}>
      <div className={styles.donutRow}>
        <Donut
          title="Mevcut Portföy"
          meta={`${currentStockCount} hisse · %${currentEquityTotal.toFixed(0)} hisse / %${(100 - currentEquityTotal).toFixed(0)} TPP`}
          totalLabel={`%${currentEquityTotal.toFixed(0)}`}
          slices={currentSlices}
          colorFor={colorFor}
          hoveredSector={hoveredSector}
          onHoverSector={setHoveredSector}
        />
        <Donut
          title="Optimize Edilmiş Portföy"
          meta={`${proposedStockCount} hisse · %${proposedEquityTotal.toFixed(0)} hisse / %${(100 - proposedEquityTotal).toFixed(0)} TPP`}
          totalLabel={`%${proposedEquityTotal.toFixed(0)}`}
          slices={proposedSlices}
          colorFor={colorFor}
          hoveredSector={hoveredSector}
          onHoverSector={setHoveredSector}
        />
      </div>

      <table className={styles.comparisonTable}>
        <thead>
          <tr>
            <th>Sektör</th>
            <th>Mevcut</th>
            <th>Optimize Edilmiş</th>
            <th>Değişim</th>
          </tr>
        </thead>
        <tbody>
          {allSectors.map((sectorName) => {
            const current =
              currentSlices.find((slice) => slice.sectorName === sectorName)
                ?.weight ?? 0
            const proposed =
              proposedSlices.find((slice) => slice.sectorName === sectorName)
                ?.weight ?? 0
            const delta = proposed - current
            const isDimmed =
              hoveredSector != null && hoveredSector !== sectorName

            return (
              <tr
                key={sectorName}
                className={
                  isDimmed ? styles.sectorRowDimmed : styles.sectorRow
                }
                onMouseEnter={() => setHoveredSector(sectorName)}
                onMouseLeave={() => setHoveredSector(null)}
              >
                <td>
                  <span
                    className={styles.sectorSwatch}
                    style={{
                      background: colorFor(sectorName),
                      color: colorFor(sectorName),
                    }}
                    aria-hidden="true"
                  />
                  {sectorName}
                </td>
                <td>%{current.toFixed(0)}</td>
                <td>
                  <strong>%{proposed.toFixed(0)}</strong>
                </td>
                <td
                  className={
                    delta > 0.4
                      ? styles.changePositive
                      : delta < -0.4
                        ? styles.changeNegative
                        : undefined
                  }
                >
                  {formatSignedPercent(delta)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
