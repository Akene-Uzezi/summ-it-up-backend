# Backend Architecture Documentation

## Overview

Summ It Up is a web service that summarizes content from URLs or plain text using AI (Cerebras LLaMA 3.1 8B). The backend is built with Node.js, Express, and TypeScript.

**Tech Stack:**
- Runtime: Node.js (TypeScript)
- Framework: Express 5.x
- AI: Cerebras Cloud SDK via LangChain
- Rate Limiting: express-rate-limit + rate-limit-redis
- Web Scraping: axios, puppeteer-extra with stealth plugin
- HTML Parsing: cheerio
- Caching/Session Storage: Redis

---

## Project Structure

```
src/
├── index.ts                    # Application entry point
├── config/
│   └── redis.ts                # Redis client configuration
├── routes/
│   └── summary.routes.ts       # API route definitions
├── controller/
│   └── summarize.controller.ts # Request handlers
├── services/
│   └── summarizer.service.ts   # Business logic (scraping + AI)
└── middleware/
    ├── notFound.ts             # 404 handler
    ├── serverError.ts          # 500 error handler
    └── rateLimiters.ts         # Rate limiting middleware
```

---

## Component Documentation

### 1. Main Entry Point (`src/index.ts`)

**Purpose:** Application bootstrap and middleware setup.

**Responsibilities:**
- Loads environment variables using `dotenv`
- Initializes Express app
- Connects to Redis (blocking start until connected)
- Creates and applies rate limiters
- Registers routes and middleware
- Starts HTTP server

**Initialization Flow:**
1. Load `.env` configuration
2. Create Express app
3. Connect to Redis (awaited)
4. Create rate limiters (depends on Redis connection)
5. Mount `/api/v1` router with limiter middleware
6. Register 404 and error handlers
7. Listen on `PORT` (default 3001)

**Middleware Stack Order:**
```
1. express.json()           - Parse JSON bodies
2. Rate Limiters            - Apply to /api/v1 routes
3. Routes                   - POST /summarize
4. notFound (404 handler)   - Catch-all for unmatched routes
5. serverError (500 handler) - Error boundary
```

**Key Code (src/index.ts:15-26):**
```typescript
(async () => {
  await connectRedis();

  const limiters = createLimiters();
  app.use("/api/v1", createSummaryRoutes(limiters));
  app.use(notFound);
  app.use(serverError);

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
})();
```

---

### 2. Redis Configuration (`src/config/redis.ts`)

**Purpose:** Redis client setup for rate limiting storage.

**Implementation:**
- Creates Redis client using `redisUrl` from environment
- Exports singleton `redisClient` and `connectRedis` function
- Logs connection status and errors

**Connection Details:**
- URL format: `redis://localhost:6379` (default)
- Client used: `redis` package v5.x

**Exports:**
- `redisClient` – The connected Redis client instance
- `connectRedis()` – Async function to establish connection

**Error Handling:**
- Logs Redis connection errors to console
- Does not crash app on Redis errors (rate limiting may degrade gracefully)

---

### 3. API Routes (`src/routes/summary.routes.ts`)

**Purpose:** Define route structure and apply middleware.

**Route Definition:**
```
POST /api/v1/summarize
```

**Middleware Applied (in order):**
1. `globalLimiter` – 28 req/min across all users on this endpoint
2. `userMinuteLimiter` – 3 req/min per fingerprint
3. `userHourLimiter` – 85 req/hour per fingerprint
4. `userDayLimiter` – 1200 req/day per fingerprint
5. `getUrlSummary` – Controller handler

**Dependency Injection:**
- Routes accept `limiters` object from factory function
- Enables testability and avoids circular dependencies

**Type Safety:**
- `Limiters` type inferred from `ReturnType<typeof createLimiters>`

---

### 4. Controller (`src/controller/summarize.controller.ts`)

**Purpose:** Handle HTTP request/response lifecycle.

**Endpoint:** `POST /api/v1/summarize`

**Request Body:**
```typescript
{ input: string }  // URL or plain text content
```

**Validation:**
- Returns `400 Bad Request` if `input` field is missing

**Response:**
```typescript
{ summary: string }  // AI-generated summary (3-6 lines)
```

**Error Handling:**
- Service errors are propagated to global error handler
- Returns 500 with generic error message

**No business logic** – delegates entirely to `summaryService`.

---

### 5. Summarizer Service (`src/services/summarizer.service.ts`)

**Purpose:** Core business logic for content retrieval and summarization.

#### Input Handling

The service accepts **either** a URL **or** plain text:

1. **URL Detection** – Validates protocol is `http:` or `https:`
2. **Plain Text** – Skipping scraping, sent directly to AI

#### Web Scraping Strategy

Two-phase fallback approach with anti-detection:

**Phase 1 – Axios (Fast Path)**
- Simple HTTP GET with custom headers
- 8-second timeout
- Extracts text using `cheerio`
- Returns if >200 characters found

**Phase 2 – Puppeteer Extra (Stealth Mode)**
Launched only if axios fails or returns insufficient content:
- Headless Chromium with `puppeteer-extra-plugin-stealth`
- Advanced anti-bot detection measures:
  - Custom User-Agent matching Chrome 147
  - Viewport set to 1280x800
  - Extra HTTP headers
  - Request interception to block images, stylesheets, fonts, media
  - Waits for DOM content loaded + 1.5s delay for lazy content
  - No-sandbox flags for container compatibility
- 30-second timeout
- Extracts text with `cheerio` (max 4000 chars)

**Scraping Output:**
- Returns clean text: trimmed, whitespace collapsed, 4000 char limit
- Throws error if both methods fail or content <200 chars

#### AI Summarization

