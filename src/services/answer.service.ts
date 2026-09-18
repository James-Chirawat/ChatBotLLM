import { DEFAULT_BOT_PERSONA } from "@/config/bot-persona";
import type { AnswerProvider, AnswerResult } from "@/lib/ai/answer-provider";

export class AnswerService {
  constructor(
    private readonly provider: AnswerProvider,
    private readonly additionalInstructions: string,
  ) {}

  async createAnswer(input: { userText: string; imageDataUrl?: string }): Promise<AnswerResult> {
    const normalizedText = input.userText.trim().slice(0, 4_000);
    if (!normalizedText) return { text: "รบกวนพิมพ์คำถามเพิ่มอีกนิดนะคะ น้องมีนายินดีช่วยค่ะ", sources: [] };

    const systemPrompt = [DEFAULT_BOT_PERSONA, this.additionalInstructions].filter(Boolean).join("\n\nข้อมูลเพิ่มเติมขององค์กร:\n");
    return this.provider.answer({ systemPrompt, userText: normalizedText, imageDataUrl: input.imageDataUrl });
  }
}
