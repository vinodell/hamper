import { existsSync } from "node:fs";
import { SqliteDatabase } from "./database.js";
import { createApplication } from "./http.js";
import { applicationPaths } from "./paths.js";
import { startTelegramDelivery } from "./telegram.js";
import type { Env } from "./types.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(
      `${name} is required. Configure .env.server before starting.`,
    );
  return value;
}

export function startServer() {
  // Passenger can launch from another directory. Hosting environment wins.
  const configurationPath = new URL("../../.env.server", import.meta.url);
  if (existsSync(configurationPath)) process.loadEnvFile(configurationPath);
  const { publicDir, databasePath } = applicationPaths(import.meta.url);
  const adminLogin = required("ADMIN_LOGIN");
  const passwordHash = required("ADMIN_PASSWORD_HASH");
  const sessionSecret = required("SESSION_SECRET");
  if (sessionSecret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  const publicOrigin = required("PUBLIC_ORIGIN");
  const parsedOrigin = new URL(publicOrigin);
  if (
    !/^https?:$/.test(parsedOrigin.protocol) ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search ||
    parsedOrigin.hash
  ) {
    throw new Error(
      "PUBLIC_ORIGIN must be an HTTP(S) origin without a path, query, or credentials",
    );
  }
  const port = Number(process.env.PORT || "8787");
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("PORT must be a valid TCP port");
  const DB = new SqliteDatabase(databasePath);
  const env: Env = {
    DB,
    ADMIN_LOGIN: adminLogin,
    ADMIN_PASSWORD_HASH: passwordHash,
    SESSION_SECRET: sessionSecret,
    PUBLIC_ORIGIN: parsedOrigin.origin,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  };
  let server: ReturnType<typeof createApplication>;
  try {
    server = createApplication({ env, publicDir });
  } catch (error) {
    DB.close();
    throw error;
  }
  const delivery = startTelegramDelivery(env);
  let disposal: Promise<void> | undefined;
  const dispose = () => {
    disposal ??= delivery.stop().finally(() => DB.close());
    return disposal;
  };
  server.once("close", dispose);
  const fatal = (error: unknown) => {
    console.error("Unable to start HTTP server", error);
    void dispose().finally(() => process.exit(1));
  };
  server.on("error", fatal);
  try {
    server.listen(port, process.env.HOST || "127.0.0.1", () => {
      const address = server.address();
      console.info(
        `Hamper server listening on ${typeof address === "string" ? address : address?.port}; public origin: ${parsedOrigin.origin}`,
      );
    });
  } catch (error) {
    fatal(error);
  }
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close();
    setTimeout(() => {
      server.closeAllConnections();
    }, 10_000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
}
