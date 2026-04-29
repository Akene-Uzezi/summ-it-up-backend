import express from "express";
import { Router } from "express";
import { getUrlSummary } from "../controller/summarize.controller";
import { createLimiters } from "../middleware/rateLimiters";

type Limiters = ReturnType<typeof createLimiters>;

export function createSummaryRoutes(limiters: Limiters): Router {
  const router = express.Router();
  const { globalLimiter, userMinuteLimiter, userHourLimiter, userDayLimiter } =
    limiters;

  router.post(
    "/summarize",
    globalLimiter,
    userMinuteLimiter,
    userHourLimiter,
    userDayLimiter,
    getUrlSummary,
  );

  return router;
}
