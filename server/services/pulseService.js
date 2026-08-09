import mongoose from "mongoose";
import { Memory } from "../models/Memory.js";

const rankedGroup = (field) => [
  { $match: { analysisStatus: "complete", analysis: { $ne: null } } },
  { $unwind: `$analysis.${field}` },
  { $match: { [`analysis.${field}`]: { $type: "string", $ne: "" } } },
  { $group: { _id: { $toLower: `$analysis.${field}` }, count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } },
  { $limit: 8 },
];

export async function getEventPulseData(eventId) {
  const objectId = new mongoose.Types.ObjectId(eventId);
  const baseMatch = { eventId: objectId };

  const [total, analyzed, moodGroups, themes, visualTags, rawTimeline] = await Promise.all([
    Memory.countDocuments(baseMatch),
    Memory.countDocuments({ ...baseMatch, analysisStatus: "complete", analysis: { $ne: null } }),
    Memory.aggregate([
      { $match: { ...baseMatch, analysisStatus: "complete", "analysis.mood": { $type: "string", $ne: "" } } },
      { $group: { _id: { $toLower: "$analysis.mood" }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    Memory.aggregate([{ $match: baseMatch }, ...rankedGroup("themes")]),
    Memory.aggregate([{ $match: baseMatch }, ...rankedGroup("visualTags")]),
    Memory.aggregate([
      { $match: baseMatch },
      { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "hour" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const moods = moodGroups.map((item) => ({
    label: item._id,
    count: item.count,
    percentage: analyzed ? Math.round((item.count / analyzed) * 100) : 0,
  }));
  const timeline = rawTimeline.map((item) => ({ bucket: item._id, count: item.count }));
  const peak = timeline.reduce((best, item) => (!best || item.count > best.count ? item : best), null);

  return {
    memoryCount: total,
    analyzedMemoryCount: analyzed,
    pendingAnalysisCount: await Memory.countDocuments({ ...baseMatch, analysisStatus: "pending" }),
    moods,
    themes: themes.map((item) => ({ label: item._id, count: item.count })),
    visualTags: visualTags.map((item) => ({ label: item._id, count: item.count })),
    timeline,
    peak,
  };
}
