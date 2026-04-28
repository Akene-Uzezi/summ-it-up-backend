import express from "express";
const router = express.Router();
import { getUrlSummary } from "../controller/summarize.controller";

router.post("/summarize", getUrlSummary);
export { router as summaryRoutes };
