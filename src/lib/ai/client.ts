import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

let groqInstance: Groq | null = null;

/**
 * Returns a reusable singleton instance of Groq.
 * Throws a descriptive server-side error if GROQ_API_KEY is not defined.
 */
export function getGroqClient(): Groq {
  if (groqInstance) {
    return groqInstance;
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "GROQ_API_KEY is missing from environment variables. Please check your .env.local file."
    );
  }

  groqInstance = new Groq({ apiKey: apiKey.trim() });
  return groqInstance;
}
