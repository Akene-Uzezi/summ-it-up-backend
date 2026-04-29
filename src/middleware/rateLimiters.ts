import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis";

const userMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req) =>
    req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
  message:
    "Too many requests. Please wait a minute before trying to summarize another URL",
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

const userHourLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 85,
  keyGenerator: (req) =>
    req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
  message:
    "Too many requests. Please wait an hour before trying to summarize another URL",
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

const userDayLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1200,
  keyGenerator: (req) =>
    req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
  message: "Limit Reached. Please try again tomorrow.",
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 28,
  keyGenerator: () => "global",
  skip: (req) => req.path !== "/api/v1/summarize",
  message: "Server is busy. Please try again later.",
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

export { userMinuteLimiter, userHourLimiter, userDayLimiter, globalLimiter };
