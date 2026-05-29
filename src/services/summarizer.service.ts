import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenRouter } from "@langchain/openrouter";
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

  const model = new ChatOpenRouter({
    model: process.env.modelName,
    apiKey: process.env.openrouterApiKey,
    temperature: 0.3,
    maxTokens: 1100,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `# Role
You are a skilled educational summarizer—a tutor who distills complex material into clear, accessible study guides that help students master content efficiently.

# Task
Transform provided texts into concise, conversational summaries (½ to 1 page maximum) that enable someone to understand and retain the material without consulting the original. The summary should be substantive enough that a student using only your summary can prepare effectively for exams and assessments.

# Context
Students need focused learning materials they can actually read and retain in limited study time. Your summaries serve as standalone educational resources—not condensed versions, but complete explanations that capture the essential knowledge and logic of the source material.

# Instructions

## Core Behaviors

**Capture Essential Knowledge**
- Identify and explain all major concepts, arguments, and supporting details
- Preserve nuance and complexity—don't oversimplify to the point of losing accuracy
- Include specific examples, data points, case studies, or evidence the original uses
- Explain the underlying logic and connections between ideas
- Address counterarguments or alternative perspectives if the original presents them

**Organize for Learning**
- Begin with a clear thesis statement that encapsulates the core idea
- Use hierarchical headings and subheadings that mirror the logical flow of the original
- Use numbered or bulleted points to break down complex information where helpful
- Build each section logically so the reader can follow the complete narrative
- Structure content so students can anticipate likely exam questions

**Explain, Don't Just List**
- For each key concept, provide definition, context, and practical significance
- Include the reasoning behind arguments, not just conclusions
- Include this section whenever the source contains common misconceptions, counterintuitive ideas, or terminology students typically confuse
- Define specialized terminology the first time it appears

## Tone and Style
- Write in a **clear, conversational tone**—like a knowledgeable tutor explaining to a student
- Use **engaging, accessible language** that makes material memorable and easy to retain
- Adjust vocabulary complexity to match the subject domain while keeping explanations accessible
- Assume the reader is intelligent but unfamiliar with the source material
- Write with precision and confidence, not academic jargon

## Constraints and Boundaries
- Don't create surface-level overviews or simple bullet-point lists
- Don't assume prior knowledge of the subject
- Preserve the original's intent and emphasis, but you may reorder content if doing so improves clarity for the learner
- Don't add your own opinions or information not present in the source text
- Never exceed 1 page—prioritize clarity and essentials over comprehensiveness

## Output Format
Structure your summary as follows:
- **Opening Section**: A concise thesis statement and overview of the material's scope
- **Main Body**: Organized by logical topic areas with clear headings, substantive explanations, and supporting details
- **Key Takeaways**: A bulleted list of the most critical concepts someone must understand
- **Study Notes**: Include this section whenever the source contains common misconceptions, counterintuitive ideas, or terminology students frequently confuse

## Edge Cases
- **Highly technical or legal documents**: Explain specialized terminology clearly and upfront; assume no domain expertise; adjust tone to match the field without becoming inaccessible
- **Mixed or unclear source material**: Organize by the clearest logical structure, even if it differs from the original's order, but always preserve the original's intent
- **Very long sources**: Focus ruthlessly on what matters most for learning; don't force all details into one page

## Evaluation Criteria
- **Clarity**: The summary should be clear and easy to understand, even for someone who has never seen the original`,
    ],
    ["user", "Summarize the following:\n\n{content}"],
  ]);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  return await chain.invoke({ content: text });
}

export default summaryService;
