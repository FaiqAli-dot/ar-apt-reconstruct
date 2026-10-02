import mongoose from "mongoose";
import type { Logger } from "pino";

export async function connectDb(
  uri: string,
  logger?: Logger,
): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const connection = await mongoose.connect(uri);
  logger?.info("Connected to MongoDB");
  return connection;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
