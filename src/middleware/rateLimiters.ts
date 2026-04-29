// rateLimiters.ts
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis";
import crypto from "crypto";
import { Request } from "express";

function generateFingerprint(req: Request, prefix: string): string {
  const data = [
    req.ip,
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
  ].join("|");
  return `${prefix}:${crypto.createHash("sha256").update(data).digest("hex")}`;
}

function createRedisStore() {
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
}

export function createLimiters() {
  const userMinuteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    keyGenerator: (req) => generateFingerprint(req, "user-minute"),
    message:
      "Too many requests. Please wait a minute before trying to summarize another URL",
    store: createRedisStore(),
  });

  const userHourLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 85,
    keyGenerator: (req) => generateFingerprint(req, "user-hour"),
    message:
      "Too many requests. Please wait an hour before trying to summarize another URL",
    store: createRedisStore(),
  });

  const userDayLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 1200,
    keyGenerator: (req) => generateFingerprint(req, "user-day"),
    message: "Limit Reached. Please try again tomorrow.",
    store: createRedisStore(),
  });

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 28,
    keyGenerator: () => "global",
    skip: (req) => req.path !== "/api/v1/summarize",
    message: "Server is busy. Please try again later.",
    store: createRedisStore(),
  });

  return { userMinuteLimiter, userHourLimiter, userDayLimiter, globalLimiter };
}
