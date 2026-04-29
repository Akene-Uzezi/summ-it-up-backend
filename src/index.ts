import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { connectRedis } from "./config/redis";
import { createSummaryRoutes } from "./routes/summary.routes";
import notFound from "./middleware/notFound";
import serverError from "./middleware/serverError";
import { createLimiters } from "./middleware/rateLimiters";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

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
