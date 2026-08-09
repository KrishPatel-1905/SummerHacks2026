import mongoose from "mongoose";
import { Memory } from "../models/Memory.js";
import { Event } from "../models/Event.js";
import {
  DRAWING_MOTIF_LABELS,
  PHOTO_ACTIVITY_LABELS,
  VISION_ANALYSIS_VERSION,
} from "./visionAnalysisService.js";

const MAX_VISUAL_SIGNALS = 4;
const PHOTO_LABELS = new Set(PHOTO_ACTIVITY_LABELS);
const DRAWING_LABELS = new Set(DRAWING_MOTIF_LABELS);
const LEGACY_PHOTO_LABELS = new Map([
  ["laptop", "screen use"],
  ["computer", "screen use"],
  ["desktop computer", "screen use"],
  ["monitor", "screen use"],
  ["keyboard", "screen use"],
  ["smartphone", "screen use"],
  ["phone", "screen use"],
  ["tablet", "screen use"],
  ["screen", "screen use"],
  ["crowd", "celebrating"],
  ["confetti", "celebrating"],
  ["raised hand", "celebrating"],
  ["spotlight", "performing"],
  ["stage light", "performing"],
]);
const LEGACY_DRAWING_LABELS = new Map([
  ["scribble", "abstract doodle"],
  ["doodle", "abstract doodle"],
  ["line art", "abstract doodle"],
  ["abstract art", "abstract doodle"],
  ["smiley face", "smiley"],
  ["text", "word art"],
  ["word", "word art"],
]);

export function canonicalizeVisualSignal(label, source) {
  const normalized = String(label || "").trim().toLowerCase();
  if (!normalized) return null;
  if (source === "photo") {
    if (PHOTO_LABELS.has(normalized)) return normalized;
    return LEGACY_PHOTO_LABELS.get(normalized) || null;
  }
  if (source === "drawing") {
    if (DRAWING_LABELS.has(normalized)) return normalized;
    return LEGACY_DRAWING_LABELS.get(normalized) || null;
  }
  return null;
}

function increment(map, label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized) map.set(normalized, (map.get(normalized) || 0) + 1);
}

