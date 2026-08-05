import { z } from "zod"

export const fundDraftLimitsSchema = z.object({
  minInitialPortfolioSize: z.coerce.number().finite().positive(),
  maxInitialPortfolioSize: z.coerce.number().finite().positive(),
})

export const createdFundDraftSchema = z.object({
  draftId: z.string().uuid(),
})

export type FundDraftLimits = z.infer<typeof fundDraftLimitsSchema>
export type CreatedFundDraft = z.infer<typeof createdFundDraftSchema>

export const FUND_TYPE_LABELS = {
  EQUITY_INTENSIVE: "Hisse Senedi Yoğun Fon",
} as const
