import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Event name is required."],
    trim: true,
    minlength: [1, "Event name is required."],
    maxlength: [80, "Event name must be 80 characters or fewer."],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Event description must be 500 characters or fewer."],
    default: "",
  },
  startDate: {
    type: String,
    match: [/^\d{4}-\d{2}-\d{2}$/, "Start date must use YYYY-MM-DD."],
    default: null,
  },
  endDate: {
    type: String,
    match: [/^\d{4}-\d{2}-\d{2}$/, "End date must use YYYY-MM-DD."],
    default: null,
    validate: {
      validator(value) { return !value || !this.startDate || value >= this.startDate; },
      message: "End date cannot be before the start date.",
    },
  },
  timezone: {
    type: String,
    default: "UTC",
    maxlength: [100, "Timezone is too long."],
    validate: {
      validator(value) {
        try { Intl.DateTimeFormat("en-US", { timeZone: value }); return true; }
        catch { return false; }
      },
      message: "Timezone must be a valid IANA timezone.",
    },
  },
  capacity: {
    type: Number,
    enum: [10, 25, 100, 250],
    default: 100,
  },
  accentColor: {
    type: String,
    enum: ["blue", "coral", "yellow", "purple", "mint"],
    default: "blue",
  },
  sticker: {
    type: String,
    enum: ["star", "graduation", "birthday", "tech", "music", "travel", "love", "competition"],
    default: "star",
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    match: [/^\d{6}$/, "Invite code must contain exactly 6 digits."],
  },
  memoryCount: {
    type: Number,
    min: 0,
    default: 0,
  },
}, {
  timestamps: true,
  versionKey: false,
});

export const Event = mongoose.models.Event ?? mongoose.model("Event", eventSchema);
