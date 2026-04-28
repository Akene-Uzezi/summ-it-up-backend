import Redis from "redis";
const redisClient = Redis.createClient({
  url: process.env.redisUrl,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

const connectRedis = async () => {
  await redisClient.connect();
  console.log("connected to redis");
};

export { connectRedis, redisClient };
