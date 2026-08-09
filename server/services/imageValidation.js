const SIGNATURES = {
  "image/png": (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/gif": (buffer) => buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")),
  "image/webp": (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP",
};

const MAX_IMAGE_PIXELS = 25_000_000;

function readDimensions(file) {
  const buffer = file.buffer;
  if (file.mimetype === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (file.mimetype === "image/gif" && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (file.mimetype === "image/webp" && buffer.length >= 30) {
    const kind = buffer.subarray(12, 16).toString("ascii");
    if (kind === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (kind === "VP8L" && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8 " && buffer.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
  }
  if (file.mimetype === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export function validateImageFile(file, { pngOnly = false } = {}) {
  if (!file) return;
  if (pngOnly && file.mimetype !== "image/png") {
    throw Object.assign(new Error("Envelope drawing must be a PNG image."), { status: 415 });
  }
  const matches = SIGNATURES[file.mimetype]?.(file.buffer);
  if (!matches) throw Object.assign(new Error("Uploaded image content does not match its file type."), { status: 415 });
  const dimensions = readDimensions(file);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw Object.assign(new Error("Uploaded image dimensions could not be verified."), { status: 415 });
  }
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw Object.assign(new Error("Uploaded image dimensions are too large."), { status: 413 });
  }
}
