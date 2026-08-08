import type {
  FundModelAsset,
  FundModelProposal,
} from "@/features/fund-design/api/fundDraftApi"

export type HoldingSlice = {
  code: string
  weightPct: number
  note?: string | null
}

export type ProposalSummary = {
  rank: number
  label: string
  title: string
  equityPct: number
  tppPct: number
  stockCount: number
  chartSlices: HoldingSlice[]
  allHoldings: HoldingSlice[]
}

export function isTppAssetCode(code: string): boolean {
  const normalized = code.toUpperCase()
  return normalized === "TPP" || normalized.startsWith("TPP")
}

function isTpp(asset: FundModelAsset): boolean {
  return isTppAssetCode(asset.asset_code)
}

function toPct(weight: number): number {
  return Math.round(weight * 10) / 10
}

export function summarizeProposal(proposal: FundModelProposal): ProposalSummary {
  const equities = proposal.assets.filter((asset) => !isTpp(asset))
  const tpp = proposal.assets.find((asset) => isTpp(asset))

  const equityPct = toPct(
    equities.reduce((sum, asset) => sum + asset.weight, 0),
  )
  const tppPct = tpp
    ? toPct(tpp.weight)
    : Math.max(0, Math.round((100 - equityPct) * 10) / 10)

  const sorted = [...equities].sort((a, b) => b.weight - a.weight)

  const tppSlice: HoldingSlice = {
    code: "TPP",
    weightPct: tppPct,
    note: tpp?.ai_note ?? "Likidite",
  }

  const equitySlices: HoldingSlice[] = sorted.map((asset) => ({
    code: asset.asset_code,
    weightPct: toPct(asset.weight),
    note: asset.ai_note,
  }))

  const top = equitySlices.slice(0, 5)
  const otherEquityPct = toPct(
    sorted.slice(5).reduce((sum, asset) => sum + asset.weight, 0),
  )

  const chartSlices: HoldingSlice[] = [...top]
  if (otherEquityPct > 0) {
    chartSlices.push({
      code: "Diğer",
      weightPct: otherEquityPct,
      note: "İlk 5 dışındaki hisseler",
    })
  }
  if (tppPct > 0) {
    chartSlices.push(tppSlice)
  }

  const allHoldings: HoldingSlice[] = [
    ...equitySlices,
    ...(tppPct > 0 ? [tppSlice] : []),
  ]

  return {
    rank: proposal.rank,
    label: proposal.label,
    title: proposal.rank === 1 ? "AI Birincil Önerisi" : "Alternatif Portföy",
    equityPct,
    tppPct,
    stockCount: equities.length,
    chartSlices,
    allHoldings,
  }
}
