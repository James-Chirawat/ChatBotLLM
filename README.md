# LINE + Qwen Secretary Bot

Starter project สำหรับสอนและนำไปต่อยอด: รับข้อความจาก LINE Official Account, ตรวจสอบลายเซ็น webhook, ส่งคำถามไป Qwen และตอบกลับในบุคลิกเลขานุการผู้หญิงที่สุภาพ

## Architecture

```text
LINE webhook
  -> app/api/webhooks/line/route.ts       verify raw-body HMAC signature
  -> services/line-webhook.service.ts     choose supported events + reply flow
      -> lib/line/client.ts                ephemeral token, loading, and image download
      -> services/answer.service.ts        persona and organization instructions
          -> lib/ai/qwen-answer-provider.ts Qwen Responses API + image + web search
```

The app is deliberately **stateless**. It sends only the current text message to Qwen; it does not save chat history, user IDs, or LINE profiles. That keeps the first lesson small and privacy-friendly. Add a repository and database only when you need a deliberate conversation-memory feature.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill these server-only variables in `.env.local`:

- `LINE_CHANNEL_ID` and `LINE_CHANNEL_SECRET` from the Messaging API channel.
- `QWEN_API_KEY` from Alibaba Cloud Model Studio / DashScope.
- `QWEN_MODEL` defaults to `qwen3.8-flash`.
- `QWEN_BASE_URL` defaults to the Singapore OpenAI-compatible endpoint. Use the endpoint belonging to the same region/workspace as the key if yours differs.
- `QWEN_ENABLE_WEB_SEARCH` defaults to `true`. Set it to `false` when you need lower latency/cost or want answers based only on the model and your instructions.
- `BOT_INSTRUCTIONS` is an optional place for organisation facts, hours, contacts, or boundaries.

Never commit `.env.local`, and never expose these values through `NEXT_PUBLIC_*` variables. The application does not store a channel access token. Immediately before each reply, it exchanges the Channel ID and Channel secret for a new LINE **stateless channel access token**.

## Connect LINE

1. Deploy the app to a public HTTPS URL (or use a tunnel while developing).
2. In LINE Developers Console → Messaging API, set the webhook URL to `https://your-domain.com/api/webhooks/line`.
3. Enable **Use webhook**, then press **Verify**.
4. Turn off LINE Official Account Manager auto-replies if they conflict with the bot.
5. Add the Official Account as a friend and send a text message.

The route reads the raw request before parsing JSON and checks `x-line-signature` using HMAC-SHA256. Invalid requests are rejected before any model or LINE API call.

When a user sends a text message in a one-to-one chat, the bot starts LINE's native loading animation before calling Qwen. It is set for 60 seconds but disappears as soon as the bot reply arrives. LINE doesn't support this animation in group or multi-person chats, so those conversations continue without it.

## Images and current information

- Send a JPEG, PNG, GIF, or WebP image in LINE and the bot downloads it with a temporary LINE token, keeps it only in request memory, and sends it to Qwen as a Base64 image input. Images larger than 5 MB are rejected before reaching Qwen.
- Qwen is called through its Responses API with `web_search` and `web_extractor` tools enabled. The model decides when a current-information search is useful; it does not search for every ordinary message.
- Qwen3.8 runs at `low` reasoning effort in this bot. Its default `xhigh` reasoning can consume the full response budget before a short LINE answer is produced.
- When a search returns URL citations, the bot adds up to three source links after its answer. Citations are absent when no search was used.
- An image sent separately from a text prompt is interpreted as “describe/read this image.” This starter remains stateless, so it does not join an image and a later message into a single turn.

## Customise the assistant

- Edit `src/config/bot-persona.ts` for voice, safety limits, or target language.
- Set `BOT_INSTRUCTIONS` for changeable organisation data without a deployment code change.
- Keep external integrations behind the `AnswerProvider` interface. Add another provider beside `QwenAnswerProvider` rather than putting provider code in the webhook route.
- For chat memory, add `ConversationRepository` and pass only a short, privacy-reviewed recent history to `AnswerService`.

## Verification

```bash
npm run test
npm run typecheck
npm run build
```

## Production notes

- A reply token is short-lived and can be used once. Keep model timeout low and avoid automatic retries on the same reply token.
- Stateless channel access tokens last 15 minutes and cannot be revoked. This project deliberately does not cache them, but the Channel secret remains highly sensitive and must be rotated if compromised.
- For higher traffic, acknowledge valid webhooks quickly and send events to a queue; persist event IDs to deduplicate webhook redelivery.
- Add rate limiting before a public launch. Use a database/Redis-backed limiter when deploying more than one server instance.
- Treat all user text as untrusted. Do not place secrets, private records, or privileged tool instructions into the prompt.
- Images are transient input, but they are still transmitted to Qwen for analysis. Tell users not to send private IDs, medical records, or other sensitive images unless your privacy policy explicitly covers this use.

## Sources

- [LINE: verify webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
- [LINE: receive webhook events](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
- [LINE: send reply messages](https://developers.line.biz/en/docs/messaging-api/sending-messages/)
- [LINE: get user-sent image content](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
- [LINE: issue stateless channel access token](https://developers.line.biz/en/reference/messaging-api/#issue-stateless-channel-access-token)
- [Qwen: Responses API](https://help.aliyun.com/en/model-studio/qwen-api-via-openai-responses)
- [Qwen: web search](https://help.aliyun.com/en/model-studio/web-search)
