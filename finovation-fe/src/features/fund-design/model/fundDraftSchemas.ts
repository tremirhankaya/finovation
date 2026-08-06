import { z } from "zod"

export const fundCurrencyOptionSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
})

export const fundDraftInitSchema = z.object({
  currencies: z.array(fundCurrencyOptionSchema).min(1),
  defaultCurrency: z.string().min(1),
  minInitialPortfolioSize: z.coerce.number().finite().positive(),
  maxInitialPortfolioSize: z.coerce.number().finite().positive(),
  minUnitPrice: z.coerce.number().finite().positive(),
  maxUnitPrice: z.coerce.number().finite().positive(),
  minLiquidityTargetPct: z.coerce.number().int(),
  maxLiquidityTargetPct: z.coerce.number().int(),
  minTppRangePct: z.coerce.number().int(),
  minStockCount: z.coerce.number().int(),
  maxStockCount: z.coerce.number().int(),
  minStockCountRange: z.coerce.number().int(),
  minSingleStockMaxPct: z.coerce.number().int(),
  maxSingleStockMaxPct: z.coerce.number().int(),
  minEquityWeightPct: z.coerce.number().int(),
  maxEquityWeightPct: z.coerce.number().int(),
  sectorMaxPct: z.coerce.number().finite().positive(),
})

export const createdFundDraftSchema = z.object({
  draftId: z.string().uuid(),
})

export type FundCurrencyOption = z.infer<typeof fundCurrencyOptionSchema>
export type FundDraftInit = z.infer<typeof fundDraftInitSchema>
export type CreatedFundDraft = z.infer<typeof createdFundDraftSchema>

export const FUND_TYPE_LABELS = {
  EQUITY_INTENSIVE: "Hisse Senedi Yoğun Fon",
} as const
