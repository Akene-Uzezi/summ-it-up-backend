# Summ It Up - Backend

A web service that summarizes content from URLs using AI. Built with Node.js, Express, TypeScript, and Cerebras AI.

## Prerequisites

Before running this project, ensure you have the following installed:

- **Node.js** (v18 or higher recommended)
- **Redis** - Required for rate limiting storage
  - Download from https://redis.io/download
  - Or use Docker: `docker run -d -p 6379:6379 redis:alpine`
  - Ensure Redis is running on `localhost:6379`

## Environment Setup

1. Clone the repository
2. Create a `.env` file in the root directory:

```env
PORT=3001
redisUrl=redis://localhost:6379
apiKey=your_cerebras_api_key_here
chromePath=/usr/bin/chromium
```

3. Get your Cerebras API key from https://inference.cerebras.ai
4. Ensure Redis is running (see Prerequisites)
5. Ensure Chromium/Chrome is installed (or update `chromePath` to match your system)

## Installation

```bash
npm install
```

## Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

## Development

Run in development mode with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## Production

Start the compiled application:

```bash
npm start
```

## API Usage

### Summarize Content

Send a POST request to `/api/v1/summarize` with either a URL or plain text in the request body:

```json
{
  "input": "https://example.com/article"
}
```

or

```json
{
  "input": "Your plain text content here..."
}
```

**Behavior:**
- If the input is a valid URL (http/https), the service scrapes the webpage content and summarizes it
- If the input is plain text, the service summarizes it directly

The service returns a 3-6 line summary using Cerebras AI.

## Rate Limits

Rate limiting is applied per user fingerprint (IP + User-Agent + Accept-Language) and stored in Redis.

- **Per minute**: 3 requests
- **Per hour**: 85 requests
- **Per day**: 1200 requests
- **Global**: 28 requests per minute across all users

## Dependencies

Key dependencies:

- `@langchain/cerebras` - Cerebras AI integration
- `@langchain/core` - Core LangChain utilities
- `cheerio` - HTML parsing and content extraction
- `axios` - HTTP client
- `express` - Web framework
- `express-rate-limit` - Rate limiting middleware
- `redis` - Redis client for rate limit storage
- `puppeteer-extra` - Enhanced Puppeteer with plugins
- `puppeteer-extra-plugin-stealth` - Anti-detection plugin for Puppeteer

## License

ISC
