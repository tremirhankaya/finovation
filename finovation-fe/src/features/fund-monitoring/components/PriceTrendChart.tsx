import type { PricePoint } from "@/features/fund-monitoring/model/fundMonitoring.types"

type PriceTrendChartProps = {
  points: PricePoint[]
  fundName?: string
}

const WIDTH = 760
const HEIGHT = 230
const PADDING_X = 18
const PADDING_Y = 20

function createPath(points: PricePoint[]): string {
  const values = points.map((point) => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum || 1

  return points
    .map((point, index) => {
      const x =
        PADDING_X +
        (index / Math.max(points.length - 1, 1)) * (WIDTH - PADDING_X * 2)
      const y =
        HEIGHT -
        PADDING_Y -
        ((point.value - minimum) / range) * (HEIGHT - PADDING_Y * 2)

      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

export default function PriceTrendChart({
  points,
  fundName,
}: PriceTrendChartProps) {
  const hasData = points.length > 0
  const hasLine = points.length > 1
  const linePath = hasLine ? createPath(points) : ""
  const areaPath = linePath
    ? `${linePath} L${WIDTH - PADDING_X} ${HEIGHT - PADDING_Y} L${PADDING_X} ${HEIGHT - PADDING_Y} Z`
    : ""

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          hasData
            ? `${fundName ?? "Seçili fon"} pay fiyatı değişim grafiği`
            : "Fon seçilmediği için pay fiyatı verisi bulunmuyor"
        }
      >
        <defs>
          <linearGradient id="fund-price-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[50, 95, 140, 185].map((y) => (
          <line
            key={y}
            x1={PADDING_X}
            x2={WIDTH - PADDING_X}
            y1={y}
            y2={y}
            stroke="#e8eef4"
            strokeWidth="1"
          />
        ))}

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
          <circle cx={PADDING_X} cy={HEIGHT / 2} r="5" fill="#0d9488" />
        ) : (
          <line
            x1={PADDING_X}
            x2={WIDTH - PADDING_X}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="8 8"
          />
        )}
      </svg>
      {!hasData && <p>Grafik verisi fon seçildikten sonra gösterilecek.</p>}
      {hasData && !hasLine && (
        <p>Fon yeni oluşturulduğu için henüz tek fiyat verisi bulunuyor.</p>
      )}
    </div>
  )
}
