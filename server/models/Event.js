import mongoose from "mongoose";

function isCalendarDate(value) {
  if (value == null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

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
    maxlength: [120, "Event description must be 120 characters or fewer."],
    default: "",
  },
  startDate: {
    type: String,
    default: null,
    validate: { validator: isCalendarDate, message: "Start date must be a real date using YYYY-MM-DD." },
  },
  endDate: {
    type: String,
    default: null,
    validate: {
      validator(value) { return isCalendarDate(value) && (!value || !this.startDate || value >= this.startDate); },
      message: "End date must be real and cannot be before the start date.",
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
    match: [/^\d{6}$/, "Invite code must contain exactly 6 digits."],
  },
  ownerTokenHash: {
    type: String,
    select: false,
    immutable: true,
    minlength: 64,
    maxlength: 64,
  },
  status: {
    type: String,
    enum: ["open", "closed", "archived"],
    default: "open",
    index: true,
  },
  submissionsOpenAt: {
    type: Date,
    default: null,
  },
  submissionsCloseAt: {
    type: Date,
    default: null,
    validate: {
      validator(value) { return !value || !this.submissionsOpenAt || value > this.submissionsOpenAt; },
      message: "Submission close time must be after its open time.",
    },
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
