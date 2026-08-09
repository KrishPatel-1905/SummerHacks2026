export const event = {
  id: "summerhacks-2026",
  title: "SummerHacks 2026",
  inviteCode: "583219",
  inviteDisplay: "583 219",
  inviteUrl: "eventcapsule.app/583219",
  memoryCount: 37,
  memoryLimit: 50,
};

export const moods = [
  { emoji: "🙂", label: "Happy", color: "#f6c542" },
  { emoji: "🥹", label: "Emotional", color: "#f6c542" },
  { emoji: "😭", label: "Tearful", color: "#8ccbd0" },
  { emoji: "🤯", label: "Overwhelmed", color: "#f25a47" },
  { emoji: "😴", label: "Tired", color: "#8c6cc4" },
  { emoji: "❤️", label: "Loved", color: "#f25a47" },
  { emoji: "😤", label: "Determined", color: "#f6c542" },
  { emoji: "🥳", label: "Excited", color: "#8dcab5" },
];

export const draftMemory = {
  scene: "concert",
  message: "We actually finished. I’m exhausted and so proud of us.",
  mood: "🥹",
  author: "",
};

export const polaroids = [
  { caption: "What a night! ♡", scene: "concert", tape: "tan", tilt: -5 },
  { caption: "Best day ever ☆", scene: "ferris", tape: "lavender", tilt: 4 },
  { caption: "Our crew ♡", scene: "campfire", tape: "blue", tilt: -3 },
  { caption: "Adventure time △", scene: "mountains", tape: "tan", tilt: 5 },
  { caption: "Unforgettable! ✦", scene: "fireworks", tape: "blue", tilt: -4 },
  { caption: "We did it! ♡", scene: "sunset", tape: "lavender", tilt: 4 },
];

export const envelopePalette = ["cream", "lavender", "mint", "yellow", "coral"];

export const capsuleEnvelopes = [
  { color: "lavender", mark: "AK", doodle: "☆", seal: "planet" },
  { color: "mint", mark: "JM.", doodle: "✿", seal: "smile" },
  { color: "yellow", mark: "CAPSULE", doodle: "♫", seal: "planet" },
  { color: "coral", mark: "♡", doodle: "✧", seal: "heart" },
  { color: "cream", mark: "", doodle: "☆", seal: "smile" },
  { color: "mint", mark: "T + K", doodle: "☄", seal: "star" },
  { color: "lavender", mark: "23", doodle: "✦", seal: "planet" },
  { color: "yellow", mark: "WE DID IT", doodle: "☆", seal: "heart" },
  { color: "cream", mark: "8.08", doodle: "♡", seal: "planet" },
  { color: "coral", mark: "DEMO!", doodle: "☻", seal: "star" },
];

export const mockMemories = [
  {
    id: "1",
    scene: "concert",
    author: "Maya",
    message: "We’re exhausted but I can’t believe we actually finished.",
    mood: "🥹",
    date: "AUG 8",
    relativeTime: "added 42 min ago",
    envelopeColor: "cream",
    envelopeArt: { ink: "#2357d8", phrase: "WE MADE IT!", symbol: "✦", trail: "☆  ⌁  ☆" },
    stamp: "star",
  },
  {
    id: "2",
    scene: "ferris",
    author: "Jordan",
    message: "The tiny wins, late-night pizza, and this crew made it magic.",
    mood: "🥳",
    date: "AUG 8",
    relativeTime: "added 1 hr ago",
    envelopeColor: "lavender",
    envelopeArt: { ink: "#f25a47", phrase: "TINY WINS", symbol: "♡", trail: "·  🍕  ·" },
    stamp: "planet",
  },
  {
    id: "3",
    scene: "campfire",
    author: "Priya",
    message: "Somehow a room full of strangers turned into our team.",
    mood: "❤️",
    date: "AUG 8",
    relativeTime: "added 2 hrs ago",
    envelopeColor: "mint",
    envelopeArt: { ink: "#674bb0", phrase: "OUR TEAM", symbol: "☻", trail: "♡  —  ♡" },
    stamp: "rocket",
  },
  {
    id: "4",
    scene: "fireworks",
    author: "Theo",
    message: "That final demo felt like fireworks going off in my chest.",
    mood: "🤯",
    date: "AUG 8",
    relativeTime: "added 3 hrs ago",
    envelopeColor: "yellow",
    envelopeArt: { ink: "#2357d8", phrase: "DEMO!", symbol: "☄", trail: "///  ✦" },
    stamp: "star",
  },
];

export const mockPulseData = {
  memoryCount: 73,
  moods: [
    { emoji: "🥳", label: "Excited", value: 38, color: "coral" },
    { emoji: "🤯", label: "Overwhelmed", value: 24, color: "lavender" },
    { emoji: "😴", label: "Tired", value: 19, color: "blue" },
    { emoji: "🥹", label: "Emotional", value: 12, color: "mint" },
    { emoji: "😍", label: "Happy", value: 7, color: "yellow" },
  ],
  themes: [
    { label: "CODING", color: "coral" },
    { label: "FRIENDS", color: "lavender" },
    { label: "FOOD", color: "blue" },
    { label: "DEMO", color: "blue" },
    { label: "SLEEP", color: "mint" },
    { label: "WINNING", color: "yellow" },
  ],
  objects: [
    { icon: "💻", label: "Laptops" },
    { icon: "🍕", label: "Food" },
    { icon: "🫂", label: "Friends" },
    { icon: "🏆", label: "Projects" },
  ],
  timeline: [12, 18, 22, 42, 52, 59, 73, 55, 39, 25],
  timelineLabels: ["9 AM", "", "12 PM", "3 PM", "", "6 PM", "8:32 PM", "9 PM", "", "12 AM"],
  peak: "8:32 PM",
  story: "The event started energetic, became increasingly chaotic around dinner, and ended with a strong sense of accomplishment.",
};
