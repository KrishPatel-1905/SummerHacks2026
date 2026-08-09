import mongoose from "mongoose";

const globalCache = globalThis.__eventCapsuleMongo ??= {
  connection: null,
  promise: null,
};

export async function connectToDatabase() {
  if (globalCache.connection) return globalCache.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required. Copy .env.example to .env and add your MongoDB connection string.");
  }

  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    }).catch((error) => {
      globalCache.promise = null;
      throw error;
    });
  }

  globalCache.connection = await globalCache.promise;
  return globalCache.connection;
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  globalCache.connection = null;
  globalCache.promise = null;
}
