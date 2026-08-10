import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

import type { RlInferenceDay } from "@/features/stress-test/model/rlStressTest.types"

type RlNavComparisonChartProps = {
    days: RlInferenceDay[]
    selectedDayIndex: number
}

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
})

function formatDate(value: string) {
    const date = new Date(`${value}T00:00:00Z`)

    return Number.isNaN(date.getTime())
        ? value
        : dateFormatter.format(date)
}

function formatNav(value: number) {
    return `${currencyFormatter.format(value)} ₺`
}

export default function RlNavComparisonChart({
                                                 days,
                                                 selectedDayIndex,
                                             }: RlNavComparisonChartProps) {
    if (days.length === 0) {
        return null
    }
    const selectedDay = days[selectedDayIndex] ?? null
    return (
        <ResponsiveContainer width="100%" height={340}>
            <LineChart
                data={days}
                margin={{
                    top: 12,
                    right: 24,
                    bottom: 8,
                    left: 24,
                }}
            >
                <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                />

                <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={32}
                />

                <YAxis
                    tickFormatter={(value: number) =>
                        currencyFormatter.format(value)
                    }
                    tickLine={false}
                    axisLine={false}
                    width={90}
                    domain={["auto", "auto"]}
                />

                <Tooltip
                    labelFormatter={(value) =>
                        formatDate(String(value))
                    }
                    formatter={(value, name) => [
                        formatNav(Number(value)),
                        name,
                    ]}
                />

                <Legend />

                <Line
                    type="monotone"
                    dataKey="total_new_nav"
                    name="RL Portföyü"
                    stroke="#0d9488"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                />

                <Line
                    type="monotone"
                    dataKey="passive_nav"
                    name="Pasif Portföy"
                    stroke="#94a3b8"
                    strokeWidth={3}
                    strokeDasharray="7 5"
                    dot={false}
                    activeDot={{ r: 5 }}
                />
                {selectedDay ? (
                    <>
                        <ReferenceLine
                            x={selectedDay.date}
                            stroke="#0f2d52"
                            strokeDasharray="4 4"
                        />

                        <ReferenceDot
                            x={selectedDay.date}
                            y={selectedDay.total_new_nav}
                            r={6}
                            fill="#0d9488"
                            stroke="#ffffff"
                            strokeWidth={3}
                        />

                        <ReferenceDot
                            x={selectedDay.date}
                            y={selectedDay.passive_nav}
                            r={5}
                            fill="#64748b"
                            stroke="#ffffff"
                            strokeWidth={3}
                        />
                    </>
                ) : null}
            </LineChart>
        </ResponsiveContainer>
    )
}