import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import {
    formatStressDate,
    formatStressPercentage,
    formatStressWeight,
} from "@/features/stress-test/lib/stressTestFormatters"
import type {
    RunStressTestResponse,
    StressTestAssetResponse,
} from "@/features/stress-test/model/stressTestSchemas"

const MAX_CHART_ASSETS = 8
const LABEL_X = 14
const TRACK_X = 48
const TRACK_WIDTH = 105
const VALUE_X = 160
const ROW_HEIGHT = 9

function getTopAssets(
    assets: StressTestAssetResponse[],
    value: (asset: StressTestAssetResponse) => number,
) {
    return [...assets]
        .sort((a, b) => Math.abs(value(b)) - Math.abs(value(a)))
        .slice(0, MAX_CHART_ASSETS)
}

function findNegativeContribution(
    assets: StressTestAssetResponse[],
) {
    return assets
        .filter((asset) => asset.portfolioContribution < 0)
        .sort(
            (a, b) =>
                a.portfolioContribution - b.portfolioContribution,
        )[0]
}

function findPositiveContribution(
    assets: StressTestAssetResponse[],
) {
    return assets
        .filter((asset) => asset.portfolioContribution > 0)
        .sort(
            (a, b) =>
                b.portfolioContribution - a.portfolioContribution,
        )[0]
}

function findMostAffectedAsset(
    assets: StressTestAssetResponse[],
) {
    return getTopAssets(assets, (asset) => asset.impact)[0]
}

function drawChartTitle(
    pdf: jsPDF,
    title: string,
    y: number,
) {
    pdf.setFontSize(11)
    pdf.setTextColor(15, 45, 82)
    pdf.text(title, LABEL_X, y)
}

function drawAssetLabel(
    pdf: jsPDF,
    assetCode: string,
    value: string,
    y: number,
) {
    pdf.setFontSize(8)
    pdf.setTextColor(51, 65, 85)
    pdf.text(assetCode, LABEL_X, y + 4)

    pdf.setTextColor(71, 85, 105)
    pdf.text(value, VALUE_X, y + 4)
}

function drawTrack(
    pdf: jsPDF,
    y: number,
    width: number,
    color: [number, number, number],
) {
    pdf.setFillColor(241, 245, 249)
    pdf.rect(TRACK_X, y + 1, TRACK_WIDTH, 3, "F")

    if (width <= 0) return

    pdf.setFillColor(...color)
    pdf.rect(TRACK_X, y + 1, width, 3, "F")
}

function drawAllocationChart(
    pdf: jsPDF,
    assets: StressTestAssetResponse[],
    startY: number,
) {
    const visibleAssets = [...assets]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, MAX_CHART_ASSETS)

    if (visibleAssets.length === 0) return startY

    const maxWeight = Math.max(
        ...visibleAssets.map((asset) => asset.weight),
    )

    drawChartTitle(pdf, "Portfoy Dagilimi", startY)

    const chartTop = startY + 8

    visibleAssets.forEach((asset, index) => {
        const y = chartTop + index * ROW_HEIGHT

        const width =
            maxWeight === 0
                ? 0
                : (asset.weight / maxWeight) * TRACK_WIDTH

        drawAssetLabel(
            pdf,
            asset.assetCode,
            `${asset.weight.toFixed(2)}%`,
            y,
        )

        drawTrack(pdf, y, width, [15, 118, 110])
    })

    return chartTop + visibleAssets.length * ROW_HEIGHT + 4
}

function drawContributionChart(
    pdf: jsPDF,
    assets: StressTestAssetResponse[],
    startY: number,
) {
    const visibleAssets = getTopAssets(
        assets,
        (asset) => asset.portfolioContribution,
    )

    if (visibleAssets.length === 0) return startY

    const maxContribution = Math.max(
        ...visibleAssets.map((asset) =>
            Math.abs(asset.portfolioContribution),
        ),
    )

    drawChartTitle(pdf, "Portfoye Katki", startY)

    const chartTop = startY + 8
    const centerX = TRACK_X + TRACK_WIDTH / 2

    visibleAssets.forEach((asset, index) => {
        const y = chartTop + index * ROW_HEIGHT
        const contribution = asset.portfolioContribution

        const width =
            maxContribution === 0
                ? 0
                : (Math.abs(contribution) / maxContribution) *
                (TRACK_WIDTH / 2)

        drawAssetLabel(
            pdf,
            asset.assetCode,
            formatStressPercentage(contribution),
            y,
        )

        pdf.setFillColor(241, 245, 249)
        pdf.rect(TRACK_X, y + 1, TRACK_WIDTH, 3, "F")

        pdf.setDrawColor(148, 163, 184)
        pdf.line(centerX, y, centerX, y + 5)

        if (contribution < 0) {
            pdf.setFillColor(220, 107, 107)
            pdf.rect(
                centerX - width,
                y + 1,
                width,
                3,
                "F",
            )
        }

        if (contribution > 0) {
            pdf.setFillColor(53, 165, 141)
            pdf.rect(
                centerX,
                y + 1,
                width,
                3,
                "F",
            )
        }
    })

    return chartTop + visibleAssets.length * ROW_HEIGHT + 4
}

