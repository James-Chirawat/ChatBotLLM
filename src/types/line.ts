export type LineWebhookPayload = {
  events: LineWebhookEvent[];
};

export type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    type: "user" | "group" | "room" | string;
    userId?: string;
  };
  message?: {
    id?: string;
    type: string;
    text?: string;
  };
};
