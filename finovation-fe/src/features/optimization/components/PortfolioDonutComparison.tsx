import { useMemo, useState } from "react"

import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

export const DONUT_COLORS = [
  "#2ec4a7",
  "#4a90d9",
  "#f0a05a",
  "#8b7cf0",
  "#e26d8a",
  "#45b7c8",
  "#f4c15d",
  "#6bcb77",
  "#c77dff",
  "#ff6b6b",
  "#4ecdc4",
  "#ffa94d",
  "#748ffc",
  "#69db7c",
  "#ff8787",
  "#3bc9db",
  "#b197fc",
  "#fcc419",
  "#20c997",
  "#339af0",
] as const

type SectorSlice = {
  sectorName: string
  weight: number
}

type SliceMeta = SectorSlice & {
  color: string
  startAngle: number
  endAngle: number
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

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = Math.max(0.01, endAngle - startAngle)
  const end = startAngle + sweep
  const largeArc = sweep > 180 ? 1 : 0
  const o1 = polar(cx, cy, outerR, startAngle)
  const o2 = polar(cx, cy, outerR, end)
  const i1 = polar(cx, cy, innerR, end)
  const i2 = polar(cx, cy, innerR, startAngle)
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ")
}

function buildSliceMeta(
  slices: SectorSlice[],
  colorFor: (sectorName: string) => string,
): SliceMeta[] {
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0) || 1
  let cursor = 0
  return slices.map((slice) => {
    const span = (slice.weight / total) * 360
    const startAngle = cursor
    const endAngle = cursor + span
    cursor = endAngle
    return {
      ...slice,
      color: colorFor(slice.sectorName),
      startAngle,
      endAngle,
    }
  })
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
  const meta_ = useMemo(
    () => buildSliceMeta(slices, colorFor),
    [slices, colorFor],
  )
  const active = meta_.find((slice) => slice.sectorName === hoveredSector) ?? null
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const outerR = 90
  const innerR = 52

  return (
    <div className={styles.donutCard}>
      <div className={styles.donutCardHeader}>
        <span className={styles.donutCardTitle}>{title}</span>
        <span className={styles.donutCardMeta}>{meta}</span>
      </div>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${title} sektörel ağırlık dağılımı`}
        className={styles.donutSvg}
      >
        {meta_.map((slice) => {
          const isActive = hoveredSector === slice.sectorName
          const isDimmed = hoveredSector != null && !isActive
          return (
            <path
              key={slice.sectorName}
              d={donutPath(
                cx,
                cy,
                outerR,
                innerR,
                slice.startAngle,
                slice.endAngle,
              )}
              fill={slice.color}
              className={[
                styles.donutSlice,
                isActive ? styles.donutSliceActive : "",
                isDimmed ? styles.donutSliceDimmed : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseEnter={() => onHoverSector(slice.sectorName)}
              onMouseLeave={() => onHoverSector(null)}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={innerR - 1} className={styles.donutCenter} />
        <text
          x={cx}
          y={active ? cy - 8 : cy - 4}
          textAnchor="middle"
          className={styles.donutCenterValue}
        >
          {active ? `%${active.weight.toFixed(0)}` : totalLabel}
        </text>
        <text
          x={cx}
          y={active ? cy + 12 : cy + 16}
          textAnchor="middle"
          className={styles.donutCenterLabel}
        >
          {active ? active.sectorName : "hisse ağırlığı"}
        </text>
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

      <ul className={styles.donutLegendList}>
        {allSectors.map((sectorName) => {
          const isActive = hoveredSector === sectorName
          const isDimmed = hoveredSector != null && !isActive
          const proposed =
            proposedSlices.find((slice) => slice.sectorName === sectorName)
              ?.weight ?? 0

          return (
            <li
              key={sectorName}
              className={[
                styles.donutLegendItem,
                isActive ? styles.donutLegendItemActive : "",
                isDimmed ? styles.donutLegendItemDimmed : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseEnter={() => setHoveredSector(sectorName)}
              onMouseLeave={() => setHoveredSector(null)}
            >
              <span
                className={styles.donutLegendSwatch}
                style={{ background: colorFor(sectorName) }}
              />
              <span className={styles.donutLegendCode}>{sectorName}</span>
              <span className={styles.donutLegendPct}>
                %{proposed.toFixed(0)}
              </span>
            </li>
          )
        })}
      </ul>

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
