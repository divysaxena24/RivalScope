import { z } from "zod";

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export const PricingTrendsQuerySchema = z.object({
  competitorId: z.string().optional(),
  pricingPlanId: z.string().optional(),
  currency: z
    .string()
    .transform((val) => val.toUpperCase())
    .refine((val) => (SUPPORTED_CURRENCIES as readonly string[]).includes(val) || val === "ALL", {
      message: "Unsupported currency. Supported currencies are USD, EUR, GBP, and INR.",
    })
    .default("USD"),
  billingPeriod: z.enum(["monthly", "yearly", "annual", "custom", "all"]).default("monthly"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
