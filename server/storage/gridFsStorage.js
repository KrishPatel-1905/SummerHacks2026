import { randomUUID } from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";

const EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

export class GridFsStorage {
  constructor(bucketName = "eventCapsuleUploads") {
    this.bucketName = bucketName;
  }

  bucket() {
    if (!mongoose.connection.db) throw new Error("MongoDB must be connected before accessing uploads.");
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: this.bucketName });
  }

  async save(file, category = "image") {
    const extension = EXTENSIONS.get(file.mimetype);
    if (!extension) throw Object.assign(new Error("Unsupported image type."), { status: 415 });
    const filename = `${category}-${randomUUID()}${extension}`;
    const stream = this.bucket().openUploadStream(filename, {
      metadata: { contentType: file.mimetype },
    });
    await new Promise((resolve, reject) => {
      stream.once("error", reject);
      stream.once("finish", resolve);
      stream.end(file.buffer);
    });
    return `/uploads/${filename}`;
  }

  async remove(url) {
    if (!url?.startsWith("/uploads/")) return;
    const filename = path.basename(url);
    const file = await this.bucket().find({ filename }).sort({ uploadDate: -1 }).limit(1).next();
    if (file) await this.bucket().delete(file._id);
  }

  async send(filename, response, next) {
    try {
      const file = await this.bucket().find({ filename }).sort({ uploadDate: -1 }).limit(1).next();
      if (!file) return response.status(404).send("Not found.");
      response.type(file.metadata?.contentType || "application/octet-stream");
      response.set("Cache-Control", "public, max-age=31536000, immutable");
      const stream = this.bucket().openDownloadStream(file._id);
      stream.once("error", next);
      stream.pipe(response);
    } catch (error) {
      next(error);
    }
  }
}
