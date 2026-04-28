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
  console.log("content: ", text);
}

main().catch((err) => console.error(err));
