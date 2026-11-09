import FirecrawlApp from "@mendable/firecrawl-js";

let clientInstance: FirecrawlApp | null = null;

/**
 * Returns a singleton instance of FirecrawlApp.
 * Validates the presence of FIRECRAWL_API_KEY without exposing it.
 */
export function getFirecrawlClient(): FirecrawlApp {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "FIRECRAWL_API_KEY is not configured in the environment variables."
    );
  }

  clientInstance = new FirecrawlApp({ apiKey: apiKey.trim() });
  return clientInstance;
}
