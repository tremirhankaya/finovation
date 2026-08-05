import { formatPercentage } from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import type {
  ComparisonPeriod,
  FundComparisonAsset,
} from "@/features/fund-monitoring/model/fundMonitoring.types"

type ComparisonBarChartProps = {
  assets: FundComparisonAsset[]
  period: ComparisonPeriod
}

const WIDTH = 1000
const HEIGHT = 340
const PADDING = { top: 36, right: 24, bottom: 76, left: 48 }

export default function ComparisonBarChart({
  assets,
  period,
}: ComparisonBarChartProps) {
  const values = assets.map((asset) => asset.returns[period] ?? null)
  const numericValues = values.filter(
    (value): value is number => value !== null,
  )
  const greatestMagnitude = Math.max(
    ...numericValues.map((value) => Math.abs(value)),
    1,
  )
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const zeroY = PADDING.top + plotHeight / 2
  const slotWidth = plotWidth / Math.max(assets.length, 1)
  const barWidth = Math.min(slotWidth * 0.58, 58)

  if (assets.length === 0) {
    return (
      <div role="img" aria-label="Karşılaştırma için seçili varlık bulunmuyor">
        Karşılaştırmak için aşağıdaki listeden en az bir varlık seçin.
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Seçili varlıkların dönemsel getirisini gösteren sütun grafik"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = PADDING.top + plotHeight * ratio
        return (
          <line
            key={ratio}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={y}
            y2={y}
            stroke={ratio === 0.5 ? "#cbd5e1" : "#eef2f6"}
            strokeWidth={ratio === 0.5 ? 1.5 : 1}
          />
        )
      })}

      {assets.map((asset, index) => {
        const value = values[index]
        const x = PADDING.left + slotWidth * index + (slotWidth - barWidth) / 2
        const height =
          value === null
            ? 0
            : (Math.abs(value) / greatestMagnitude) * (plotHeight / 2 - 18)
        const y = value !== null && value >= 0 ? zeroY - height : zeroY
        const labelX = PADDING.left + slotWidth * index + slotWidth / 2

        return (
          <g key={asset.id}>
            {value === null ? (
              <line
                x1={x}
                x2={x + barWidth}
                y1={zeroY}
                y2={zeroY}
                stroke="#cbd5e1"
                strokeDasharray="5 4"
                strokeWidth="3"
              />
            ) : (
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(height, 2)}
                rx="5"
                fill={asset.color}
              />
            )}
            <text
              x={labelX}
              y={value !== null && value >= 0 ? y - 9 : y + height + 17}
              textAnchor="middle"
              fill="#0f172a"
              fontSize="12"
              fontWeight="700"
            >
              {formatPercentage(value)}
            </text>
            <text
              x={labelX}
              y={HEIGHT - PADDING.bottom + 25}
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
              fontWeight="600"
            >
              {asset.code}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
