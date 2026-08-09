import {
  getManagementApproach,
  type ManagementApproachCode,
} from "@/features/fund-design/model/managementApproach"
import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"

const RISK_PROFILE_APPROACH_CODES: Record<RiskProfile, ManagementApproachCode> = {
  AGGRESSIVE: "ATTACK",
  BALANCED: "BALANCED",
  CONSERVATIVE: "PROTECTIVE",
}

export type SuggestedConstraints = {
  tppMinWeight: number
  tppMaxWeight: number
  preferredTppWeight: number
  stockCountMin: number
  stockCountMax: number
}

export function getSuggestedConstraints(
  riskProfile: RiskProfile,
): SuggestedConstraints {
  const approach = getManagementApproach(
    RISK_PROFILE_APPROACH_CODES[riskProfile],
  )

  return {
    tppMinWeight: approach.defaultLiquidityMinPct,
    tppMaxWeight: approach.defaultLiquidityMaxPct,
    preferredTppWeight: approach.defaultPreferredLiquidityPct,
    stockCountMin: approach.defaultMinStockCount,
    stockCountMax: approach.defaultMaxStockCount,
  }
}
