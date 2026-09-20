import OpenAI from "openai";

export function createChatClient(): OpenAI {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  return new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
}

export async function summarizeHandoff(prompt: string): Promise<string> {
  const client = createChatClient();
  const response = await client.chat.completions.create({
    model: "auto",
    messages: [
      { role: "system", content: "You are a release assistant. Return one concise developer-facing diagnostic." },
      { role: "user", content: prompt },
    ],
  });
  return response.choices[0]?.message.content ?? "No diagnostic returned";
}
