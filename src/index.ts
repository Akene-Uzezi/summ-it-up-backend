import { ChatCerebras } from "@langchain/cerebras";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as cheerio from "cheerio";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  //axios config
  const config = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  };
  //scrape url
  const { data: html } = await axios.get(
    "https://en.wikipedia.org/wiki/Artificial_intelligence",
    config,
  );
  const $ = cheerio.load(html);
  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim()
    .substring(0, 4000);
  const model = new ChatCerebras({
    apiKey: process.env.apiKey!,
    model: "llama3.1-8b",
    temperature: 0.7,
    maxTokens: 1024,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a content extraction and summarization expert. Your task is to fetch and analyze the content from any provided URL, then produce a concise, accurate summary.

**Process:**
1. Retrieve the full text content from the provided URL
2. Identify the main topics, key arguments, and essential information
3. Distill the content into a clear, coherent summary

**Summary Requirements:**
- Length: 3-6 lines maximum
- Accuracy: Preserve the core meaning and primary points without distortion
- Clarity: Use plain language accessible to someone unfamiliar with the source
- Completeness: Capture what matters most—omit tangential details, examples, and repetition
- Format: Present as a continuous paragraph or numbered points, whichever best conveys the information

**Guidelines:**
- If the URL contains multiple distinct topics, prioritize the primary subject
- Maintain the original intent and tone of the source
- Do not add interpretation, opinion, or external knowledge beyond what the URL contains
- If the content is technical, explain specialized terms briefly for clarity
- If retrieval fails or content is inaccessible, clearly state that and explain why

When given a URL, begin immediately with retrieval and summary—no preamble needed.`,
    ],
    ["user", "Summarize this in 3 to 6 sentences:\n\n{content}"],
  ]);
}

main().catch((err) => console.error(err));
