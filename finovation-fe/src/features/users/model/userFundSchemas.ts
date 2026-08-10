import { z } from "zod"

export const userFundListSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string().min(1),
    type: z.enum(["EQUITY_INTENSIVE"]),
    currency: z.string().length(3),
    inceptionDate: z.iso.date(),
  }),
)
