import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as dotenv from "dotenv";
import * as schema from "./schema";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Fail with a descriptive message on server execution if DATABASE_URL is not set
  if (process.env.NODE_ENV === "production" && !process.env.CI) {
    throw new Error(
      "DATABASE_URL environment variable is missing. Please define it in your environment."
    );
  }
}

// Serverless HTTP client connection via Neon driver
const sql = neon(connectionString || "");

export const db = drizzle(sql, { schema });

export * from "./schema";
