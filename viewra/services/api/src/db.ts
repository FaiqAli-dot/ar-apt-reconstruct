import mongoose from "mongoose";

export async function connectDb(uri: string): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
