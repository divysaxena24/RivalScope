import { z } from "zod";

export const addCompetitorSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  website: z.string().url("Please enter a valid website URL (e.g. https://example.com)"),
  category: z.string().min(2, "Category is required"),
  notes: z.string().optional(),
});

export type AddCompetitorFormData = z.infer<typeof addCompetitorSchema>;
