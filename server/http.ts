import { createReadStream, realpathSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import api from "./api.js";
import {
  BULK_REQUEST_BODY_MAX_BYTES,
  REQUEST_BODY_MAX_BYTES,
} from "./constants.js";
import type { Env } from "./types.js";

export interface ApplicationOptions {
  env: Env;
  publicDir: string;
  publicOrigin?: string;
  logger?: Pick<Console, "error">;
}

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const privateExtensions =
  /\.(?:sqlite(?:3)?|db|sql|env|log|pem|key|map)(?:-(?:wal|shm))?$/i;

function json(response: ServerResponse, status: number, message: string) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({ error: message }));
}

function securityHeaders(response: ServerResponse) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
}

function safePublicPath(rawPath: string): string | null {
  try {
    const decoded = decodeURIComponent(rawPath);
    if (
      !decoded.startsWith("/") ||
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      decoded.split("/").some((segment) => segment.startsWith(".")) ||
      privateExtensions.test(decoded)
    )
      return null;
    return decoded;
  } catch {
    return null;
  }
}

function inside(directory: string, filename: string) {
  const relative = path.relative(directory, filename);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function publicFile(directory: string, pathname: string) {
  const filename = path.resolve(directory, `.${pathname}`);
  if (!inside(directory, filename)) return null;
  try {
    const canonical = await realpath(filename);
    if (
      !inside(directory, canonical) ||
      safePublicPath(
        `/${path.relative(directory, canonical).split(path.sep).join("/")}`,
      ) === null
    )
      return null;
    const details = await stat(canonical);
    return details.isFile() ? { filename: canonical, details } : null;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      ["ENOENT", "ENOTDIR"].includes(String(error.code))
    )
      return null;
    throw error;
  }
}

async function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  directory: string,
  pathname: string,
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    json(response, 405, "Метод не поддерживается");
    return;
  }
  let file = await publicFile(
    directory,
    pathname === "/" ? "/index.html" : pathname,
  );
  const navigation =
    request.method === "GET" &&
    request.headers.accept?.includes("text/html") &&
    !path.extname(pathname);
  if (!file && navigation) file = await publicFile(directory, "/index.html");
  if (!file) {
    json(response, 404, "Не найдено");
    return;
  }
  const extension = path.extname(file.filename).toLowerCase();
  const contentType = mimeTypes[extension] ?? "application/octet-stream";
  const html = extension === ".html";
  const hashedAsset =
    pathname.startsWith("/assets/") && /[-.][\w-]{8,}\.[\w]+$/.test(pathname);
  const etag = `W/"${file.details.size.toString(16)}-${Math.trunc(file.details.mtimeMs).toString(16)}"`;
  response.setHeader("Content-Type", contentType);
  response.setHeader(
    "Cache-Control",
    html
      ? "no-cache"
      : hashedAsset
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600",
  );
  response.setHeader("ETag", etag);
  response.setHeader("Last-Modified", file.details.mtime.toUTCString());
  const compressible =
    /^(?:text\/|application\/(?:json|xml|manifest\+json)|image\/svg\+xml)/.test(
      contentType,
    );
  if (compressible) response.setHeader("Vary", "Accept-Encoding");
  const validators = request.headers["if-none-match"]?.split(/\s*,\s*/);
  if (
    validators?.includes("*") ||
    validators?.some(
      (value) => value.replace(/^W\//, "") === etag.replace(/^W\//, ""),
    )
  ) {
    response.writeHead(304);
    response.end();
    return;
  }
  const gzip =
    compressible &&
    file.details.size >= 1024 &&
    /(?:^|,)\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?(?:\s|,|$))[\d.]+)?\s*(?:,|$)/i.test(
      request.headers["accept-encoding"] ?? "",
    );
  if (gzip) response.setHeader("Content-Encoding", "gzip");
  else response.setHeader("Content-Length", file.details.size);
  response.writeHead(200);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(file.filename);
  if (gzip) await pipeline(stream, createGzip(), response);
  else await pipeline(stream, response);
}

