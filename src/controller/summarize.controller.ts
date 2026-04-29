import { Request, Response } from "express";
import summaryService from "../services/summarizer.service";

const getUrlSummary = async (req: Request, res: Response) => {
  const { input } = req.body;
  if (!input) {
    return res.status(400).json({ error: "Input is required" });
  }
  const data = await summaryService(input);
  res.json({ summary: data });
};

export { getUrlSummary };
