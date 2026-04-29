import { ChatCerebras } from "@langchain/cerebras";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as cheerio from "cheerio";
import axios from "axios";
import puppeteer from "puppeteer";

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
    .substring(0, 4000);
}

async function scrapeUrl(url: string): Promise<string> {
  // Try 1: plain axios
  try {
    const { data: html } = await axios.get(url, { headers, timeout: 8000 });
    const text = extractText(html);
    if (text.length > 200) return text;
  } catch {}

  // Try 2: puppeteer (JS-rendered sites)
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(headers["User-Agent"]);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

    const html = await page.content();
    await browser.close();

    const text = extractText(html);
    if (text.length > 200) return text;
  } catch {}

  throw new Error("Unable to retrieve content from this URL");
}

async function summaryService(url: string) {
  let text: string;

  try {
    text = await scrapeUrl(url);
  } catch (error) {
    return `Unable to retrieve content from the URL. Please ensure the URL is correct and accessible. Error details: ${error instanceof Error ? error.message : String(error)}`;
  }

  const model = new ChatCerebras({
    apiKey: process.env.apiKey!,
    model: "llama3.1-8b",
    temperature: 0.7,
    maxTokens: 1024,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a content extraction and summarization expert. Your task is to fetch and analyze the content from any provided URL or text document, then produce a concise, accurate summary.

**Process:**
1. Retrieve the full text content from the provided URL or text document
2. Identify the main topics, key arguments, and essential information
3. Distill the content into a clear, coherent summary

**Summary Requirements:**
- Length: 3-6 lines maximum
- Accuracy: Preserve the core meaning and primary points without distortion
- Clarity: Use plain language accessible to someone unfamiliar with the source
- Completeness: Capture what matters most—omit tangential details, examples, and repetition
- Format: Present as a continuous paragraph or numbered points, whichever best conveys the information

**Guidelines:**
- If the URL or text document contains multiple distinct topics, prioritize the primary subject
- Maintain the original intent and tone of the source
- Do not add interpretation, opinion, or external knowledge beyond what the URL or text document contains
- If the content is technical, explain specialized terms briefly for clarity
- If retrieval fails or content is inaccessible, clearly state that and explain why

When given a URL or text document, begin immediately with retrieval and summary—no preamble needed.
`,
    ],
    ["user", "Summarize this in 3 to 6 sentences:\n\n{content}"],
  ]);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  return await chain.invoke({ content: text });
}

export default summaryService;
