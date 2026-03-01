/**
 * Image generation using OpenAI DALL-E API
 * Uses direct OpenAI API calls for image generation
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";
import { getApiKeyAsync } from "./llm";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiKey = await getApiKeyAsync();

  const baseUrl = (ENV.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = ENV.openaiImageModel || "dall-e-3";

  console.log(`[ImageGen] Generating image with model ${model}`);

  // Use OpenAI Images API
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };

  if (!result.data || result.data.length === 0) {
    throw new Error("Image generation returned no results");
  }

  const imageData = result.data[0];

  if (imageData.b64_json) {
    const buffer = Buffer.from(imageData.b64_json, "base64");
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      buffer,
      "image/png"
    );
    return { url };
  }

  // If URL was returned instead of base64
  if (imageData.url) {
    try {
      const imgResponse = await fetch(imageData.url);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      const { url } = await storagePut(
        `generated/${Date.now()}.png`,
        buffer,
        "image/png"
      );
      return { url };
    } catch {
      return { url: imageData.url };
    }
  }

  throw new Error("Image generation returned unexpected format");
}
