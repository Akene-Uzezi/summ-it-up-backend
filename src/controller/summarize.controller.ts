import { Request, Response } from "express";
import summaryService from "../services/summarizer.service";

const getUrlSummary = async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  const data = await summaryService(url);
  res.json({ summary: data });
};

export { getUrlSummary };
