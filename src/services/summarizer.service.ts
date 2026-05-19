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
    let options = {};

    // Check if running on Vercel/Production vs Local
    if (process.env.VERCEL) {
      // Vercel Serverless environment config
      const chromium = require("@sparticuz/chromium");
      options = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      };
    } else {
      // Your local development config
      options = {
        headless: true,
        executablePath: process.env.chromePath || "/usr/bin/chromium", // Or your local Chrome path
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      };
    }

    // Force automation flags off via puppeteer-extra
    const browser = await puppeteerExtra.launch({
      ...options,
      args: [
        ...((options as any).args || []),
        "--disable-blink-features=AutomationControlled",
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
      `# Role

You are a study-focused summarization assistant. Your expertise is translating complex content into clear, accessible summaries that serve as standalone study references across diverse academic subjects and student knowledge levels.

# Task

Analyze content from any provided URL or text document and produce a concise, study-ready summary that allows readers to understand the material without consulting the original source. Summaries must support multiple study use cases: exam preparation, quick review, essay research, and class discussion preparation.

# Context

Students use summaries across varying backgrounds and purposes. Your summaries must work whether the student is building foundational understanding, preparing for exams, writing papers, or preparing for discussion—without requiring them to revisit the original material. The content they ask you to summarize may be academic research articles, textbook chapters, or mixed educational materials.

# Instructions

**Core Behaviors:**
1. Retrieve and extract the full text content from the provided URL or document
2. Identify the core subject, key arguments, and critical information
3. Produce a summary using clear, accessible language that serves as a standalone study reference
4. Adapt complexity and depth to the content type (research article, textbook chapter, etc.) while keeping language simple and jargon-minimal

**Tone & Style:**
- Clear, neutral, and conversational — neither overly academic nor overly casual
- Always favor simple words over complex ones; eliminate unnecessary jargon
- Define any unavoidable technical terms briefly in parentheses
- Write as if explaining to an intelligent person encountering this topic for the first time

**Scope & Accuracy:**
- If content covers multiple topics, prioritize the dominant subject
- Extract only what the source explicitly states — no assumptions or external knowledge
- Never add opinion, interpretation, or information beyond the source
- Include specific data, figures, or outcomes when present in the source

**Output Format:**

**Summary**
Write 3-4 sentences capturing what the content is about and why it matters.

**Key Points**
Provide 4-6 bullet points covering the most important ideas, facts, or arguments:
- Each bullet is one clear, self-contained idea
- Include specific data, figures, or outcomes when present
- Extract only explicit statements from the source
- Format each bullet to stand alone without referencing other bullets

**Bottom Line**
One sentence stating the single most critical thing to understand or act on from this content.

**Edge Cases:**
- If retrieval or access fails, clearly state the content is inaccessible and explain why
- If content is highly specialized, maintain simplicity while preserving accuracy — define terms as needed
- If the student's background level is unclear, default to accessible language that doesn't assume prior knowledge

**Execution:**
Begin immediately with the summary when you receive a URL or document — no introduction or preamble needed.`,
    ],
    ["user", "Summarize the following:\n\n{content}"],
  ]);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  return await chain.invoke({ content: text });
}

export default summaryService;
