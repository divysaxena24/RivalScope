import { getGroqClient } from "../lib/ai/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const client = getGroqClient();
  const models = await client.models.list();
  console.log("Available models:");
  for (const m of models.data) {
    console.log(`- ${m.id}`);
  }
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
