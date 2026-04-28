import express from "express";
import { connectRedis } from "./config/redis";
const app = express();
const port = process.env.PORT || 3000;

app.listen(port, async () => {
  await connectRedis();
  console.log(`Server is running on port ${port}`);
});
