import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalFileStorage } from "./localFileStorage.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(projectRoot, "uploads"));

// This is the only storage-specific dependency used by the routes. Swap this
// implementation for S3, Cloudinary, Vercel Blob, or another object store in production.
export const imageStorage = new LocalFileStorage(uploadDirectory);