function ranked(map, limit = 8) {
  return [...map].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

export async function getEventPulseData(eventId) {
  const objectId = new mongoose.Types.ObjectId(eventId);
  const baseMatch = { eventId: objectId };
  const eligibleMatch = { ...baseMatch, $or: [{ imageUrl: { $ne: null } }, { envelopeDrawing: { $ne: null } }] };
  const event = await Event.findById(objectId).select("timezone");
  const timezone = event?.timezone || "UTC";

  const [total, analyzed, moodGroups, rawTimeline, memories, visionEligibleMemoryCount, visionAnalyzedMemoryCount, pendingVisionCount, failedVisionCount, staleVisionCount] = await Promise.all([
    Memory.countDocuments(baseMatch),
    Memory.countDocuments({ ...baseMatch, analysisStatus: "complete", analysis: { $ne: null } }),
    Memory.aggregate([
      { $match: { ...baseMatch, analysisStatus: "complete", "analysis.mood": { $type: "string", $ne: "" } } },
      { $group: { _id: { $toLower: "$analysis.mood" }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    Memory.aggregate([
      { $match: baseMatch },
      { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "hour", timezone } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Memory.find(baseMatch).select("analysisStatus analysis.themes analysis.visualTags imageUrl envelopeDrawing visionStatus visionAnalysisVersion +visionAnalysis").lean(),
    Memory.countDocuments(eligibleMatch),
    Memory.countDocuments({ ...eligibleMatch, visionStatus: "complete" }),
    Memory.countDocuments({ $and: [eligibleMatch, { $or: [{ visionStatus: { $in: ["pending", "processing"] } }, { visionStatus: { $exists: false } }] }] }),
    Memory.countDocuments({ ...eligibleMatch, visionStatus: "failed" }),
    Memory.countDocuments({ ...eligibleMatch, visionStatus: "complete", visionAnalysisVersion: { $ne: VISION_ANALYSIS_VERSION } }),
  ]);

  const moods = moodGroups.map((item) => ({
    label: item._id,
    count: item.count,
    percentage: analyzed ? Math.round((item.count / analyzed) * 100) : 0,
  }));
  const timeline = rawTimeline.map((item) => ({ bucket: item._id, count: item.count }));
  const peak = timeline.reduce((best, item) => (!best || item.count > best.count ? item : best), null);

  const themeCounts = new Map();
  const legacyVisualCounts = new Map();
  const visualMap = new Map();
  for (const memory of memories) {
    const memoryId = String(memory._id);
    const memoryThemes = new Set(memory.analysisStatus === "complete" ? memory.analysis?.themes || [] : []);
    if (memory.visionStatus === "complete") {
      for (const signal of memory.visionAnalysis?.visualThemes || []) memoryThemes.add(signal.label);
    }
    for (const theme of memoryThemes) increment(themeCounts, theme);
    if (memory.analysisStatus === "complete") {
      for (const label of new Set(memory.analysis?.visualTags || [])) increment(legacyVisualCounts, label);
    }
    if (memory.visionStatus !== "complete") continue;
    const addSignals = (signals, source) => {
      for (const signal of signals || []) {
        const label = canonicalizeVisualSignal(signal.label, source);
        if (!label) continue;
        const item = visualMap.get(label) || { label, memories: new Set(), photo: new Set(), drawing: new Set() };
        item.memories.add(memoryId);
        item[source].add(memoryId);
        visualMap.set(label, item);
      }
    };
    addSignals(memory.visionAnalysis?.photoSignals, "photo");
    addSignals(memory.visionAnalysis?.drawingSignals, "drawing");
  }

  const themes = ranked(themeCounts);
  let visualSignals = [...visualMap.values()].map((item) => ({
    label: item.label,
    count: item.memories.size,
    photoCount: item.photo.size,
    drawingCount: item.drawing.size,
    sources: [item.photo.size ? "photo" : null, item.drawing.size ? "drawing" : null].filter(Boolean),
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, MAX_VISUAL_SIGNALS);
  if (!visualSignals.length) {
    visualSignals = ranked(legacyVisualCounts, MAX_VISUAL_SIGNALS).map((item) => ({
      ...item,
      photoCount: item.label === "photo" ? item.count : 0,
      drawingCount: item.label === "drawing" ? item.count : 0,
      sources: item.label === "drawing" ? ["drawing"] : ["photo"],
    }));
  }

  const topMood = moods[0]?.label;
  const topTheme = themes[0]?.label;
  const repeatedVisual = visualSignals.find((item) => item.count >= 2 && !["photo", "drawing"].includes(item.label));
  let story = total === 0
    ? "The capsule is waiting for its first memory."
    : analyzed === 0
      ? "Memories are arriving, and the event story is still taking shape."
      : `The event felt ${topMood || "full of mixed emotions"}${topTheme ? `, with ${topTheme} appearing throughout the shared memories` : ""}.`;
  if (repeatedVisual) story += ` ${repeatedVisual.label[0].toUpperCase()}${repeatedVisual.label.slice(1)} kept appearing across the visuals.`;

  return {
    memoryCount: total,
    analyzedMemoryCount: analyzed,
    pendingAnalysisCount: await Memory.countDocuments({ ...baseMatch, analysisStatus: "pending" }),
    failedAnalysisCount: await Memory.countDocuments({ ...baseMatch, analysisStatus: "failed" }),
    moods,
    themes,
    visualSignals,
    visualTags: visualSignals.map(({ label, count }) => ({ label, count })),
    timeline,
    peak,
    story,
    analysisCoverage: total ? Math.round((analyzed / total) * 100) : 0,
    visionEligibleMemoryCount,
    visionAnalyzedMemoryCount,
    pendingVisionCount,
    failedVisionCount,
    staleVisionCount,
    visionCoverage: visionEligibleMemoryCount ? Math.round((visionAnalyzedMemoryCount / visionEligibleMemoryCount) * 100) : 0,
    timezone,
  };
}
