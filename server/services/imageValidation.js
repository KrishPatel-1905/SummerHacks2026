const SIGNATURES = {
  "image/png": (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/gif": (buffer) => buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")),
  "image/webp": (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP",
};

export function validateImageFile(file, { pngOnly = false } = {}) {
  if (!file) return;
  if (pngOnly && file.mimetype !== "image/png") {
    throw Object.assign(new Error("Envelope drawing must be a PNG image."), { status: 415 });
  }
  const matches = SIGNATURES[file.mimetype]?.(file.buffer);
  if (!matches) throw Object.assign(new Error("Uploaded image content does not match its file type."), { status: 415 });
}
