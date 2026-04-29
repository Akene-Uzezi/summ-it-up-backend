import express from "express";
import { connectRedis } from "./config/redis";
import { summaryRoutes } from "./routes/summary.routes";
import notFound from "./middleware/notFound";
import serverError from "./middleware/serverError";
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use("/api/v1", summaryRoutes);
app.use(notFound);
app.use(serverError);
(async () => await connectRedis())();
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
});
