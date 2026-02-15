import { GoogleGenAI, GenerateContentResponse, GenerateContentConfig } from "@google/genai";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

export class GeminiClient {
  private static instance: GeminiClient;
  private apiKeys: string[];

  private constructor() {
    // Collect all potential keys
    // Prioritize GOOGLE_API_KEY if available, then GEMINI_API_KEY
    const keys = [
      process.env.GOOGLE_API_KEY,
      process.env.GEMINI_API_KEY,
    ].filter(Boolean) as string[];
    
    // Deduplicate keys
    this.apiKeys = [...new Set(keys.map(k => k.trim()))].filter(k => k.length > 0);
    
    if (this.apiKeys.length === 0) {
      console.warn("[GeminiClient] Missing API keys");
    }
  }

  public static getInstance(): GeminiClient {
    if (!GeminiClient.instance) {
      GeminiClient.instance = new GeminiClient();
    }
    return GeminiClient.instance;
  }

  // Helper to get client for a specific key
  private getClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({ apiKey });
  }

  public async generateContent(
    model: string,
    contents: string,
    config?: GenerateContentConfig
  ): Promise<GenerateContentResponse> {
    if (this.apiKeys.length === 0) {
      throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY");
    }

    let lastError: unknown;

    // Try each key in order
    for (const apiKey of this.apiKeys) {
      const client = this.getClient(apiKey);
      
      let attempt = 0;
      // Retry loop for a single key
      while (attempt < MAX_RETRIES) {
        try {
          const result = await client.models.generateContent({
            model,
            contents,
            config,
          });
          return result as GenerateContentResponse;
        } catch (error: unknown) {
          attempt++;
          const message = error instanceof Error ? error.message : String(error);
          const isOverloaded = message.includes("503") || message.includes("overloaded") || message.includes("UNAVAILABLE");
          const isQuota = message.includes("quota exceeded") || message.includes("RESOURCE_EXHAUSTED");
          const isFetchError = message.includes("fetch failed") || message.includes("network");
          
          const keyHint = apiKey.substring(0, 8) + "...";
          console.warn(`[GeminiClient] Key ${keyHint} Attempt ${attempt} failed: ${message}`);

          // If quota exceeded, break retry loop and try next key immediately
          if (isQuota) {
            lastError = error;
            break; // Break inner loop to try next key
          }

          // If other error (like invalid arg), throw immediately? 
          // But "API key not valid" would be a reason to try next key.
          if (message.includes("API key not valid") || message.includes("permission denied")) {
             lastError = error;
             break; // Try next key
          }

          if ((isOverloaded || isFetchError) && attempt < MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          
          // For other errors, we might want to try next key too?
          // E.g. "User location not allowed" (not relevant here), or "Bad Request".
          // Assuming if it fails after retries (or immediately if not retryable), we move to next key.
          lastError = error;
          break; // Try next key
        }
      }
    }
    
    // If we get here, all keys failed
    throw lastError || new Error("[GeminiClient] All API keys failed");
  }

  public async *streamContent(
    model: string,
    contents: string,
    config?: GenerateContentConfig
  ): AsyncGenerator<string, void, unknown> {
    if (this.apiKeys.length === 0) {
      throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY");
    }

    let lastError: unknown;

    for (const apiKey of this.apiKeys) {
      const client = this.getClient(apiKey);
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {
          const result = await (client.models as any).generateContentStream({
            model,
            contents,
            config,
          });

          const stream =
            (result as any)?.stream && typeof (result as any).stream[Symbol.asyncIterator] === "function"
              ? (result as any).stream
              : result;

          if (!stream || typeof (stream as any)[Symbol.asyncIterator] !== "function") {
            throw new Error("stream_unavailable");
          }

          for await (const chunk of stream as AsyncIterable<any>) {
            const text =
              typeof chunk?.text === "string"
                ? chunk.text
                : Array.isArray(chunk?.candidates)
                ? chunk.candidates
                    .map((c: any) =>
                      Array.isArray(c?.content?.parts)
                        ? c.content.parts.map((p: any) => p?.text || "").join("")
                        : ""
                    )
                    .join("")
                : "";
            if (text) {
              yield text;
            }
          }
          return;
        } catch (error: unknown) {
          attempt++;
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          const isOverloaded = message.includes("503") || message.includes("overloaded") || message.includes("UNAVAILABLE");
          const isQuota = message.includes("quota exceeded") || message.includes("RESOURCE_EXHAUSTED");
          const isFetchError = message.includes("fetch failed") || message.includes("network");

          if (isQuota) {
            break;
          }

          if (message.includes("API key not valid") || message.includes("permission denied")) {
            break;
          }

          if ((isOverloaded || isFetchError) && attempt < MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          break;
        }
      }
    }

    throw lastError || new Error("[GeminiClient] All API keys failed");
  }
}
