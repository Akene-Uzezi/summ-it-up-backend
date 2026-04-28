import express from "express";
import { connectRedis } from "./config/redis";
import { summaryRoutes } from "./routes/summary.routes";
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use("/api/v1", summaryRoutes);
app.listen(port, async () => {
  await connectRedis();
  console.log(`Server is running on port ${port}`);
});
