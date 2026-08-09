import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"

export type SuggestedConstraints = {
  tppMinWeight: number
  tppMaxWeight: number
  preferredTppWeight: number
  stockCountMin: number
  stockCountMax: number
}

const RISK_PROFILE_SUGGESTED_CONSTRAINTS: Record<RiskProfile, SuggestedConstraints> = {
  AGGRESSIVE: {
    tppMinWeight: 5,
    tppMaxWeight: 10,
    preferredTppWeight: 7,
    stockCountMin: 25,
    stockCountMax: 30,
  },
  BALANCED: {
    tppMinWeight: 8,
    tppMaxWeight: 12,
    preferredTppWeight: 10,
    stockCountMin: 21,
    stockCountMax: 26,
  },
  CONSERVATIVE: {
    tppMinWeight: 10,
    tppMaxWeight: 15,
    preferredTppWeight: 12,
    stockCountMin: 16,
    stockCountMax: 21,
  },
}

export function getSuggestedConstraints(
  riskProfile: RiskProfile,
): SuggestedConstraints {
  return RISK_PROFILE_SUGGESTED_CONSTRAINTS[riskProfile]
}