class PayloadTooLarge extends Error {}

async function* responseChunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function readRequestBody(request: IncomingMessage, maxBytes: number) {
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    throw new PayloadTooLarge();
  const chunks: Buffer[] = [];
  let bytes = 0;
  // Reading manually avoids unbounded buffering. Breaking async iteration would
  // destroy the socket before the client can receive its 413 response.
  return new Promise<Buffer>((resolve, reject) => {
    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAborted);
    };
    const onData = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        cleanup();
        request.pause();
        reject(new PayloadTooLarge());
      } else chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, bytes));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onAborted = () => {
      cleanup();
      reject(new Error("Request aborted"));
    };
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
  });
}

export function createApplication({
  env,
  publicDir,
  publicOrigin,
  logger = console,
}: ApplicationOptions): Server {
  const configuredOrigin = publicOrigin ?? env.PUBLIC_ORIGIN;
  if (configuredOrigin && !/^https?:$/.test(new URL(configuredOrigin).protocol))
    throw new Error("PUBLIC_ORIGIN must use HTTP or HTTPS");
  const canonicalOrigin = configuredOrigin
    ? new URL(configuredOrigin).origin
    : null;
  const runtimeEnv: Env = canonicalOrigin
    ? { ...env, PUBLIC_ORIGIN: canonicalOrigin }
    : env;
  const directory = realpathSync(path.resolve(publicDir));
  const server = createServer(async (incoming, outgoing) => {
    securityHeaders(outgoing);
    // A client can disconnect while its body is still arriving. Keep an error
    // listener for the entire request lifetime, including after body rejection.
    incoming.on("error", () => outgoing.destroy());
    try {
      const target = incoming.url ?? "/";
      if (!target.startsWith("/") || target.startsWith("//")) {
        json(outgoing, 400, "Некорректный адрес");
        return;
      }
      const pathname = safePublicPath(target.split("?")[0]);
      if (pathname === null) {
        json(outgoing, 404, "Не найдено");
        return;
      }
      if (pathname === "/api" || pathname.startsWith("/api/")) {
        const method = incoming.method ?? "GET";
        const body = !["GET", "HEAD"].includes(method)
          ? await readRequestBody(
              incoming,
              method === "PUT" && pathname === "/api/admin/plots"
                ? BULK_REQUEST_BODY_MAX_BYTES
                : REQUEST_BODY_MAX_BYTES,
            )
          : undefined;
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value))
            value.forEach((entry) => headers.append(key, entry));
          else if (value !== undefined) headers.set(key, value);
        }
        const abortController = new AbortController();
        const abort = () => abortController.abort();
        outgoing.once("close", abort);
        try {
          // The configured origin is authoritative behind Passenger's proxy.
          // Never derive cookie/CSRF origin from client-controlled Host or X-Forwarded-*.
          const origin =
            canonicalOrigin ?? `http://localhost:${incoming.socket.localPort}`;
          const request = new Request(origin + target, {
            method,
            headers,
            body: body ? new Uint8Array(body) : undefined,
            signal: abortController.signal,
          });
          const response = await api.fetch(request, runtimeEnv);
          if (outgoing.destroyed) return;
          outgoing.writeHead(
            response.status,
            Object.fromEntries(response.headers),
          );
          if (method === "HEAD" || !response.body) outgoing.end();
          else
            await pipeline(
              Readable.from(responseChunks(response.body)),
              outgoing,
            );
        } finally {
          outgoing.off("close", abort);
        }
        return;
      }
      await serveStatic(incoming, outgoing, directory, pathname);
    } catch (error) {
      if (outgoing.destroyed) return;
      if (error instanceof PayloadTooLarge) {
        outgoing.setHeader("Connection", "close");
        json(outgoing, 413, "Слишком большой размер запроса");
        return;
      }
      if (!incoming.aborted) logger.error("HTTP request failed", error);
      if (!outgoing.headersSent)
        json(outgoing, 500, "Внутренняя ошибка сервера");
      else outgoing.destroy();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  return server;
}
