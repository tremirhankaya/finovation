import { useRef, useState, type PointerEvent } from "react"

import { formatSharePrice } from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import type { PricePoint } from "@/features/fund-monitoring/model/fundMonitoring.types"

type PriceTrendChartProps = {
  points: PricePoint[]
  fundName?: string
  currency: string
}

type ChartPoint = PricePoint & {
  x: number
  y: number
}

const WIDTH = 760
const HEIGHT = 250
const PLOT_LEFT = 72
const PLOT_RIGHT = 18
const PLOT_TOP = 18
const PLOT_BOTTOM = 38
const Y_TICK_COUNT = 5
const X_TICK_COUNT = 4

const axisPriceFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
})

const tooltipDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

function parseDataDate(date: string): Date | null {
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatAxisDate(date: string): string {
  const parsed = parseDataDate(date)
  return parsed ? shortDateFormatter.format(parsed) : date
}

function formatTooltipDate(date: string): string {
  const parsed = parseDataDate(date)
  return parsed ? tooltipDateFormatter.format(parsed) : date
}

function uniqueTickIndexes(pointCount: number): number[] {
  if (pointCount <= 1) return [0]

  return Array.from(
    { length: Math.min(X_TICK_COUNT, pointCount) },
    (_, index) =>
      Math.round(
        (index / (Math.min(X_TICK_COUNT, pointCount) - 1)) * (pointCount - 1),
      ),
  ).filter((value, index, values) => values.indexOf(value) === index)
}

function createChartPoints(
  points: PricePoint[],
): {
  chartPoints: ChartPoint[]
  minimum: number
  maximum: number
} {
  const values = points.map((point) => point.value)
  const rawMinimum = Math.min(...values)
  const rawMaximum = Math.max(...values)
  const rawRange = rawMaximum - rawMinimum
  const padding =
    rawRange === 0 ? Math.max(Math.abs(rawMinimum) * 0.01, 0.01) : 0
  const minimum = rawMinimum - padding
  const maximum = rawMaximum + padding
  const range = maximum - minimum || 1
  const plotWidth = WIDTH - PLOT_LEFT - PLOT_RIGHT
  const plotHeight = HEIGHT - PLOT_TOP - PLOT_BOTTOM

  return {
    minimum,
    maximum,
    chartPoints: points.map((point, index) => ({
      ...point,
      x: PLOT_LEFT + (index / Math.max(points.length - 1, 1)) * plotWidth,
      y: PLOT_TOP + ((maximum - point.value) / range) * plotHeight,
    })),
  }
}

export default function PriceTrendChart({
  points,
  fundName,
  currency,
}: PriceTrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const hasData = points.length > 0
  const hasLine = points.length > 1
  const { chartPoints, minimum, maximum } = hasData
    ? createChartPoints(points)
    : { chartPoints: [], minimum: 0, maximum: 0 }
  const linePath = chartPoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ")
  const plotBottom = HEIGHT - PLOT_BOTTOM
  const areaPath = linePath
    ? `${linePath} L${WIDTH - PLOT_RIGHT} ${plotBottom} L${PLOT_LEFT} ${plotBottom} Z`
    : ""
  const yTicks = Array.from({ length: Y_TICK_COUNT }, (_, index) => ({
    y:
      PLOT_TOP +
      (index / (Y_TICK_COUNT - 1)) * (HEIGHT - PLOT_TOP - PLOT_BOTTOM),
    value: maximum - (index / (Y_TICK_COUNT - 1)) * (maximum - minimum),
  }))
  const activePoint = hoveredIndex === null ? null : chartPoints[hoveredIndex]

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!hasData) return

    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0) return

    const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * WIDTH
    const ratio = Math.min(
      1,
      Math.max(0, (viewBoxX - PLOT_LEFT) / (WIDTH - PLOT_LEFT - PLOT_RIGHT)),
    )
    setHoveredIndex(Math.round(ratio * Math.max(chartPoints.length - 1, 0)))
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          hasData
            ? `${fundName ?? "Seçili fon"} pay fiyatı değişim grafiği`
            : "Fon seçilmediği için pay fiyatı verisi bulunmuyor"
        }
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="fund-price-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={PLOT_LEFT}
              x2={WIDTH - PLOT_RIGHT}
              y1={tick.y}
              y2={tick.y}
              stroke="#e8eef4"
              strokeWidth="1"
            />
            {hasData && (
              <text
                x={PLOT_LEFT - 9}
                y={tick.y + 4}
                fill="#64748b"
                fontSize="11"
                textAnchor="end"
              >
                {axisPriceFormatter.format(tick.value)}
              </text>
            )}
          </g>
        ))}

        {hasData &&
          uniqueTickIndexes(chartPoints.length).map((index) => {
            const point = chartPoints[index]
            return (
              <text
                key={`${point.date}-${index}`}
                x={point.x}
                y={HEIGHT - 12}
                fill="#64748b"
                fontSize="11"
                textAnchor={
                  index === 0
                    ? "start"
                    : index === chartPoints.length - 1
                      ? "end"
                      : "middle"
                }
              >
                {formatAxisDate(point.date)}
              </text>
            )
          })}

        {hasLine ? (
          <>
            <path d={areaPath} fill="url(#fund-price-area)" />
            <path
              d={linePath}
              fill="none"
              stroke="#0d9488"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : hasData ? (
          <circle
            cx={chartPoints[0].x}
            cy={chartPoints[0].y}
            r="5"
            fill="#0d9488"
          />
        ) : (
          <line
            x1={PLOT_LEFT}
            x2={WIDTH - PLOT_RIGHT}
            y1={(PLOT_TOP + plotBottom) / 2}
            y2={(PLOT_TOP + plotBottom) / 2}
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="8 8"
          />
        )}

        {activePoint && (
          <g role="status" aria-live="polite">
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={PLOT_TOP}
              y2={plotBottom}
              stroke="#0f766e"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="5"
              fill="#fff"
              stroke="#0d9488"
              strokeWidth="3"
            />
            <g
              transform={`translate(${Math.min(
                WIDTH - PLOT_RIGHT - 172,
                Math.max(PLOT_LEFT, activePoint.x - 86),
              )} ${Math.max(PLOT_TOP + 4, activePoint.y - 62)})`}
            >
              <rect
                width="172"
                height="50"
                rx="8"
                fill="#0f2d52"
                opacity="0.96"
              />
              <text x="10" y="19" fill="#cbd5e1" fontSize="11">
                {formatTooltipDate(activePoint.date)}
              </text>
              <text x="10" y="38" fill="#fff" fontSize="12" fontWeight="700">
                Pay fiyatı: {formatSharePrice(activePoint.value, currency)}
              </text>
            </g>
          </g>
        )}
      </svg>
      {!hasData && <p>Grafik verisi fon seçildikten sonra gösterilecek.</p>}
      {hasData && !hasLine && (
        <p>Fon yeni oluşturulduğu için henüz tek fiyat verisi bulunuyor.</p>
      )}
    </div>
  )
}