function drawImpactChart(
    pdf: jsPDF,
    assets: StressTestAssetResponse[],
    startY: number,
) {
    const visibleAssets = getTopAssets(
        assets,
        (asset) => asset.impact,
    )

    if (visibleAssets.length === 0) return startY

    const maxImpact = Math.max(
        ...visibleAssets.map((asset) => Math.abs(asset.impact)),
    )

    drawChartTitle(pdf, "Varlik Bazli Etki", startY)

    const chartTop = startY + 8

    visibleAssets.forEach((asset, index) => {
        const y = chartTop + index * ROW_HEIGHT

        const width =
            maxImpact === 0
                ? 0
                : (Math.abs(asset.impact) / maxImpact) * TRACK_WIDTH

        const color: [number, number, number] =
            asset.impact < 0
                ? [220, 107, 107]
                : asset.impact > 0
                    ? [53, 165, 141]
                    : [148, 163, 184]

        drawAssetLabel(
            pdf,
            asset.assetCode,
            formatStressPercentage(asset.impact),
            y,
        )

        drawTrack(pdf, y, width, color)
    })

    return chartTop + visibleAssets.length * ROW_HEIGHT + 4
}

function drawInsights(
    pdf: jsPDF,
    result: RunStressTestResponse,
) {
    const negativeContribution =
        findNegativeContribution(result.assets)

    const positiveContribution =
        findPositiveContribution(result.assets)

    const mostAffectedAsset =
        findMostAffectedAsset(result.assets)

    const insights = [
        {
            title: "En Buyuk Negatif Katki",
            asset: negativeContribution?.assetCode ?? "-",
            value: negativeContribution
                ? formatStressPercentage(
                    negativeContribution.portfolioContribution,
                )
                : "Negatif katki yok",
        },
        {
            title: "En Buyuk Pozitif Katki",
            asset: positiveContribution?.assetCode ?? "-",
            value: positiveContribution
                ? formatStressPercentage(
                    positiveContribution.portfolioContribution,
                )
                : "Pozitif katki yok",
        },
        {
            title: "En Cok Etkilenen Varlik",
            asset: mostAffectedAsset?.assetCode ?? "-",
            value: mostAffectedAsset
                ? formatStressPercentage(mostAffectedAsset.impact)
                : "-",
        },
    ]

    insights.forEach((insight, index) => {
        const x = 14 + index * 61

        pdf.setDrawColor(226, 232, 240)
        pdf.roundedRect(x, 70, 56, 29, 3, 3)

        pdf.setFontSize(7)
        pdf.setTextColor(100, 116, 139)
        pdf.text(insight.title, x + 4, 77)

        pdf.setFontSize(11)
        pdf.setTextColor(15, 45, 82)
        pdf.text(insight.asset, x + 4, 86)

        pdf.setFontSize(8)
        pdf.setTextColor(71, 85, 105)
        pdf.text(insight.value, x + 4, 93)
    })
}

export function downloadStressTestPdf(
    result: RunStressTestResponse,
) {
    const pdf = new jsPDF()

    pdf.setFontSize(18)
    pdf.setTextColor(15, 45, 82)
    pdf.text("Finovation - Stres Testi Raporu", 14, 18)

    pdf.setFontSize(11)
    pdf.setTextColor(51, 65, 85)

    pdf.text(
        `Senaryo: ${result.scenarioName}`,
        14,
        30,
    )

    pdf.text(
        `Veri Tarihi: ${formatStressDate(result.asOfDate)}`,
        14,
        37,
    )

    pdf.setFontSize(9)
    pdf.setTextColor(100, 116, 139)
    pdf.text("TOPLAM PORTFOY ETKISI", 14, 50)

    pdf.setFontSize(24)
    pdf.setTextColor(15, 45, 82)

    pdf.text(
        formatStressPercentage(result.portfolioImpact),
        14,
        60,
    )

    drawInsights(pdf, result)

    const allocationEndY = drawAllocationChart(
        pdf,
        result.assets,
        110,
    )

    drawContributionChart(
        pdf,
        result.assets,
        allocationEndY + 8,
    )

    pdf.addPage()

    const impactEndY = drawImpactChart(
        pdf,
        result.assets,
        20,
    )

    autoTable(pdf, {
        startY: impactEndY + 8,
        head: [
            [
                "Varlik",
                "Tur",
                "Agirlik",
                "Varlik Etkisi",
                "Portfoye Katki",
            ],
        ],
        body: result.assets.map((asset) => [
            asset.assetCode,
            asset.assetType,
            formatStressWeight(asset.weight),
            formatStressPercentage(asset.impact),
            formatStressPercentage(asset.portfolioContribution),
        ]),
        styles: {
            fontSize: 8,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [15, 45, 82],
        },
    })

    pdf.save(
        `stres-testi-${result.scenarioCode.toLowerCase()}.pdf`,
    )
}