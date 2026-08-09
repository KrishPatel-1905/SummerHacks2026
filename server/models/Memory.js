import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema({
  mood: { type: String, trim: true, maxlength: 40 },
  themes: [{ type: String, trim: true, maxlength: 60 }],
  visualTags: [{ type: String, trim: true, maxlength: 60 }],
  confidence: { type: Number, min: 0, max: 1 },
}, { _id: false });

const visionSignalSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 40 },
  confidence: { type: Number, min: 0, max: 1 },
}, { _id: false });

const visionAnalysisSchema = new mongoose.Schema({
  photoSignals: { type: [visionSignalSchema], default: [] },
  drawingSignals: { type: [visionSignalSchema], default: [] },
  visualThemes: { type: [visionSignalSchema], default: [] },
}, { _id: false });

const storedUrlPattern = /^(https?:\/\/[^\s]+|\/uploads\/[a-zA-Z0-9._-]+)$/;

const memorySchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
    index: true,
  },
  imageUrl: {
    type: String,
    default: null,
    maxlength: 2048,
    validate: {
      validator: (value) => value == null || storedUrlPattern.test(value),
      message: "Image URL is invalid.",
    },
  },
  message: {
    type: String,
    required: [true, "Memory message is required."],
    trim: true,
    minlength: [1, "Memory message is required."],
    maxlength: [50, "Memory message must be 50 characters or fewer."],
  },
  author: {
    type: String,
    trim: true,
    maxlength: [9, "Author name must be 9 characters or fewer."],
    default: "",
  },
  emoji: {
    type: String,
    required: [true, "Mood emoji is required."],
    trim: true,
    enum: {
      values: ["🙂", "🥹", "😭", "🤯", "😴", "❤️", "😤", "🥳"],
      message: "Choose one of the supported moods.",
    },
  },
  envelopeColor: {
    type: String,
    enum: ["cream", "lavender", "mint", "yellow", "coral"],
    default: "cream",
  },
  envelopeDrawing: {
    type: String,
    default: null,
    maxlength: 2048,
    validate: {
      validator: (value) => value == null || storedUrlPattern.test(value),
      message: "Envelope drawing URL is invalid.",
    },
  },
  analysisStatus: {
    type: String,
    enum: ["pending", "complete", "failed"],
    default: "pending",
    index: true,
  },
  analysis: {
    type: analysisSchema,
    default: null,
  },
  clientRequestId: {
    type: String,
    default: null,
    trim: true,
    minlength: 16,
    maxlength: 100,
  },
  analysisVersion: {
    type: String,
    default: null,
    maxlength: 80,
  },
  analyzedAt: {
    type: Date,
    default: null,
  },
  analysisError: {
    type: String,
    default: null,
    maxlength: 500,
  },
  visionStatus: {
    type: String,
    enum: ["pending", "processing", "complete", "failed", "skipped"],
    default: "skipped",
    index: true,
  },
  visionAnalysis: {
    type: visionAnalysisSchema,
    default: null,
    select: false,
  },
  visionAnalysisVersion: { type: String, default: null, maxlength: 80 },
  visionModel: { type: String, default: null, maxlength: 80 },
  visionAnalyzedAt: { type: Date, default: null },
  visionStartedAt: { type: Date, default: null, select: false },
  visionAttempts: { type: Number, default: 0, min: 0, max: 10, select: false },
  visionError: { type: String, default: null, maxlength: 500, select: false },
  nextVisionAttemptAt: { type: Date, default: null, select: false },
}, {
  timestamps: true,
  versionKey: false,
});

memorySchema.index({ eventId: 1, createdAt: 1 });
memorySchema.index({ eventId: 1, visionStatus: 1, nextVisionAttemptAt: 1 });
memorySchema.index(
  { eventId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } },
);

export const Memory = mongoose.models.Memory ?? mongoose.model("Memory", memorySchema);
