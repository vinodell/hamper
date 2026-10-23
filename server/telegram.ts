import type { Env, InquiryRow } from "./types.js";

interface DeliveryOptions {
  fetch?: typeof fetch;
  now?: () => number;
  intervalMs?: number;
  timeoutMs?: number;
}

class DeliveryFailure extends Error {
  constructor(readonly retryAfterMs = 0) {
    super("Telegram delivery failed");
  }
}

function inquiryText(inquiry: InquiryRow) {
  return [
    `Новая заявка #${inquiry.id}`,
    `Имя: ${inquiry.name}`,
    `Телефон: ${inquiry.phone}`,
    inquiry.project && `Проект: ${inquiry.project}`,
    inquiry.plot && `Участок: ${inquiry.plot}`,
    inquiry.comment && `Комментарий: ${inquiry.comment}`,
    "Согласие на обработку персональных данных получено.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Delivery runs independently of the contact response; SQLite is the durable queue. */
export function startTelegramDelivery(env: Env, options: DeliveryOptions = {}) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return { stop: async () => undefined };
  const send = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  let stopped = false;
  let active: Promise<void> | undefined;
  let activeRequest: AbortController | undefined;

  const deliver = async (inquiry: InquiryRow) => {
    const controller = new AbortController();
    activeRequest = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new DeliveryFailure());
      }, options.timeoutMs ?? 8_000);
      timer.unref();
    });
    try {
      await Promise.race([
        (async () => {
          const response = await send(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
              method: "POST",
              redirect: "error",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: inquiryText(inquiry),
              }),
            },
          );
          const result = (await response.json()) as {
            ok?: boolean;
            parameters?: { retry_after?: unknown };
          } | null;
          if (!response.ok || result?.ok !== true) {
            const retryAfter = result?.parameters?.retry_after;
            throw new DeliveryFailure(
              typeof retryAfter === "number" &&
                Number.isFinite(retryAfter) &&
                retryAfter > 0
                ? retryAfter * 1000
                : 0,
            );
          }
        })(),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
      activeRequest = undefined;
    }
  };

  const drain = async () => {
    for (let count = 0; !stopped && count < 10; count++) {
      const time = now();
      await env.DB.prepare(
        "UPDATE inquiry_telegram_outbox SET status = 'failed', leased_until = NULL WHERE status = 'pending' AND attempts >= 8 AND (leased_until IS NULL OR leased_until <= ?)",
      )
        .bind(time)
        .first();
      const job = await env.DB.prepare(
        "UPDATE inquiry_telegram_outbox SET leased_until = ?, attempts = attempts + 1 WHERE inquiry_id = (SELECT inquiry_id FROM inquiry_telegram_outbox WHERE status = 'pending' AND attempts < 8 AND next_attempt_at <= ? AND (leased_until IS NULL OR leased_until <= ?) AND (SELECT paused_until FROM telegram_delivery_state WHERE id = 1) <= ? ORDER BY inquiry_id LIMIT 1) RETURNING inquiry_id, attempts",
      )
        .bind(time + 30_000, time, time, time)
        .first<{ inquiry_id: number; attempts: number }>();
      if (!job) return;
      const inquiry = await env.DB.prepare(
        "SELECT * FROM inquiries WHERE id = ?",
      )
        .bind(job.inquiry_id)
        .first<InquiryRow>();
      if (!inquiry) continue;
      try {
        await deliver(inquiry);
        await env.DB.prepare(
          "UPDATE inquiry_telegram_outbox SET status = 'sent', leased_until = NULL, sent_at = ? WHERE inquiry_id = ? AND attempts = ? AND leased_until = ?",
        )
          .bind(
            new Date(now()).toISOString(),
            job.inquiry_id,
            job.attempts,
            time + 30_000,
          )
          .first();
      } catch (error) {
        const backoff = Math.min(30_000 * 2 ** (job.attempts - 1), 3_600_000);
        const retryAfter =
          error instanceof DeliveryFailure ? error.retryAfterMs : 0;
        const completedAt = now();
        const updates = [
          env.DB.prepare(
            "UPDATE inquiry_telegram_outbox SET status = ?, next_attempt_at = ?, leased_until = NULL WHERE inquiry_id = ? AND attempts = ? AND leased_until = ?",
          ).bind(
            job.attempts >= 8 ? "failed" : "pending",
            completedAt + Math.max(backoff, retryAfter),
            job.inquiry_id,
            job.attempts,
            time + 30_000,
          ),
        ];
        // A flood-control response applies to this bot/chat, including newer
        // inquiries and other Passenger processes. Persist it with the retry.
        if (retryAfter > 0)
          updates.push(
            env.DB.prepare(
              "UPDATE telegram_delivery_state SET paused_until = MAX(paused_until, ?) WHERE id = 1",
            ).bind(completedAt + retryAfter),
          );
        await env.DB.batch(updates);
      }
    }
  };
  const tick = () => {
    if (active || stopped) return;
    active = drain()
      .catch(() => console.error("Telegram delivery could not be completed"))
      .finally(() => {
        active = undefined;
      });
  };
  const timer = setInterval(tick, options.intervalMs ?? 15_000);
  timer.unref();
  tick();
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      activeRequest?.abort();
      await active;
    },
  };
}
