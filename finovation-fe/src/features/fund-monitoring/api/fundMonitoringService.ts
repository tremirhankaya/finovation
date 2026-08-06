import { getFundMonitoringUrl, getFundsUrl } from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"
import type {
  FundMonitoringSnapshot,
  FundOption,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import {
  fundMonitoringResponseSchema,
  fundSummaryListResponseSchema,
  type FundMonitoringResponse,
  type FundSummaryResponse,
} from "@/features/fund-monitoring/model/fundMonitoringSchemas"

const FUND_TYPE_LABELS: Record<FundSummaryResponse["type"], string> = {
  EQUITY_INTENSIVE: "Hisse Senedi Yoğun Fon",
}

function toFundOption(response: FundSummaryResponse): FundOption {
  return {
    id: response.id,
    name: response.name,
    type: FUND_TYPE_LABELS[response.type],
  }
}

function toSnapshot(response: FundMonitoringResponse): FundMonitoringSnapshot {
  return {
    fund: toFundOption(response.fund),
    asOfDate: response.asOfDate,
    currency: response.currency,
    currentSharePrice: response.currentSharePrice,
    dailyChangePercentage: response.dailyChangePercentage,
    priceHistory: response.priceHistory,
    technicalIndicators: response.technicalIndicators,
    periodReturns: response.periodReturns,
    positions: response.positions,
    sectorAllocations: response.sectorAllocations,
  }
}

export async function fetchFunds(signal?: AbortSignal): Promise<FundOption[]> {
  const response = await apiFetch(
    getFundsUrl(),
    {
      errorMessage: "Fonlar yüklenemedi",
      signal,
    },
    (body) => fundSummaryListResponseSchema.parse(body),
  )

  return response.map(toFundOption)
}

export async function fetchFundMonitoring(
  fundId: string,
  signal?: AbortSignal,
): Promise<FundMonitoringSnapshot> {
  const response = await apiFetch(
    getFundMonitoringUrl(fundId),
    {
      errorMessage: "Fon izleme verileri yüklenemedi",
      signal,
    },
    (body) => fundMonitoringResponseSchema.parse(body),
  )

  return toSnapshot(response)
}