**Model:** Cerebras LLaMA 3.1 8B (`ChatCerebras`)
- API key from `apiKey` environment variable
- Temperature: 0.7, Max tokens: 1024

**Prompt Engineering:**
System prompt defines expert summarizer role with these requirements:
- 3-6 line summary
- Preserve core meaning without distortion
- Plain language accessibility
- Capture primary points only
- Format: continuous paragraph or numbered points
- No external opinions or interpretations

**User Prompt:** `"Summarize this in 3 to 6 sentences:\n\n{content}"`

**Pipeline:**
```
Input → Scraping (if URL) → Prompt → ChatCerebras → StringOutputParser → Summary
```

**Error Cases:**
- Invalid URL → Error returned immediately
- Scraping failure → User-friendly error message with details
- AI failure → Exception bubbles to error middleware

---

### 6. Rate Limiting (`src/middleware/rateLimiters.ts`)

**Purpose:** Prevent abuse with multi-tier rate limiting backed by Redis.

#### Fingerprinting Strategy

Instead of simple IP-based limits, uses **SHA256 hashed fingerprint** combining:
- Client IP address
- User-Agent header
- Accept-Language header

**Formula:** `sha256(ip|user-agent|accept-language)`

Provides better granularity and reduces false sharing behind NATs.

**Implementation:**
```typescript
function generateFingerprint(req: Request, prefix: string): string {
  const data = [
    req.ip,
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
  ].join("|");
  return `${prefix}:${crypto.createHash("sha256").update(data).digest("hex")}`;
}
```

#### Four-Tier Limit System

| Limiter | Window | Max Requests | Scope | Purpose |
|---------|--------|--------------|-------|---------|
| `userMinuteLimiter` | 60s | 3 | Per fingerprint | Protect from burst abuse |
| `userHourLimiter` | 3600s | 85 | Per fingerprint | Daily usage control |
| `userDayLimiter` | 86400s | 1200 | Per fingerprint | Hard daily cap |
| `globalLimiter` | 60s | 28 | All users | Server capacity protection |

**Rate Limit Store:**
- Uses `RedisStore` from `rate-limit-redis` package
- Shares single Redis connection from `redisClient`
- Persistent across server restarts

**Skip Logic:**
- `globalLimiter` skips non-summarize endpoints (`req.path !== "/api/v1/summarize"`)

**Response Headers:**
Rate limiter automatically sets headers:
- `RateLimit-Limit` – Max requests in window
- `RateLimit-Remaining` – Requests left in window
- `RateLimit-Reset` – Timestamp when window resets
- `Retry-After` – Seconds to wait (if limit hit)

**Error Messages:**
User-friendly messages tailored to each limit tier.

---

### 7. Error Middleware

#### 404 Handler (`src/middleware/notFound.ts`)

Simple catch-all for unmatched routes:
- Response: `{ error: "Endpoint not found" }`
- Status: 404
- Placed **before** error handler but **after** routes

#### 500 Handler (`src/middleware/serverError.ts`)

Global error boundary:
- Logs error to console (`console.error`)
- Returns generic message: `{ error: "Internal Server Error" }`
- Status: 500
- Calls `next()` to prevent hanging (though not strictly needed as terminal middleware)

**Security:** Does not expose stack traces or internal details to clients.

---

## Environment Variables

| Variable | Required | Description | Default/Example |
|----------|----------|-------------|-----------------|
| `PORT` | No | Server port | `3001` |
| `redisUrl` | Yes | Redis connection URL | `redis://localhost:6379` |
| `apiKey` | Yes | Cerebras Cloud API key | `csk-...` |
| `chromePath` | No | Chromium executable for puppeteer | `/usr/bin/chromium` |

---

## Data Flow

```
Client Request
    ↓
Express (index.ts)
    ↓
Rate Limiters (check Redis)
    ↓
Route: POST /api/v1/summarize
    ↓
Controller: validate input
    ↓
Service: summaryService(input)
    ├─ If URL → scrapeUrl()
    │   ├─ Try axios → extract text
    │   └─ Fallback to puppeteer-extra stealth
    └─ If text → use directly
         ↓
    Build prompt + invoke ChatCerebras
         ↓
    Return summary string
    ↓
Controller: return JSON response
    ↓
Client receives: { "summary": "..." }
```

---

## Security Considerations

- **Rate Limiting:** Multi-tier with Redis persistence and fingerprinting
- **Input Validation:** URL protocol checked (http/https only)
- **Anti-Detection:** Puppeteer stealth mode reduces blocking
- **API Key Security:** Stored in environment, never logged
- **Error Sanitization:** Generic 500 messages, no stack traces in production
- **Request Interception:** Blocks images/stylesheets/fonts to reduce fingerprint

---

## Logging

Currently uses `console.log` and `console.error`. Logs include:
- Server startup port
- Redis connection status
- Scraping method and text length
- Scraping failures with error details
- Unhandled exceptions (via error middleware)

Consider adding structured logging (Winston/Pino) for production.

---

## Performance Notes

- **Redis** is critical – all rate limiters depend on it. If Redis is down, requests fail at rate limiter stage.
- **Scraping timeout:** 8s (axios) + 30s (puppeteer) worst case ≈ 38s
- **AI inference:** Typically 1-3 seconds depending on input length
- **Idempotency:** No caching – same URL requested multiple times will scraped each time
- **Memory:** Puppeteer launches headless Chromium (~100MB per instance)

---

## Future Improvements

- Add request/response logging middleware
- Implement request validation with Zod/Joi
- Add health check endpoint (`/health`)
- Add metrics endpoint (Prometheus)
- Cache scraped content to reduce duplicate scrapes
- Support more AI model options
- Add request queuing for high load
- Implement graceful shutdown
