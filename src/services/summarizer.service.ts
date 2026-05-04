import { ChatCerebras } from "@langchain/cerebras";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as cheerio from "cheerio";
import axios from "axios";
import puppeteerExtra from "puppeteer-extra";
import puppeteerStealth from "puppeteer-extra-plugin-stealth";

puppeteerExtra.use(puppeteerStealth());
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

function extractText(html: string): string {
  const $ = cheerio.load(html);
  return $("body")
    .text()
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim()
    .substring(0, 8172); // truncate to fit model input limits
}

async function scrapeUrl(url: string): Promise<string> {
  // Try 1: plain axios
  try {
    const { data: html } = await axios.get(url, { headers, timeout: 8000 });
    const text = extractText(html);
    console.log(`[axios] text length: ${text.length}`);
    if (text.length > 200) return text;
    console.log("[axios] too little content, falling back to puppeteer");
  } catch (err) {
    console.log("[axios] failed:", err instanceof Error ? err.message : err);
  }

  // Try 2: stealth puppeteer
  try {
    const browser = await puppeteerExtra.launch({
      headless: true,
      executablePath: process.env.chromePath || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled", // removes webdriver flag
      ],
    });

    const page = await browser.newPage();

    // Match your actual Chromium version instead of hardcoding 120
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    );

    // Set realistic viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Set extra headers to look more human
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blocked = ["image", "stylesheet", "font", "media"];
      if (blocked.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Small delay to let lazy-loaded content render
    await new Promise((r) => setTimeout(r, 1500));

    const html = await page.content();
    await browser.close();

    const text = extractText(html);
    console.log(`[puppeteer] text length: ${text.length}`);
    if (text.length > 200) return text;
    console.log("[puppeteer] too little content");
  } catch (err) {
    console.log(
      "[puppeteer] failed:",
      err instanceof Error ? err.message : err,
    );
  }

  throw new Error("Unable to retrieve content from this URL");
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function summaryService(input: string) {
  let text: string;

  if (isValidUrl(input)) {
    try {
      text = await scrapeUrl(input);
    } catch (error) {
      return `Unable to retrieve content from the URL. Please ensure the URL is correct and accessible. Error details: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    // Plain text, go straight to model
    console.log("[service] input is plain text, skipping scrape");
    text = input.substring(0, 8172); // truncate to fit model input limits
  }

  const model = new ChatCerebras({
    apiKey: process.env.apiKey!,
    model: "llama3.1-8b",
    temperature: 0.3,
    maxTokens: 1024,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a world-class summarization assistant that adapts to any audience. Your task is to analyze content from any provided URL or text document and produce a summary that is immediately useful to anyone who reads it.

**Process:**
1. Retrieve the full text content from the provided URL or text document
2. Analyze the nature of the content — its subject, complexity, and likely audience
3. Produce a summary that is clear to a complete beginner yet still valuable to an expert

**Output Format:**

**Summary**
3-4 sentences covering what the content is about and why it matters.
- Use plain, jargon-free language as the default
- If technical terms are unavoidable, define them briefly in parentheses
- Write as if explaining to a smart person encountering this topic for the first time

**Key Points**
4-6 bullet points of the most important ideas, facts, or arguments
- One clear, self-contained idea per bullet
- Include relevant data, figures, or outcomes where present in the source
- Avoid assumptions — only use what the content explicitly states

**Bottom Line**
One sentence — the single most critical thing to understand or act on from this content.

**Guidelines:**
- Default tone: clear, neutral, and conversational — never overly academic or overly casual
- Never use unnecessary jargon; always favor simple words over complex ones
- Do not add opinion, interpretation, or external knowledge beyond the source material
- If the content covers multiple topics, focus on the dominant subject
- If retrieval fails or the content is inaccessible, clearly state that and explain why

When given a URL or text document, begin immediately with the summary — no preamble needed.`,
    ],
    ["user", "Summarize the following:\n\n{content}"],
  ]);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  return await chain.invoke({ content: text });
}

export default summaryService;
