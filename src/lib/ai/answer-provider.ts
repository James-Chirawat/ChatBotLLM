export type AnswerSource = {
  title: string;
  url: string;
};

export type AnswerResult = {
  text: string;
  sources: AnswerSource[];
};

export interface AnswerProvider {
  answer(input: { systemPrompt: string; userText: string; imageDataUrl?: string }): Promise<AnswerResult>;
}
