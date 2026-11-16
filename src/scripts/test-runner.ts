import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../lib/db";
import { competitors, pricingPlans } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const allComps = await db
    .select({
      id: competitors.id,
      name: competitors.name,
      domain: competitors.domain,
    })
    .from(competitors);

  console.log("Competitors Count:", allComps.length);
  for (const c of allComps) {
    const plans = await db
      .select({
        id: pricingPlans.id,
        planName: pricingPlans.planName,
        price: pricingPlans.price,
        currency: pricingPlans.currency,
        billingPeriod: pricingPlans.billingPeriod,
        isCustomPricing: pricingPlans.isCustomPricing,
      })
      .from(pricingPlans)
      .where(eq(pricingPlans.competitorId, c.id));
    console.log(`- ${c.name} (${c.domain}) [ID: ${c.id}] -> ${plans.length} plans`);
    for (const p of plans) {
      console.log(`    * ${p.planName}: ${p.currency} ${p.price} / ${p.billingPeriod} (Custom: ${p.isCustomPricing})`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
