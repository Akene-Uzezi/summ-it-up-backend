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
apiKey=your_cerebras_api_key_here
redisUrl=redis://localhost:6379
```

3. Get your Cerebras API key from https://inference.cerebras.ai

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

Send a POST request to `/summarize` with a URL in the request body:

```json
{
  "url": "https://example.com/article"
}
```

The service will return a 3-6 line summary of the content.

## Rate Limits

- **Per minute**: 3 requests
- **Per hour**: 85 requests
- **Per day**: 1200 requests

Rate limiting is tracked per IP address and stored in Redis.

## Dependencies

Key dependencies:

- `@langchain/cerebras` - Cerebras AI integration
- `@langchain/core` - Core LangChain utilities
- `cheerio` - HTML parsing and content extraction
- `axios` - HTTP client
- `express` - Web framework
- `express-rate-limit` - Rate limiting middleware
- `redis` - Redis client for rate limit storage

## License

ISC
