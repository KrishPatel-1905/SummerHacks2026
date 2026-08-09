import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

export class LocalFileStorage {
  constructor(directory) {
    this.directory = path.resolve(directory);
  }

  async save(file, category = "image") {
    const extension = EXTENSIONS.get(file.mimetype);
    if (!extension) throw Object.assign(new Error("Unsupported image type."), { status: 415 });

    await mkdir(this.directory, { recursive: true });
    const filename = `${category}-${randomUUID()}${extension}`;
    await writeFile(path.join(this.directory, filename), file.buffer, { flag: "wx" });
    return `/uploads/${filename}`;
  }

  async remove(url) {
    if (!url?.startsWith("/uploads/")) return;
    const filename = path.basename(url);
    await unlink(path.join(this.directory, filename)).catch(() => {});
  }

  async send(filename, response, next) {
    response.set("Cache-Control", "public, max-age=31536000, immutable");
    response.sendFile(path.join(this.directory, path.basename(filename)), (error) => {
      if (error) next(error);
    });
  }
}
