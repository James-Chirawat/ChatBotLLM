import type { AnswerProvider, AnswerResult, AnswerSource } from "@/lib/ai/answer-provider";

type QwenResponse = {
  status?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; title?: string; url?: string }>;
    }>;
  }>;
  error?: { message?: string };
};

export class QwenAnswerProvider implements AnswerProvider {
  constructor(
    private readonly config: { apiKey: string; model: string; baseUrl: string; webSearchEnabled: boolean },
  ) {}

  async answer({ systemPrompt, userText, imageDataUrl }: { systemPrompt: string; userText: string; imageDataUrl?: string }): Promise<AnswerResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);

    try {
      const userContent = [
        { type: "input_text", text: userText },
        ...(imageDataUrl ? [{ type: "input_image", image_url: imageDataUrl }] : []),
      ];
      const response = await fetch(`${this.config.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          input: [
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            { role: "user", content: userContent },
          ],
          ...(this.config.webSearchEnabled ? { tools: [{ type: "web_search" }, { type: "web_extractor" }] } : {}),
          // Qwen3.8 defaults to xhigh reasoning. Low keeps the LINE reply fast
          // and leaves enough of max_output_tokens for the user-visible answer.
          reasoning: { effort: "low" },
          max_output_tokens: 1_600,
        }),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });

      const body = (await response.json().catch(() => ({}))) as QwenResponse;
      if (!response.ok) throw new Error(`Qwen request failed (${response.status}): ${body.error?.message ?? "unknown error"}`);

      const answer = body.output_text?.trim() || body.output
        ?.filter((item) => item.type === "message" || item.role === "assistant")
        .flatMap((item) => item.content ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!answer) {
        const outputTypes = body.output?.map((item) => item.type ?? "unknown").join(",") || "none";
        throw new Error(`Qwen returned no text answer (status=${body.status ?? "unknown"}, output=${outputTypes})`);
      }
      return { text: answer, sources: extractSources(body) };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractSources(response: QwenResponse): AnswerSource[] {
  const sources = response.output
    ?.flatMap((item) => item.content ?? [])
    .flatMap((part) => part.annotations ?? [])
    .filter((annotation) => annotation.type === "url_citation" && isSafeHttpUrl(annotation.url))
    .map((annotation) => ({ title: annotation.title?.trim() || "แหล่งข้อมูล", url: annotation.url as string })) ?? [];

  return Array.from(new Map(sources.map((source) => [source.url, source])).values()).slice(0, 3);
}

function isSafeHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
