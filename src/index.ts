import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors, { CorsOptions } from "cors";
import { connectRedis } from "./config/redis";
import { createSummaryRoutes } from "./routes/summary.routes";
import notFound from "./middleware/notFound";
import serverError from "./middleware/serverError";
import { createLimiters } from "./middleware/rateLimiters";

const app = express();
const port = process.env.PORT || 3001;

const originString = process.env.allowedOrigins || "http://localhost:3000";
const allowedOrigins = originString.split(",").filter(Boolean);
const options: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
};

app.set('trust proxy', 1)
app.use(express.json());
app.use(cors(options));
function keepAlive() {
  setInterval(async () => {
    const url = process.env.endPoint;
    if (!url) {
      console.error("endPoint is not defined in environment variables");
      return;
    }
    try {
      await fetch(url);
    } catch (err) {
      console.error("Error in keepAlive fetch:", err);
    }
  }, 600000); // 10 minutes
}
keepAlive();
(async () => {
  await connectRedis();

  const limiters = createLimiters(); // create AFTER redis is connected
  app.use("/api/v1", createSummaryRoutes(limiters));
  app.use(notFound);
  app.use(serverError);

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
})();
