import {
  moods,
  polaroids,
  capsuleEnvelopes,
} from "./mockData.js";

const MEMORY_MESSAGE_MAX_LENGTH = 50;
const today = new Date();
const todayInputValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const appState = {
  screen: "landing",
  modal: null,
  event: null,
  ownerToken: null,
  eventStream: null,
  memories: [],
  pulse: null,
  memoryCount: 0,
  message: "",
  mood: moods[0].emoji,
  author: "",
  photoPreview: null,
  photoFile: null,
  memoryIndex: 0,
  memoryViewerPhase: "sealed",
  memoryViewerTimer: null,
  hasPickedMemory: false,
  busy: false,
  capsuleDraft: {
    name: "",
    startDate: todayInputValue,
    endDate: todayInputValue,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    capacity: 100,
    accentColor: "blue",
    sticker: "tech",
    description: "",
  },
};

const app = document.querySelector("#app");
const toastEl = document.querySelector("#toast");

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PULSE_COLORS = ["coral", "lavender", "blue", "mint", "yellow"];
const CAPSULE_CAPACITIES = [
  { value: 10, label: "CLOSE CIRCLE" },
  { value: 25, label: "SMALL EVENT" },
  { value: 100, label: "BIG EVENT" },
  { value: 250, label: "FULL CROWD" },
];
const CAPSULE_COLORS = {
  blue: { label: "BLUE", value: "#2357d8" },
  coral: { label: "CORAL", value: "#f25a47" },
  yellow: { label: "YELLOW", value: "#f6c542" },
  purple: { label: "PURPLE", value: "#8c6cc4" },
  mint: { label: "MINT", value: "#74bea8" },
};
const CAPSULE_STICKERS = {
  star: { label: "Star", mark: "★" },
  graduation: { label: "Graduation", mark: "⌑" },
  birthday: { label: "Birthday", mark: "♨" },
  tech: { label: "Tech / Hackathon", mark: "⌨" },
  music: { label: "Music", mark: "♫" },
  travel: { label: "Travel", mark: "✈︎" },
  love: { label: "Love", mark: "♥" },
  competition: { label: "Competition", mark: "♛" },
};
const MOOD_EMOJIS = {
  happy: "🙂", emotional: "🥹", relieved: "🥹", sad: "😭", tearful: "😭",
  overwhelmed: "🤯", tired: "😴", loved: "❤️", determined: "😤", excited: "🥳",
};

function inviteDisplay(code = "") {
  return code ? `${code.slice(0, 3)} ${code.slice(3)}` : "";
}

function inviteUrl() {
  return appState.event ? `${window.location.origin}/${appState.event.inviteCode}` : window.location.origin;
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Try again.");
  return payload;
}

function ownerStorageKey(eventId) {
  return `event-capsule-owner:${eventId}`;
}

function getStoredOwnerToken(eventId) {
  try { return localStorage.getItem(ownerStorageKey(eventId)); }
  catch { return null; }
}

function storeOwnerToken(eventId, token) {
  try { localStorage.setItem(ownerStorageKey(eventId), token); }
  catch { /* Owner controls remain available until this page is closed. */ }
}

function removeStoredOwnerToken(eventId) {
  try { localStorage.removeItem(ownerStorageKey(eventId)); }
  catch { /* Nothing else to clean up. */ }
}

function ownerApi(path, options = {}) {
  if (!appState.ownerToken) throw new Error("Owner access is unavailable in this browser.");
  return api(path, {
    ...options,
    headers: { ...(options.headers || {}), "x-owner-token": appState.ownerToken },
  });
}

function capsuleApi(event, path, options = {}) {
  if (!event?.inviteCode) throw new Error("Join a capsule before loading its data.");
  return api(path, {
    ...options,
    headers: { ...(options.headers || {}), "x-capsule-code": event.inviteCode },
  });
}

function formatMemoryDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
}

function relativeTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "added just now";
  if (minutes < 60) return `added ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `added ${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `added ${days} day${days === 1 ? "" : "s"} ago`;
}

function parseCalendarDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatEventDateRange(startValue, endValue, includeYear = true) {
  const start = parseCalendarDate(startValue);
  const end = parseCalendarDate(endValue);
  if (!start || !end) return "PICK YOUR DATES";
  const month = (date) => date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const year = (date) => date.getFullYear();
  if (startValue === endValue) return `${month(start)} ${start.getDate()}${includeYear ? `, ${year(start)}` : ""}`;
  if (year(start) !== year(end)) return `${month(start)} ${start.getDate()}, ${year(start)} — ${month(end)} ${end.getDate()}, ${year(end)}`;
  const ending = `${month(end)} ${end.getDate()}${includeYear ? `, ${year(end)}` : ""}`;
  return `${month(start)} ${start.getDate()} — ${ending}`;
}

function memoryEnvelope(memory) {
  return {
    color: memory.envelopeColor || "cream",
    mark: memory.emoji || "",
    doodle: "✦",
    seal: "planet",
    envelopeDrawing: memory.envelopeDrawing,
  };
}

function Tape(color = "tan", extra = "") {
  return `<span class="tape tape--${color} ${extra}" aria-hidden="true"></span>`;
}

function Doodle(type, extra = "") {
  const marks = { star: "☆", sparkle: "✦", planet: "♄", rocket: "➶", heart: "♡", orbit: "⌁" };
  return `<span class="doodle doodle--${type} ${extra}" aria-hidden="true">${marks[type] || type}</span>`;
}

function HandwrittenHeading(text, options = {}) {
  const { level = 1, className = "", note = "" } = options;
  return `<div class="heading-wrap ${className}"><h${level} class="marker-heading">${esc(text)}</h${level}><span class="marker-stroke" aria-hidden="true"></span>${note ? `<p class="heading-note">${esc(note)}</p>` : ""}</div>`;
}

function HandDrawnButton(label, options = {}) {
  const { tone = "blue", action = "", icon = "", className = "", type = "button", aria = "" } = options;
  return `<button type="${type}" class="paper-button paper-button--${tone} ${className}" ${action} ${aria ? `aria-label="${esc(aria)}"` : ""}>${icon ? `<span class="button-icon" aria-hidden="true">${icon}</span>` : ""}<span>${label}</span></button>`;
}

function SpaceBackground() {
  const organicStars = [
    [4, 8, 1, -8], [11, 23, 2, 14], [18, 7, 1, 2], [27, 18, 3, -12], [34, 5, 1, 5],
    [43, 27, 2, 18], [52, 7, 1, -5], [61, 17, 2, 8], [71, 6, 1, 0], [83, 21, 3, -15],
    [94, 9, 1, 7], [8, 53, 2, -6], [16, 72, 1, 2], [29, 61, 2, 17], [39, 81, 1, -4],
    [48, 57, 3, 9], [58, 74, 1, -13], [67, 49, 2, 3], [76, 88, 1, 12], [88, 62, 2, -7],
    [96, 79, 1, 4], [6, 91, 1, -8], [23, 93, 2, 10], [55, 94, 2, -4], [91, 96, 3, 11],
  ];
  return `<div class="space-background" aria-hidden="true">
    <div class="star-field star-field--one"></div><div class="star-field star-field--two"></div>
    <div class="organic-stars">${organicStars.map(([x, y, s, r], index) => `<i class="organic-star organic-star--${index % 4}" style="--x:${x}%;--y:${y}%;--s:${s};--r:${r}deg"></i>`).join("")}</div>
    <span class="space-spark s1">✦</span><span class="space-spark s2">☆</span><span class="space-spark s3">✧</span>
    <span class="space-planet p1">♄</span><span class="space-planet p2">◌</span>
    <span class="constellation c1">·—·—✦<br>&nbsp;&nbsp;╲&nbsp;&nbsp;╱<br>&nbsp;&nbsp;&nbsp;·</span>
    <span class="orbit-line o1"></span><span class="orbit-line o2"></span>
    <span class="shooting-star shooting-star--one">✦━━╱</span><span class="shooting-star shooting-star--two">☆━━</span>
    <span class="space-doodle space-doodle--saturn"><i></i></span>
    <span class="space-doodle space-doodle--moon">☾<i>·</i></span>
    <span class="space-doodle space-doodle--comet">✦<i></i></span>
    <span class="orbit-curve orbit-curve--one"></span><span class="orbit-curve orbit-curve--two"></span>
    <span class="celestial-note celestial-note--one">tiny moments<br>become stories ↗</span>
  </div>`;
}

function PhotoScene(scene = "concert", className = "", useUserPhoto = false, imageUrl = "") {
  const selectedPhoto = useUserPhoto ? appState.photoPreview : imageUrl;
  const custom = selectedPhoto ? `<img src="${esc(selectedPhoto)}" alt="${useUserPhoto ? "Selected memory preview" : "Memory photo"}" />` : "";
  const photoAssets = {
    concert: "./assets/photo-concert.png",
    ferris: "./assets/photo-ferris.png",
    campfire: "./assets/photo-campfire.png",
    mountains: "./assets/photo-mountains.png",
    fireworks: "./assets/photo-fireworks.png",
    sunset: "./assets/photo-sunset.png",
  };
  const illustratedPhoto = photoAssets[scene] ? `<img class="illustrated-photo" src="${photoAssets[scene]}" alt="" draggable="false" />` : "";
  const crowds = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join("");
  return `<div class="photo-scene photo-scene--${scene} ${className}">
    ${custom || illustratedPhoto || `<div class="scene-glow"></div><div class="scene-detail"></div><div class="scene-crowd">${crowds}</div>`}
  </div>`;
}

function UploadPlaceholder(compact = false) {
  return `<div class="upload-placeholder ${compact ? "upload-placeholder--compact" : ""}" aria-hidden="true">
    <span class="upload-placeholder-icon">＋</span>
    <strong>UPLOAD</strong>
    ${compact ? "" : "<small>click to choose a photo</small>"}
  </div>`;
}

function Polaroid(item, index, location = "landing") {
  return `<article class="polaroid polaroid--${location}-${index + 1}" style="--tilt:${item.tilt}deg">
    ${Tape(item.tape, "polaroid-tape")}
    ${PhotoScene(item.scene)}
    <p>${esc(item.caption)}</p>
    <span class="polaroid-sticker" aria-hidden="true">${["🙂", "❤️", "★", "☻"][index % 4]}</span>
  </article>`;
}

function Envelope(item, index = 0, extra = "") {
  const stamps = ["☆", "♄", "➶", "☾", "✿"];
  const postal = ["≋", "⌁", "///", "···"];
  const drawingSource = item.envelopeDrawing || item.drawing;
  const hasDrawing = Boolean(drawingSource);
  const drawingMarkup = hasDrawing ? `
    <img class="envelope-base-art" src="./assets/leave-your-mark-envelope.png" alt="" draggable="false" />
    <img class="envelope-drawing" src="${esc(drawingSource)}" alt="" draggable="false" />` : `
    <div class="envelope-flap"></div>
    <span class="envelope-sketch envelope-sketch--a">//</span><span class="envelope-sketch envelope-sketch--b">⌁</span>
    ${index % 3 === 0 ? Tape(index % 2 ? "tan" : "blue", "envelope-tape") : ""}
    <span class="envelope-stamp">${stamps[index % stamps.length]}</span>
    <span class="envelope-postal">${postal[index % postal.length]}</span>
    <span class="envelope-mark">${esc(item.mark || "")}</span>
    <span class="envelope-doodle">${esc(item.doodle || "✦")}</span>
    <span class="envelope-seal envelope-seal--${item.seal || "planet"}">${item.seal === "heart" ? "♡" : item.seal === "smile" ? "☺" : item.seal === "star" ? "★" : "♄"}</span>`;
  return `<div class="envelope envelope--${item.color} ${hasDrawing ? "envelope--with-drawing" : ""} ${extra}" style="--envelope-tilt:${(index % 5 - 2) * 3}deg" ${hasDrawing ? 'role="img" aria-label="A hand-drawn memory envelope inside the event capsule"' : ""}>
    ${drawingMarkup}
  </div>`;
}

function CapsuleWindow(items = capsuleEnvelopes) {
  return `<div class="capsule-window capsule-window--art">
    <div class="envelope-stack" aria-label="${items.length ? "Shared memory envelopes" : "An empty capsule waiting for memories"}">
      ${items.map((item, index) => Envelope(item, index)).join("")}
    </div>
    <div class="window-glass"></div>
    <span class="window-shine"></span>
  </div>`;
}

function EventCapsuleMachine(size = "hero") {
  const custom = size === "setup" ? appState.capsuleDraft : size === "event" ? (appState.event || appState.capsuleDraft) : null;
  const items = size === "setup" ? [] : size === "event" ? appState.memories.slice(-10).map(memoryEnvelope) : capsuleEnvelopes;
  const accent = CAPSULE_COLORS[custom?.accentColor]?.value || CAPSULE_COLORS.blue.value;
  const stickerKey = custom?.sticker || "star";
  const sticker = CAPSULE_STICKERS[stickerKey];
  const machineName = custom?.name?.trim() || "YOUR EVENT";
  return `<div class="capsule-machine capsule-machine--${size} ${custom ? "capsule-machine--custom" : ""}" style="--capsule-accent:${accent}" aria-label="Illustrated capsule preview for ${esc(machineName)}">
    <span class="machine-ground-shadow"></span>
    <img class="capsule-art" src="./assets/event-capsule-machine.png" alt="" draggable="false" />
    ${CapsuleWindow(items)}
    ${custom ? `<span class="capsule-accent-paint capsule-accent-paint--base"></span><span class="capsule-accent-paint capsule-accent-paint--support"></span><span class="capsule-accent-bolt">✦</span>` : ""}
    <strong class="capsule-art-label ${machineName.length > 18 ? "is-long" : ""}">${custom ? `<span class="js-setup-name">${esc(machineName)}</span>` : "EVENT<br>CAPSULE"}</strong>
    ${custom ? `<span class="capsule-event-sticker" data-sticker="${stickerKey}" aria-hidden="true"><span class="sticker-icon">${sticker.mark}</span></span>` : ""}
    <span class="capsule-art-scribble capsule-art-scribble--one">///</span>
    <span class="capsule-art-scribble capsule-art-scribble--two">✦</span>
  </div>`;
}

function Mascot(type, label) {
  if (type === "star") return `<div class="mascot mascot--star" aria-label="${label}"><span>★</span><i>•‿•</i></div>`;
  return `<div class="mascot mascot--${type}" aria-label="${label}">
    <span class="mascot-head"><i>${type === "robot" ? "•ᴗ•" : type === "alien" ? "●‿●" : ""}</i></span>
    <span class="mascot-body">${type === "astronaut" ? "▣" : type === "robot" ? "♡" : ""}</span>
    <span class="mascot-feet"></span>
  </div>`;
}

function LandingScreen() {
  return `<main id="landing-screen" class="screen landing-screen ${appState.screen === "landing" ? "is-active" : ""}" data-screen="landing">
    <div class="landing-polaroids landing-polaroids--left">${polaroids.slice(0, 3).map((p, i) => Polaroid(p, i)).join("")}</div>
    <div class="landing-polaroids landing-polaroids--right">${polaroids.slice(3).map((p, i) => Polaroid(p, i + 3)).join("")}</div>
    <section class="landing-core">
      ${HandwrittenHeading("EVENT\nCAPSULE", { className: "landing-title" })}
      <p class="landing-tagline"><span>Capture this moment together.</span></p>
      <p class="capsule-note capsule-note--left">memories<br>float here <span>↗</span></p>
      <p class="capsule-note capsule-note--right">look inside <span>✦</span></p>
      ${EventCapsuleMachine("hero")}
      <div class="landing-actions">
        ${HandDrawnButton("CREATE CAPSULE", { tone: "blue", icon: "◉", action: 'data-nav="setup"' })}
        <p class="join-label"><span>Already have a code?</span></p>
        <form class="join-form" id="join-form">
          <label class="sr-only" for="invite-code">Invite code</label>
          <input id="invite-code" name="inviteCode" inputmode="numeric" maxlength="7" placeholder="583 219" autocomplete="one-time-code" aria-describedby="join-error" />
          ${HandDrawnButton(appState.busy ? "FINDING..." : "JOIN", { tone: "coral", type: "submit" })}
          <p class="form-error join-error" id="join-error" aria-live="polite"></p>
        </form>
      </div>
    </section>
    <div class="landing-mascots mascot-group--left">
      <img src="./assets/mascot-crew-left.png" alt="A waving astronaut and friendly alien mascot" draggable="false" />
    </div>
    <div class="landing-mascots mascot-group--right">
      <img src="./assets/mascot-crew-right.png" alt="A friendly robot and smiling star mascot" draggable="false" />
    </div>
  </main>`;
}

function CapsuleCapacityPicker() {
  return `<div class="capacity-picker" role="group" aria-label="Capsule capacity">
    ${CAPSULE_CAPACITIES.map((option) => `<button type="button" class="capacity-option ${appState.capsuleDraft.capacity === option.value ? "is-selected" : ""}" data-setup-capacity="${option.value}" aria-pressed="${appState.capsuleDraft.capacity === option.value}">
      <strong>${option.value}</strong><span>${option.label}</span><i aria-hidden="true">✦</i>
    </button>`).join("")}
  </div>`;
}

function AccentColorPicker() {
  return `<div class="accent-picker" role="group" aria-label="Capsule accent color">
    ${Object.entries(CAPSULE_COLORS).map(([key, color]) => `<button type="button" class="accent-option ${appState.capsuleDraft.accentColor === key ? "is-selected" : ""}" style="--swatch:${color.value}" data-setup-accent="${key}" aria-label="${color.label}" aria-pressed="${appState.capsuleDraft.accentColor === key}"><i></i><span>${color.label}</span></button>`).join("")}
  </div>`;
}

function EventStickerPicker() {
  return `<div class="sticker-picker" role="group" aria-label="Event sticker">
    ${Object.entries(CAPSULE_STICKERS).map(([key, sticker]) => `<button type="button" class="sticker-option ${appState.capsuleDraft.sticker === key ? "is-selected" : ""}" data-setup-sticker="${key}" aria-pressed="${appState.capsuleDraft.sticker === key}"><span class="sticker-icon sticker-icon--${key}" aria-hidden="true">${sticker.mark}</span><span>${sticker.label}</span></button>`).join("")}
  </div>`;
}

function SetupFieldHeading(text, note = "") {
  return `<div class="setup-field-heading"><h2>${text}</h2>${note ? `<span>${note}</span>` : ""}</div>`;
}

function CapsuleLivePreview() {
  const draft = appState.capsuleDraft;
  return `<aside class="setup-preview" aria-label="Live capsule preview">
    <div class="preview-heading"><span>LIVE PREVIEW</span><i aria-hidden="true">✦</i></div>
    <div class="preview-orbit" aria-hidden="true"></div>
    ${EventCapsuleMachine("setup")}
    <div class="preview-tags">
      <p class="preview-date-tag"><span aria-hidden="true">☆</span><strong class="js-setup-date">${formatEventDateRange(draft.startDate, draft.endDate)}</strong></p>
      <p class="preview-capacity-tag"><small>CAPACITY</small><strong class="js-setup-capacity">${draft.capacity} memories</strong></p>
    </div>
    <button type="button" class="surprise-button" data-surprise="true">SURPRISE ME <span aria-hidden="true">✦</span></button>
    <p class="preview-whisper" aria-hidden="true">waiting for memories <span>↗</span></p>
    <div class="activation-sparkles" aria-hidden="true"><i>✦</i><i>☆</i><i>✧</i><i>✦</i><i>·</i></div>
  </aside>`;
}

function CreateCapsuleScreen() {
  const draft = appState.capsuleDraft;
  return `<main id="setup-screen" class="screen setup-screen ${appState.screen === "setup" ? "is-active" : ""}" data-screen="setup">
    <button type="button" class="setup-back" data-nav="landing"><span aria-hidden="true">←</span> BACK</button>
    <form id="capsule-setup-form" class="setup-layout" novalidate>
      <section class="setup-sheet">
        <header class="setup-intro">
          ${Tape("tan", "setup-tape")}
          ${HandwrittenHeading("CREATE YOUR CAPSULE", { level: 1, className: "setup-title", note: "make a home for this moment ✦" })}
          <span class="setup-title-stars" aria-hidden="true">☆ &nbsp; ✦</span>
        </header>

        <section class="setup-field setup-field--name" data-setup-field="name">
          ${SetupFieldHeading("WHAT ARE WE CALLING IT?")}
          <label class="paper-input-wrap" for="setup-event-name"><span class="sr-only">Event name</span><input id="setup-event-name" name="name" maxlength="80" autocomplete="off" value="${esc(draft.name)}" /></label>
          <p class="setup-error js-error-name" aria-live="polite"></p>
        </section>

        <section class="setup-field setup-field--dates" data-setup-field="dates">
          ${SetupFieldHeading("WHEN IS IT HAPPENING?")}
          <span class="calendar-doodle" aria-hidden="true">□<i>8</i><b>✦</b></span>
          <div class="date-pair">
            <label><span>STARTS</span><input id="setup-start-date" name="startDate" type="date" value="${esc(draft.startDate)}" /></label>
            <span class="date-arrow" aria-hidden="true">↝</span>
            <label><span>ENDS</span><input id="setup-end-date" name="endDate" type="date" value="${esc(draft.endDate)}" /></label>
          </div>
          <p class="setup-error js-error-dates" aria-live="polite"></p>
        </section>

        <section class="setup-field setup-field--capacity" data-setup-field="capacity">
          ${SetupFieldHeading("HOW BIG SHOULD IT BE?")}
          ${CapsuleCapacityPicker()}
          <p class="setup-error js-error-capacity" aria-live="polite"></p>
        </section>

        <section class="setup-field setup-field--accent" data-setup-field="accentColor">
          ${SetupFieldHeading("PICK YOUR COLOR")}
          ${AccentColorPicker()}
          <p class="setup-error js-error-accent" aria-live="polite"></p>
        </section>

        <section class="setup-field setup-field--sticker" data-setup-field="sticker">
          ${SetupFieldHeading("PICK YOUR MARK")}
          ${EventStickerPicker()}
          <p class="setup-error js-error-sticker" aria-live="polite"></p>
        </section>

        <section class="setup-field setup-field--description" data-setup-field="description">
          ${SetupFieldHeading("LEAVE A LITTLE NOTE", "optional")}
          <label class="paper-textarea-wrap" for="setup-description"><span class="sr-only">Short event description</span><textarea id="setup-description" name="description" maxlength="120" placeholder="Our shared SummerHacks memory capsule.">${esc(draft.description)}</textarea></label>
          <span class="description-count"><b class="js-description-count">${draft.description.length}</b>/120</span>
        </section>

        <div class="setup-submit-wrap">
          ${HandDrawnButton("CREATE CAPSULE →", { tone: "blue", type: "submit", className: "setup-submit" })}
          <p>ready in a tiny cosmic moment ✦</p>
        </div>
      </section>
      ${CapsuleLivePreview()}
    </form>
  </main>`;
}

function EventScreen() {
  const currentEvent = appState.event;
  const capacity = currentEvent?.capacity || appState.capsuleDraft.capacity;
  const capsuleFull = appState.memoryCount >= capacity;
  const acceptsMemories = currentEvent?.status === "open" && !capsuleFull;
  const dateLabel = currentEvent ? formatEventDateRange(currentEvent.startDate, currentEvent.endDate) : "";
  return `<main id="event-screen" class="screen event-screen ${appState.screen === "event" ? "is-active" : ""}" data-screen="event">
    <header class="event-header">
      <div>
        ${HandwrittenHeading(currentEvent?.name || "opening capsule...", { level: 1, className: "event-title" })}
        <p class="memory-count"><span id="memory-count" data-memory-total>${appState.memoryCount}</span> / ${capacity} memories so far!</p>
        ${currentEvent ? `<div class="event-keepsake-meta"><strong>${esc(dateLabel)}</strong>${currentEvent.description ? `<span>${esc(currentEvent.description)}</span>` : ""}${currentEvent.status !== "open" ? `<span class="event-status">${esc(currentEvent.status)}</span>` : ""}</div>` : ""}
      </div>
      ${HandDrawnButton("SHARE ↗", { tone: "paper", className: "share-button", action: 'data-open="invite"' })}
    </header>
    <section class="event-machine-wrap">
      ${EventCapsuleMachine("event")}
      ${Mascot("star", "Smiling star mascot")}
    </section>
    <section class="event-actions" aria-label="Event actions">
      ${HandDrawnButton(capsuleFull ? "CAPSULE FULL" : currentEvent?.status !== "open" ? "CAPSULE CLOSED" : "ADD YOUR MEMORY", { tone: "coral", icon: "+", action: `${acceptsMemories ? 'data-open="add"' : 'disabled aria-disabled="true"'} data-add-memory` })}
      ${HandDrawnButton("PICK A MEMORY", { tone: "yellow", icon: "✦", action: 'data-open="viewer"' })}
      <button class="text-link" data-nav="pulse">EVENT PULSE <span>→</span></button>
    </section>
  </main>`;
}

function PaperModal(content, name, extra = "") {
  return `<section class="modal-layer ${extra}" data-modal="${name}" aria-hidden="true">
    <div class="modal-scrim" data-close="${name}"></div>
    <div class="paper-modal" role="dialog" aria-modal="true">
      ${Tape("tan", "modal-tape")}
      <button class="close-button" data-close="${name}" aria-label="Close">×</button>
      ${content}
    </div>
  </section>`;
}

function MoodPicker() {
  return `<div class="mood-picker" role="radiogroup" aria-label="Choose a mood">
    ${moods.map((mood) => `<button class="mood-option ${appState.mood === mood.emoji ? "is-selected" : ""}" data-mood="${mood.emoji}" role="radio" aria-checked="${appState.mood === mood.emoji}" title="${esc(mood.label)}"><span>${mood.emoji}</span><i></i></button>`).join("")}
  </div>`;
}

function PostcardPreview() {
  return `<article class="postcard postcard--preview">
    ${Tape("coral", "postcard-tape")}
    <label class="postcard-photo js-user-photo" for="photo-input" aria-label="Choose a photo from your computer">${appState.photoPreview ? `<img src="${esc(appState.photoPreview)}" alt="Selected memory preview" />` : UploadPlaceholder(true)}</label>
    <div class="postcard-copy">
      <span class="postal-lines" aria-hidden="true">〰〰〰</span>
      <span class="stamp">☆</span>
      <p class="js-preview-message">${esc(appState.message || "Your memory goes here…")}</p>
      <span class="postcard-author js-preview-author">— ${esc(appState.author.trim() || "Anonymous")}</span>
      <span class="mood-sticker js-preview-mood">${appState.mood}</span>
    </div>
  </article>`;
}

function AddMemoryModal() {
  const content = `<div class="modal-content add-memory-content">
    ${HandwrittenHeading("ADD YOUR MEMORY", { level: 2, className: "modal-title" })}
    ${Doodle("star", "title-doodle")}
    <div class="add-memory-grid">
      <section class="add-photo-column">
        <h3>PHOTO</h3>
        <label class="polaroid upload-polaroid" for="photo-input" aria-label="Upload a photo from your computer">${Tape("blue", "polaroid-tape")}<div class="photo-scene photo-scene--upload js-user-photo">${appState.photoPreview ? `<img src="${esc(appState.photoPreview)}" alt="Selected memory preview" />` : UploadPlaceholder()}</div>${Tape("blue", "corner-tape")}</label>
        <label class="change-photo" for="photo-input"><span aria-hidden="true">▣</span> CHANGE PHOTO</label>
        <input class="sr-only" id="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
      </section>
      <section class="add-details-column">
        <label for="memory-author">Your name <span class="optional-label">(optional)</span></label>
        <input id="memory-author" type="text" maxlength="9" autocomplete="name" placeholder="e.g. Alex" value="${esc(appState.author)}" />
        <label for="memory-message">What’s on your mind right now?</label>
        <textarea id="memory-message" maxlength="${MEMORY_MESSAGE_MAX_LENGTH}" placeholder="Write a short memory…">${esc(appState.message)}</textarea>
        <h3>MOOD</h3>
        ${MoodPicker()}
      </section>
      <section class="preview-column">
        <h3>LIVE POSTCARD PREVIEW</h3>
        ${PostcardPreview()}
      </section>
    </div>
    <p class="form-error memory-error" id="memory-error" aria-live="polite"></p>
    ${HandDrawnButton("NEXT", { tone: "blue", icon: "→", className: "add-next", action: 'data-next="draw"' })}
  </div>`;
  return PaperModal(content, "add", "add-modal");
}

function DrawingToolbar() {
  const tools = [
    ["pencil", "✎", "PENCIL"], ["marker", "▰", "MARKER"], ["eraser", "▱", "ERASER"],
    ["undo", "↶", "UNDO"], ["clear", "⌫", "CLEAR"],
  ];
  const colors = ["#141414", "#2357d8", "#8c6cc4", "#36b9cb", "#f25a47", "#f6b915"];
  return `<div class="drawing-toolbar" aria-label="Drawing tools">
    <div class="drawing-tools">${tools.map(([tool, icon, label], index) => `<button class="draw-tool ${index === 0 ? "is-active" : ""}" data-tool="${tool}"><span>${icon}</span><small>${label}</small></button>`).join("")}</div>
    <div class="drawing-colors">${colors.map((color, index) => `<button class="draw-color ${index === 1 ? "is-active" : ""}" data-color="${color}" style="--swatch:${color}" aria-label="Use ${color}"></button>`).join("")}</div>
  </div>`;
}

function EnvelopeCustomizer() {
  return `<div class="custom-envelope-wrap">
    <div class="custom-envelope">
      <img class="custom-envelope-art" src="./assets/leave-your-mark-envelope.png" alt="" draggable="false" />
      <canvas id="drawing-canvas" aria-label="Draw on your envelope"></canvas>
      <span class="custom-seal"><i>♄</i></span>
    </div>
  </div>`;
}

function DrawModal() {
  const content = `<div class="modal-content draw-content">
    ${HandwrittenHeading("LEAVE YOUR MARK", { level: 2, className: "modal-title draw-title", note: "draw anything you want" })}
    <div class="draw-layout">
      <aside class="draw-instructions" aria-label="How a memory is packed">
        <div class="mini-postcard">${Tape("tan")}<span class="mini-photo">${PhotoScene("concert")}</span><span class="mini-stamp">☆</span><i>♡</i><b>three lines<br>of a memory</b></div>
        <span class="diagram-arrow">↘</span>
        <div class="mini-envelope"><span class="mini-letter">✦ &nbsp; ♡<br>_____</span><i>♄</i></div>
        <p>your postcard<br><strong>goes inside</strong></p>
      </aside>
      <section class="drawing-stage">${EnvelopeCustomizer()}${DrawingToolbar()}</section>
      <aside class="send-panel">
        ${HandDrawnButton(appState.busy ? "SENDING MEMORY..." : "SEND TO CAPSULE", { tone: "coral", icon: "➶", action: 'data-send="true"' })}
        <button class="skip-button" data-send="true" data-skip-drawing="true">SKIP</button>
        <p class="form-error draw-error" id="draw-error" aria-live="polite"></p>
      </aside>
    </div>
  </div>`;
  return PaperModal(content, "draw", "draw-modal");
}

function MemoryPostcard(memory) {
  return `<article class="memory-postcard" tabindex="-1" aria-label="Postcard from ${esc(memory.author || "Anonymous")}">
    <div class="memory-photo-frame">${Tape("blue", "memory-photo-tape")}${PhotoScene("", "", false, memory.imageUrl)}</div>
    <div class="memory-copy">
      <span class="mood-sticker">${esc(memory.emoji)}</span>
      <span class="stamp stamp--memory">♄</span>
      <p>${esc(memory.message)}</p>
      <span class="memory-author">— ${esc(memory.author || "Anonymous")}</span>
      <span class="writing-lines"></span>
      <div class="memory-meta"><span>♄ ✧</span><span><strong>${formatMemoryDate(memory.createdAt)}</strong><br>${relativeTime(memory.createdAt)}</span></div>
    </div>
  </article>`;
}

function SealedMemoryEnvelope(memory) {
  const art = {
    ink: "#2357d8",
    phrase: "A LITTLE MEMORY",
    symbol: memory.emoji || "✦",
    trail: "⌁  ·  ☆",
  };
  const drawing = memory.envelopeDrawing
    ? `<img class="viewer-drawing-image" src="${esc(memory.envelopeDrawing)}" alt="Drawing by ${esc(memory.author || "Anonymous")}" />`
    : `<span class="viewer-drawing-symbol">${esc(art.symbol)}</span>
      <span class="viewer-drawing-phrase">${esc(art.phrase)}</span>
      <span class="viewer-drawing-trail">${esc(art.trail)}</span>
      <span class="viewer-drawing-orbit"></span>`;

  return `<button class="sealed-memory-envelope envelope--${memory.envelopeColor || "cream"}" data-rip-memory style="--drawing-ink:${art.ink}" aria-describedby="memory-viewer-hint" aria-label="Rip open ${esc(memory.author || "this guest")}'s envelope">
    <span class="sealed-envelope-shadow" aria-hidden="true"></span>
    <img class="sealed-envelope-art" src="./assets/leave-your-mark-envelope.png" alt="" draggable="false" />
    <span class="viewer-envelope-drawing">${drawing}</span>
    <span class="envelope-from">FROM ${esc((memory.author || "ANONYMOUS").toUpperCase())}</span>
    <span class="rip-strip" aria-hidden="true"><i></i><b>RIP HERE</b><em>→</em></span>
    <span class="tear-scrap tear-scrap--one" aria-hidden="true"></span>
    <span class="tear-scrap tear-scrap--two" aria-hidden="true"></span>
  </button>`;
}

function OpenedMemoryEnvelope(memory) {
  return `<div class="revealed-memory-postcard">${MemoryPostcard(memory)}</div>`;
}

function MemoryViewer() {
  const memory = appState.memories[appState.memoryIndex];
  const stage = memory
    ? SealedMemoryEnvelope(memory)
    : `<article class="memory-postcard empty-memory"><p>No memories have been sent yet.<br><small>Be the first to add one ✦</small></p></article>`;
  const navigationState = memory ? "" : "disabled aria-disabled=\"true\"";
  return `<section class="modal-layer memory-layer" data-modal="viewer" aria-hidden="true">
    <div class="modal-scrim" data-close="viewer"></div>
    <button class="close-button viewer-close" data-close="viewer" aria-label="Close memory viewer">×</button>
    ${HandDrawnButton("PREV ENVELOPE", { tone: "paper", icon: "←", className: "memory-nav memory-nav--prev", action: `data-memory-nav="-1" ${navigationState}` })}
    <div class="memory-viewer-center">
      <div class="memory-viewer-heading" aria-hidden="true"><span>✦</span><strong>A MEMORY FOUND YOU</strong><span>✦</span></div>
      <div class="memory-envelope-stage" id="memory-envelope-stage">${stage}</div>
      <p class="memory-viewer-hint" id="memory-viewer-hint">${memory ? "Click the envelope to rip it open <span>↗</span>" : "Waiting for the first memory ✦"}</p>
      <p class="memory-viewer-count" id="memory-viewer-count">${memory ? `ENVELOPE ${appState.memoryIndex + 1} / ${appState.memories.length}` : "NO ENVELOPES YET"}</p>
    </div>
    ${HandDrawnButton("NEXT ENVELOPE", { tone: "paper", icon: "→", className: "memory-nav memory-nav--next", action: `data-memory-nav="1" ${navigationState}` })}
  </section>`;
}

function InviteModal() {
  const currentEvent = appState.event;
  const code = currentEvent?.inviteCode || "------";
  const content = `<div class="modal-content invite-content">
    ${HandwrittenHeading("INVITE EVERYONE", { level: 2, className: "modal-title" })}${Doodle("star", "title-doodle")}
    <div class="invite-grid">
      <section class="qr-side"><p class="scan-note">scan<br>me! <span>↘</span></p><div class="qr-card">${currentEvent ? `<img class="event-qr" src="/api/events/${esc(currentEvent.id)}/qr?code=${encodeURIComponent(currentEvent.inviteCode)}" alt="QR code for this event capsule" />` : ""}</div>${Mascot("astronaut", "Astronaut pointing to event QR code")}</section>
      <section class="code-side"><h3>INVITE CODE</h3><div class="invite-code">${inviteDisplay(code)}</div><div class="invite-url"><span>♄</span>${esc(inviteUrl().replace(/^https?:\/\//, ""))}</div>
        ${HandDrawnButton("COPY CODE", { tone: "blue", icon: "▣", action: 'data-copy="code"' })}
        ${HandDrawnButton("COPY LINK", { tone: "paper", icon: "↗", action: 'data-copy="link"' })}
        ${appState.ownerToken ? `<div class="owner-controls"><h3>OWNER CONTROLS</h3>
          ${HandDrawnButton(currentEvent.status === "open" ? "CLOSE CAPSULE" : "REOPEN CAPSULE", { tone: "paper", action: 'data-owner-action="toggle-status"' })}
          ${HandDrawnButton("NEW INVITE CODE", { tone: "paper", action: 'data-owner-action="rotate-code"' })}
        </div>` : ""}
      </section>
    </div>
  </div>`;
  return PaperModal(content, "invite", "invite-modal");
}

function MoodRows() {
  const rows = appState.pulse?.moods || [];
  if (!rows.length) return `<div class="pulse-empty">✦ mood analysis pending</div>`;
  return rows.slice(0, 5).map((mood, index) => `<div class="pulse-mood-row"><span class="pulse-emoji">${MOOD_EMOJIS[mood.label] || "✦"}</span><span class="pulse-mood-label">${esc(mood.label)}</span><strong>${mood.percentage}%</strong><span class="marker-bar marker-bar--${PULSE_COLORS[index % PULSE_COLORS.length]}" style="--value:${mood.percentage}"><i></i></span></div>`).join("");
}

function EventPulseScreen() {
  const pulse = appState.pulse || { memoryCount: appState.memoryCount, moods: [], themes: [], visualTags: [], timeline: [], peak: null, analyzedMemoryCount: 0, pendingAnalysisCount: 0, analysisCoverage: 0, story: "" };
  const themes = pulse.themes.length ? pulse.themes.slice(0, 6) : [{ label: "analysis pending" }];
  const objects = pulse.visualTags.length ? pulse.visualTags.slice(0, 4) : [{ label: "pending", empty: true }];
  const peakLabel = pulse.peak ? new Date(pulse.peak.bucket).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "waiting...";
  const story = pulse.story || "The capsule is waiting for its first memory.";
  return `<main id="pulse-screen" class="screen pulse-screen ${appState.screen === "pulse" ? "is-active" : ""}" data-screen="pulse">
    <section class="notebook">
      ${Tape("tan", "notebook-tape notebook-tape--left")}${Tape("tan", "notebook-tape notebook-tape--right")}
      <div class="notebook-page notebook-page--left">
        ${HandwrittenHeading("EVENT PULSE", { level: 1, className: "pulse-title", note: "what did today feel like?" })}
        <div class="memory-total"><strong>${pulse.memoryCount}</strong> Memories</div>
        <p class="pulse-coverage">${pulse.analysisCoverage}% analyzed${pulse.pendingAnalysisCount ? ` · ${pulse.pendingAnalysisCount} pending` : ""}</p>
        <h2 class="scribble-subhead">How the room felt</h2>${MoodRows()}
        <h2 class="scribble-subhead">What everyone talked about</h2>
        <div class="theme-cloud">${themes.map((theme, index) => `<span class="theme theme--${PULSE_COLORS[index % PULSE_COLORS.length]}">${esc(theme.label.toUpperCase())}</span>`).join("")}</div>
      </div>
      <div class="notebook-page notebook-page--right">
        <h2 class="scribble-subhead">What kept showing up</h2>
        <div class="pulse-objects">${objects.map((obj) => `<div><span>${obj.empty ? "✦" : "◉"}</span><p>${esc(obj.label)}</p></div>`).join("")}</div>
        <div class="timeline-head"><h2 class="scribble-subhead">Memories through the day</h2><p>Peak moment:<br><strong>${esc(peakLabel)}</strong></p></div>
        <canvas id="pulse-chart" aria-label="Memories through the day line chart"></canvas>
        <article class="story-card">${Tape("tan", "story-tape")}<h2>☆ The Story of the Day</h2><p>${esc(story)}</p><span>♡</span></article>
        <button class="text-link pulse-back" data-nav="event">← BACK TO CAPSULE</button>
      </div>
    </section>
  </main>`;
}

function renderApp() {
  app.innerHTML = `${SpaceBackground()}<div class="app-shell">${LandingScreen()}${CreateCapsuleScreen()}${EventScreen()}${EventPulseScreen()}</div>${AddMemoryModal()}${DrawModal()}${MemoryViewer()}${InviteModal()}`;
  if (appState.screen === "pulse") requestAnimationFrame(drawPulseChart);
}

function showScreen(name) {
  if (!["landing", "setup"].includes(name) && !appState.event) return;
  appState.screen = name;
  document.querySelectorAll("[data-screen]").forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "pulse") requestAnimationFrame(drawPulseChart);
}

function validateCapsuleSetup() {
  const draft = appState.capsuleDraft;
  const errors = {};
  if (!draft.name.trim()) errors.name = "✦ give your capsule a name";
  if (!draft.startDate) errors.dates = "✦ pick a start date";
  else if (!draft.endDate) errors.dates = "✦ pick an end date";
  else if (draft.endDate < draft.startDate) errors.dates = "✦ end date can't be before the start";
  if (!CAPSULE_CAPACITIES.some((option) => option.value === Number(draft.capacity))) errors.capacity = "✦ choose how many memories it can hold";
  if (!CAPSULE_COLORS[draft.accentColor]) errors.accent = "✦ pick a capsule color";
  if (!CAPSULE_STICKERS[draft.sticker]) errors.sticker = "✦ pick a little mark";
  return errors;
}

function showSetupErrors(errors = {}) {
  const targets = {
    name: ".js-error-name",
    dates: ".js-error-dates",
    capacity: ".js-error-capacity",
    accent: ".js-error-accent",
    sticker: ".js-error-sticker",
  };
  Object.entries(targets).forEach(([key, selector]) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = errors[key] || "";
  });
}

function updateCapsuleSetupPreview() {
  const draft = appState.capsuleDraft;
  const name = draft.name.trim() || "YOUR EVENT";
  const dateInvalid = draft.startDate && draft.endDate && draft.endDate < draft.startDate;
  const dateTag = document.querySelector(".preview-date-tag");
  document.querySelectorAll(".capsule-machine--setup .js-setup-name").forEach((node) => { node.textContent = name; });
  document.querySelector(".capsule-machine--setup .capsule-art-label")?.classList.toggle("is-long", name.length > 18);
  document.querySelectorAll(".js-setup-date").forEach((node) => { node.textContent = dateInvalid ? "CHECK YOUR DATES" : formatEventDateRange(draft.startDate, draft.endDate); });
  dateTag?.classList.toggle("is-invalid", Boolean(dateInvalid));
  document.querySelectorAll(".js-setup-capacity").forEach((node) => { node.textContent = `${draft.capacity} memories`; });
  const machine = document.querySelector(".capsule-machine--setup");
  machine?.style.setProperty("--capsule-accent", CAPSULE_COLORS[draft.accentColor]?.value || CAPSULE_COLORS.blue.value);
  if (machine) machine.setAttribute("aria-label", `Illustrated capsule preview for ${name}`);
  const machineSticker = machine?.querySelector(".capsule-event-sticker");
  if (machineSticker) {
    const sticker = CAPSULE_STICKERS[draft.sticker] || CAPSULE_STICKERS.star;
    machineSticker.dataset.sticker = draft.sticker;
    machineSticker.querySelector(".sticker-icon").textContent = sticker.mark;
  }
  document.querySelectorAll("[data-setup-capacity]").forEach((button) => {
    const selected = Number(button.dataset.setupCapacity) === Number(draft.capacity);
    button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll("[data-setup-accent]").forEach((button) => {
    const selected = button.dataset.setupAccent === draft.accentColor;
    button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll("[data-setup-sticker]").forEach((button) => {
    const selected = button.dataset.setupSticker === draft.sticker;
    button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected));
  });
  const count = document.querySelector(".js-description-count");
  if (count) count.textContent = String(draft.description.length);
  const errors = validateCapsuleSetup();
  showSetupErrors({ dates: errors.dates });
}

function surpriseCapsule() {
  const differentChoice = (choices, current) => {
    const remaining = choices.filter((choice) => choice !== current);
    return remaining[Math.floor(Math.random() * remaining.length)] || current;
  };
  appState.capsuleDraft.accentColor = differentChoice(Object.keys(CAPSULE_COLORS), appState.capsuleDraft.accentColor);
  appState.capsuleDraft.sticker = differentChoice(Object.keys(CAPSULE_STICKERS), appState.capsuleDraft.sticker);
  updateCapsuleSetupPreview();
  const machine = document.querySelector(".setup-preview .capsule-machine");
  machine?.classList.add("is-surprised");
  setTimeout(() => machine?.classList.remove("is-surprised"), 520);
}

async function createFrontendCapsule() {
  if (appState.busy) return;
  const errors = validateCapsuleSetup();
  showSetupErrors(errors);
  if (Object.keys(errors).length) {
    const focusTarget = errors.name ? "#setup-event-name" : errors.dates ? "#setup-start-date" : errors.capacity ? "[data-setup-capacity]" : errors.accent ? "[data-setup-accent]" : "[data-setup-sticker]";
    document.querySelector(focusTarget)?.focus();
    return;
  }
  const screen = document.querySelector("#setup-screen");
  const submit = document.querySelector(".setup-submit");
  screen?.classList.add("is-creating");
  screen?.setAttribute("aria-busy", "true");
  if (submit) { submit.disabled = true; submit.querySelector("span:last-child").textContent = "ACTIVATING..."; }
  appState.busy = true;
  showToast("creating capsule...");
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 1050;
  const draft = { ...appState.capsuleDraft, name: appState.capsuleDraft.name.trim(), description: appState.capsuleDraft.description.trim() };
  try {
    const [{ event, ownerToken }] = await Promise.all([
      api("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }),
      new Promise((resolve) => setTimeout(resolve, delay)),
    ]);
    appState.ownerToken = ownerToken;
    storeOwnerToken(event.id, ownerToken);
    appState.busy = false;
    await enterEvent(event, { announce: "Your capsule is ready for memories! ✦" });
  } catch (error) {
    screen?.classList.remove("is-creating");
    screen?.removeAttribute("aria-busy");
    if (submit) { submit.disabled = false; submit.querySelector("span:last-child").textContent = "CREATE CAPSULE →"; }
    showToast(error.message || "Capsule couldn’t be created. Try again.");
  } finally {
    appState.busy = false;
  }
}

function openModal(name) {
  const capacity = appState.event?.capacity || appState.capsuleDraft.capacity;
  if (name === "add" && (appState.memoryCount >= capacity || appState.event?.status !== "open")) {
    showToast(appState.event?.status !== "open" ? "This capsule is not accepting memories." : `This capsule is full at ${capacity} memories.`);
    return;
  }
  appState.modal = name;
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (!modal) return;
  if (name === "viewer") prepareMemoryViewer(true);
  modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false"); document.body.classList.add("modal-open");
  if (name === "draw") requestAnimationFrame(setupDrawingCanvas);
  modal.querySelector(name === "viewer" ? "[data-rip-memory], .viewer-close" : "button, input, textarea")?.focus({ preventScroll: true });
}

function closeModal(name) {
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (!modal) return;
  if (name === "viewer") {
    clearTimeout(appState.memoryViewerTimer);
    appState.memoryViewerPhase = "sealed";
  }
  modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true");
  appState.modal = null; document.body.classList.remove("modal-open");
}

function showToast(message) {
  toastEl.textContent = message; toastEl.classList.add("is-visible");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toastEl.classList.remove("is-visible"), 2400);
}

function updatePreviews() {
  document.querySelectorAll(".js-preview-message").forEach((node) => { node.textContent = appState.message || "Your memory goes here…"; });
  document.querySelectorAll(".js-preview-author").forEach((node) => { node.textContent = `— ${appState.author.trim() || "Anonymous"}`; });
  document.querySelectorAll(".js-preview-mood").forEach((node) => { node.textContent = appState.mood; });
  document.querySelectorAll(".mood-option").forEach((button) => {
    const selected = button.dataset.mood === appState.mood;
    button.classList.toggle("is-selected", selected); button.setAttribute("aria-checked", selected ? "true" : "false");
  });
  if (appState.photoPreview) document.querySelectorAll(".js-user-photo").forEach((node) => { node.innerHTML = `<img src="${esc(appState.photoPreview)}" alt="Selected memory preview" />`; });
}

function updateMemoryTotals() {
  document.querySelectorAll("[data-memory-total]").forEach((node) => { node.textContent = appState.memoryCount; });
  const addButton = document.querySelector("[data-add-memory]");
  if (!addButton) return;
  const capacity = appState.event?.capacity || appState.capsuleDraft.capacity;
  const capsuleFull = appState.memoryCount >= capacity;
  addButton.disabled = capsuleFull;
  addButton.setAttribute("aria-disabled", capsuleFull ? "true" : "false");
  if (capsuleFull) addButton.removeAttribute("data-open");
  else addButton.setAttribute("data-open", "add");
  const label = addButton.querySelector("span:last-child");
  if (label) label.textContent = capsuleFull ? "CAPSULE FULL" : "ADD YOUR MEMORY";
}

function randomMemoryIndex() {
  if (!appState.memories.length) return 0;
  if (appState.memories.length < 2 || !appState.hasPickedMemory) return Math.floor(Math.random() * appState.memories.length);
  const offset = 1 + Math.floor(Math.random() * (appState.memories.length - 1));
  return (appState.memoryIndex + offset) % appState.memories.length;
}

function updateMemoryViewerDetails(message = "Click the envelope to rip it open") {
  const hint = document.querySelector("#memory-viewer-hint");
  const count = document.querySelector("#memory-viewer-count");
  if (hint) hint.innerHTML = appState.memories.length ? `${esc(message)} <span aria-hidden="true">↗</span>` : "Waiting for the first memory ✦";
  if (count) count.textContent = appState.memories.length ? `ENVELOPE ${appState.memoryIndex + 1} / ${appState.memories.length}` : "NO ENVELOPES YET";
}

function prepareMemoryViewer(pickRandom = false) {
  clearTimeout(appState.memoryViewerTimer);
  const stage = document.querySelector("#memory-envelope-stage");
  if (!appState.memories.length) {
    appState.memoryIndex = 0;
    appState.memoryViewerPhase = "sealed";
    updateMemoryViewerDetails();
    document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = true; });
    return;
  }
  if (pickRandom) appState.memoryIndex = randomMemoryIndex();
  appState.hasPickedMemory = true;
  appState.memoryViewerPhase = "sealed";
  if (stage) {
    stage.className = "memory-envelope-stage is-arriving";
    stage.innerHTML = SealedMemoryEnvelope(appState.memories[appState.memoryIndex]);
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove("is-arriving")));
  }
  updateMemoryViewerDetails();
  document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = false; });
}

function refreshMemoryCard(direction = 1) {
  if (appState.memoryViewerPhase === "ripping" || appState.memories.length < 2) return;
  appState.memoryViewerPhase = "cycling";
  const stage = document.querySelector("#memory-envelope-stage");
  if (!stage) return;
  document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = true; });
  stage.classList.add(direction > 0 ? "is-cycling-next" : "is-cycling-prev");
  appState.memoryViewerTimer = setTimeout(() => {
    appState.memoryIndex = (appState.memoryIndex + direction + appState.memories.length) % appState.memories.length;
    appState.memoryViewerPhase = "sealed";
    stage.className = `memory-envelope-stage ${direction > 0 ? "is-entering-next" : "is-entering-prev"}`;
    stage.innerHTML = SealedMemoryEnvelope(appState.memories[appState.memoryIndex]);
    updateMemoryViewerDetails();
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove("is-entering-next", "is-entering-prev")));
    setTimeout(() => document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = false; }), 260);
  }, 210);
}

function ripMemoryEnvelope() {
  if (appState.memoryViewerPhase !== "sealed") return;
  const stage = document.querySelector("#memory-envelope-stage");
  const envelope = stage?.querySelector("[data-rip-memory]");
  if (!stage || !envelope) return;
  appState.memoryViewerPhase = "ripping";
  envelope.disabled = true;
  envelope.classList.add("is-ripping");
  document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = true; });
  updateMemoryViewerDetails("Rrrrip!");
  appState.memoryViewerTimer = setTimeout(() => {
    appState.memoryViewerPhase = "open";
    stage.classList.add("is-opening");
    stage.innerHTML = OpenedMemoryEnvelope(appState.memories[appState.memoryIndex]);
    updateMemoryViewerDetails("Postcard revealed — choose another envelope to keep exploring");
    document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = false; });
    setTimeout(() => {
      stage.classList.remove("is-opening");
      stage.querySelector(".memory-postcard")?.focus({ preventScroll: true });
    }, 480);
  }, 760);
}

async function copyValue(kind) {
  if (!appState.event) return;
  const value = kind === "code" ? appState.event.inviteCode : inviteUrl();
  try { await navigator.clipboard.writeText(value); showToast(kind === "code" ? "Invite code copied!" : "Invite link copied!"); }
  catch { showToast(`Copy this: ${value}`); }
}

function setInlineError(id, message = "") {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = message;
}

async function enterEvent(event, { replaceHistory = false, announce = "" } = {}) {
  const { memories } = await capsuleApi(event, `/api/events/${event.id}/memories`);
  appState.event = event;
  appState.ownerToken = getStoredOwnerToken(event.id);
  appState.memories = memories;
  appState.memoryCount = event.memoryCount ?? memories.length;
  appState.memoryIndex = 0;
  appState.memoryViewerPhase = "sealed";
  appState.hasPickedMemory = false;
  appState.pulse = null;
  appState.screen = "event";
  const method = replaceHistory ? "replaceState" : "pushState";
  window.history[method]({ inviteCode: event.inviteCode }, "", `/${event.inviteCode}`);
  renderApp();
  connectEventStream();
  if (announce) showToast(announce);
}

function closeEventStream() {
  appState.eventStream?.close();
  appState.eventStream = null;
}

function refreshLiveEventUi() {
  updateMemoryTotals();
  if (!appState.modal && ["event", "pulse"].includes(appState.screen)) renderApp();
}

function connectEventStream() {
  closeEventStream();
  if (!appState.event || typeof EventSource === "undefined") return;
  const stream = new EventSource(`/api/events/${appState.event.id}/stream?code=${encodeURIComponent(appState.event.inviteCode)}`);
  appState.eventStream = stream;
  stream.onmessage = async ({ data }) => {
    let update;
    try { update = JSON.parse(data); }
    catch { return; }
    if (update.type === "memory-added") {
      if (!appState.memories.some((memory) => memory.id === update.data.memory.id)) appState.memories.push(update.data.memory);
      appState.memoryCount = update.data.memoryCount;
      appState.pulse = null;
      refreshLiveEventUi();
    }
    if (update.type === "memory-removed") {
      appState.memories = appState.memories.filter((memory) => memory.id !== update.data.memoryId);
      appState.memoryCount = Math.max(0, appState.memoryCount - 1);
      appState.pulse = null;
      refreshLiveEventUi();
    }
    if (["event-updated", "code-rotated"].includes(update.type)) {
      appState.event = update.data.event;
      appState.memoryCount = update.data.event.memoryCount;
      if (update.type === "code-rotated") {
        window.history.replaceState({ inviteCode: appState.event.inviteCode }, "", `/${appState.event.inviteCode}`);
        try {
          const { memories } = await capsuleApi(appState.event, `/api/events/${appState.event.id}/memories`);
          appState.memories = memories;
        } catch { /* Existing screen remains usable while the stream reconnects. */ }
        connectEventStream();
      }
      refreshLiveEventUi();
    }
    if (update.type === "pulse-updated") {
      appState.pulse = update.data.pulse;
      appState.memoryCount = update.data.pulse.memoryCount;
      if (appState.screen === "pulse") renderApp();
    }
    if (update.type === "event-deleted") {
      removeStoredOwnerToken(appState.event.id);
      closeEventStream();
      appState.event = null;
      appState.ownerToken = null;
      appState.memories = [];
      appState.memoryCount = 0;
      appState.screen = "landing";
      window.history.replaceState({}, "", "/");
      renderApp();
      showToast("This capsule was deleted.");
    }
  };
}

async function runOwnerAction(action) {
  if (!appState.event || !appState.ownerToken || appState.busy) return;
  appState.busy = true;
  try {
    if (action === "toggle-status") {
      const status = appState.event.status === "open" ? "closed" : "open";
      const { event } = await ownerApi(`/api/events/${appState.event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      appState.event = event;
      renderApp();
      openModal("invite");
      showToast(status === "open" ? "Capsule reopened." : "Capsule closed to new memories.");
    }
    if (action === "rotate-code") {
      const { event } = await ownerApi(`/api/events/${appState.event.id}/code`, { method: "POST" });
      appState.event = event;
      window.history.replaceState({ inviteCode: event.inviteCode }, "", `/${event.inviteCode}`);
      renderApp();
      openModal("invite");
      showToast(`New invite code: ${inviteDisplay(event.inviteCode)}`);
    }
  } catch (error) {
    showToast(error.message || "Owner action failed.");
  } finally {
    appState.busy = false;
  }
}

async function joinCapsule(form) {
  if (appState.busy) return;
  const code = String(new FormData(form).get("inviteCode") || form.querySelector("#invite-code")?.value || "").replace(/\s/g, "");
  setInlineError("join-error");
  if (!/^\d{6}$/.test(code)) {
    setInlineError("join-error", "Enter a 6-digit invite code.");
    return;
  }
  appState.busy = true;
  showToast("finding capsule...");
  try {
    const { event } = await api(`/api/events/join/${code}`);
    await enterEvent(event, { announce: `Joined ${event.name} ✦` });
  } catch (error) {
    setInlineError("join-error", error.message || "Couldn’t find that capsule.");
  } finally {
    appState.busy = false;
  }
}

async function loadEventByCode(code, { replaceHistory = true } = {}) {
  showToast("opening capsule...");
  try {
    const { event } = await api(`/api/events/join/${code}`);
    await enterEvent(event, { replaceHistory });
  } catch (error) {
    appState.event = null; appState.memories = []; appState.memoryCount = 0; appState.screen = "landing";
    window.history.replaceState({}, "", "/");
    renderApp();
    showToast(error.message || "Couldn’t find that capsule.");
  }
}

async function showPulse() {
  if (!appState.event || appState.busy) return;
  appState.screen = "pulse";
  appState.pulse = null;
  renderApp();
  showToast("reading the event pulse...");
  try {
    const { pulse } = await capsuleApi(appState.event, `/api/events/${appState.event.id}/pulse`);
    appState.pulse = pulse;
    appState.memoryCount = pulse.memoryCount;
    renderApp();
  } catch (error) {
    showToast(error.message || "Event Pulse couldn’t be loaded.");
  }
}

function validateDraft() {
  const message = appState.message.trim();
  if (!message) return "Write a short memory before continuing.";
  if (message.length > MEMORY_MESSAGE_MAX_LENGTH) return `Keep your memory to ${MEMORY_MESSAGE_MAX_LENGTH} characters or fewer.`;
  if (!appState.mood) return "Choose a mood for your memory.";
  return "";
}

function moveToDrawing() {
  const error = validateDraft();
  setInlineError("memory-error", error);
  if (error) return;
  closeModal("add");
  setTimeout(() => openModal("draw"), 80);
}

async function submitMemory({ skipDrawing = false } = {}) {
  if (appState.busy || !appState.event) return;
  const validationError = validateDraft();
  if (validationError) { setInlineError("draw-error", validationError); return; }
  const drawLayer = document.querySelector('[data-modal="draw"]');
  const source = drawLayer?.querySelector(".custom-envelope");
  if (!source) return;
  setInlineError("draw-error");
  appState.busy = true;
  drawLayer.querySelectorAll("[data-send]").forEach((button) => { button.disabled = true; });
  const sendLabel = drawLayer.querySelector('[data-send="true"] span:last-child');
  if (sendLabel) sendLabel.textContent = "SENDING MEMORY...";
  showToast("sending memory...");

  try {
    const drawing = !skipDrawing && drawController?.hasDrawing() ? await drawController.toBlob() : null;
    const form = new FormData();
    form.set("message", appState.message.trim());
    form.set("emoji", appState.mood);
    form.set("author", appState.author.trim());
    form.set("envelopeColor", "cream");
    if (appState.photoFile) form.set("image", appState.photoFile, appState.photoFile.name);
    if (drawing) form.set("envelopeDrawing", drawing, "envelope-drawing.png");

    const { memory, memoryCount } = await capsuleApi(appState.event, `/api/events/${appState.event.id}/memories`, { method: "POST", body: form });
    if (!appState.memories.some((existing) => existing.id === memory.id)) appState.memories.push(memory);
    appState.memoryCount = memoryCount;
    appState.pulse = null;
    animateSubmittedMemory(source, memory);
  } catch (error) {
    appState.busy = false;
    drawLayer.querySelectorAll("[data-send]").forEach((button) => { button.disabled = false; });
    if (sendLabel) sendLabel.textContent = "SEND TO CAPSULE";
    setInlineError("draw-error", error.message || "Memory couldn’t be sent. Try again.");
  }
}

function resetDraft() {
  if (appState.photoPreview) URL.revokeObjectURL(appState.photoPreview);
  appState.message = "";
  appState.mood = moods[0].emoji;
  appState.author = "";
  appState.photoPreview = null;
  appState.photoFile = null;
  appState.busy = false;
  drawController = null;
}

function animateSubmittedMemory(source, memory) {
  source.classList.add("is-sealing");
  const from = source.getBoundingClientRect();
  setTimeout(() => {
    closeModal("draw"); showScreen("event");
    const target = document.querySelector("#event-screen .capsule-window")?.getBoundingClientRect();
    const flyer = document.createElement("div"); flyer.className = "flying-envelope"; flyer.innerHTML = `<span>♄</span>`;
    flyer.style.left = `${from.left + from.width * .25}px`; flyer.style.top = `${from.top + from.height * .25}px`; document.body.appendChild(flyer);
    requestAnimationFrame(() => {
      const x = target ? target.left + target.width / 2 - (from.left + from.width * .25) : window.innerWidth / 2;
      const y = target ? target.top + target.height / 2 - (from.top + from.height * .25) : -200;
      flyer.animate([
        { transform: "translate(0,0) rotate(-4deg) scale(1)", opacity: 1 },
        { transform: `translate(${x * .45}px, ${y * .28 - 80}px) rotate(12deg) scale(.78)`, opacity: 1, offset: .55 },
        { transform: `translate(${x}px, ${y}px) rotate(25deg) scale(.18)`, opacity: .1 },
      ], { duration: 1200, easing: "cubic-bezier(.3,.8,.25,1)", fill: "forwards" });
      document.querySelector("#event-screen .capsule-machine")?.classList.add("is-receiving");
      setTimeout(() => {
        flyer.remove(); document.querySelector("#event-screen .capsule-machine")?.classList.remove("is-receiving");
        const stack = document.querySelector("#event-screen .envelope-stack");
        if (stack) {
          stack.classList.add("is-shifting");
          if (!stack.querySelector(".just-added")) stack.insertAdjacentHTML("beforeend", Envelope(memoryEnvelope(memory), Math.min(stack.children.length, 9), "just-added"));
          setTimeout(() => stack.classList.remove("is-shifting"), 620);
        }
        updateMemoryTotals();
        resetDraft();
        showToast("Memory added to the capsule! ✦");
      }, 1220);
    });
    source.classList.remove("is-sealing");
  }, 650);
}

let drawController;
function setupDrawingCanvas() {
  const canvas = document.querySelector("#drawing-canvas");
  if (!canvas || canvas.dataset.ready === "true") return;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let tool = "pencil"; let color = "#2357d8"; let drawing = false; let last = null; let hasInk = false; const history = [];
  const resize = () => {
    const rect = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    const prior = canvas.width ? canvas.toDataURL() : null;
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (prior) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height); image.src = prior; }
  };
  resize(); window.addEventListener("resize", resize);
  const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const snapshot = () => { history.push({ url: canvas.toDataURL(), hasInk }); if (history.length > 14) history.shift(); };
  const restore = (state) => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasInk = Boolean(state?.hasInk); if (!state?.url) return; const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight); image.src = state.url; };
  canvas.addEventListener("pointerdown", (event) => { snapshot(); drawing = true; last = point(event); canvas.setPointerCapture(event.pointerId); event.preventDefault(); });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return; const next = point(event); ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (tool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.lineWidth = 26; }
    else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = color; ctx.lineWidth = tool === "marker" ? 14 : 4; ctx.globalAlpha = tool === "marker" ? .62 : .92; }
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(next.x, next.y); ctx.stroke(); ctx.restore(); last = next; hasInk = true;
  });
  const stop = () => { drawing = false; last = null; };
  canvas.addEventListener("pointerup", stop); canvas.addEventListener("pointercancel", stop);
  drawController = {
    setTool(next) { tool = next; }, setColor(next) { color = next; },
    undo() { restore(history.pop()); }, clear() { snapshot(); ctx.clearRect(0, 0, canvas.width, canvas.height); hasInk = false; },
    hasDrawing() { return hasInk; },
    toBlob() { return new Promise((resolve) => canvas.toBlob(resolve, "image/png")); },
  };
  canvas.dataset.ready = "true";
}

function drawPulseChart() {
  const canvas = document.querySelector("#pulse-chart"); if (!canvas) return;
  const rect = canvas.getBoundingClientRect(); if (!rect.width) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2); canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio); const w = rect.width; const h = rect.height; const left = 42; const bottom = h - 30; const top = 20; const right = w - 14;
  ctx.strokeStyle = "#171717"; ctx.lineWidth = 2.15; ctx.lineCap = "round"; ctx.lineJoin = "round";
  [[0, 0], [1.5, 1]].forEach(([jx, jy], pass) => {
    ctx.globalAlpha = pass ? .28 : .92;
    ctx.beginPath();
    ctx.moveTo(left + 1 + jx, top + jy);
    ctx.quadraticCurveTo(left - 1 + jx, h * .48, left + jx, bottom + jy);
    ctx.quadraticCurveTo(w * .49, bottom - 1 + jy, right, bottom + 1 + jy);
    ctx.stroke();
  });
  const timeline = (appState.pulse?.timeline || []).slice(-12);
  const series = timeline.length ? timeline : [{ bucket: null, count: 0 }];
  const maxValue = Math.max(5, ...series.map((item) => item.count));
  const xStep = (right - left) / Math.max(1, series.length - 1);
  const labelEvery = Math.max(1, Math.ceil(series.length / 5));
  const peakIndex = series.reduce((best, item, index) => item.count > series[best].count ? index : best, 0);
  ctx.globalAlpha = 1; ctx.font = "17px 'Patrick Hand', cursive"; ctx.fillStyle = "#171717"; ctx.textAlign = "center";
  series.forEach((item, i) => {
    const x = series.length === 1 ? (left + right) / 2 : left + i * xStep;
    ctx.beginPath(); ctx.moveTo(x, bottom - 4); ctx.lineTo(x + (i % 2 ? 1.5 : -1.5), bottom + 6); ctx.stroke();
    if (item.bucket && (i % labelEvery === 0 || i === series.length - 1)) {
      const label = new Date(item.bucket).toLocaleTimeString([], { hour: "numeric" });
      ctx.save(); ctx.translate(x, h - 7); ctx.rotate((i % 3 - 1) * .018); ctx.fillText(label, 0, 0); ctx.restore();
    }
  });
  Array.from({ length: 6 }, (_, index) => Math.round(maxValue * index / 5)).forEach((value, i) => { const y = bottom - value / maxValue * (bottom - top); ctx.textAlign = "right"; ctx.fillText(String(value), left - 10, y + 5); ctx.beginPath(); ctx.moveTo(left - 4, y); ctx.lineTo(left + 4, y + (i % 2 ? 1 : -1)); ctx.stroke(); });
  const points = series.map((item, i) => ({ x: series.length === 1 ? (left + right) / 2 : left + i * xStep, y: bottom - item.count / maxValue * (bottom - top) }));
  for (let pass = 0; pass < 3; pass++) { ctx.beginPath(); ctx.strokeStyle = pass === 0 ? "#1746be" : pass === 1 ? "rgba(35,87,216,.48)" : "rgba(77,113,224,.3)"; ctx.lineWidth = pass === 0 ? 4.2 : pass === 1 ? 1.6 : .8; points.forEach((p, i) => i ? ctx.lineTo(p.x + pass * .8, p.y + (pass ? (i % 2 ? 1.4 : -1) : 0)) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
  points.forEach((p, i) => { ctx.fillStyle = i === peakIndex ? "#f25a47" : "#1746be"; ctx.strokeStyle = "#171717"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, i === peakIndex ? 6.5 : 4.7, .08, Math.PI * 2); ctx.fill(); ctx.stroke(); });
}

function bindInteractions() {
  app.addEventListener("click", (eventTarget) => {
    const nav = eventTarget.target.closest("[data-nav]");
    if (nav) nav.dataset.nav === "pulse" ? showPulse() : showScreen(nav.dataset.nav);
    const capacity = eventTarget.target.closest("[data-setup-capacity]");
    if (capacity) { appState.capsuleDraft.capacity = Number(capacity.dataset.setupCapacity); updateCapsuleSetupPreview(); }
    const accent = eventTarget.target.closest("[data-setup-accent]");
    if (accent) { appState.capsuleDraft.accentColor = accent.dataset.setupAccent; updateCapsuleSetupPreview(); }
    const sticker = eventTarget.target.closest("[data-setup-sticker]");
    if (sticker) { appState.capsuleDraft.sticker = sticker.dataset.setupSticker; updateCapsuleSetupPreview(); }
    if (eventTarget.target.closest("[data-surprise]")) surpriseCapsule();
    const opener = eventTarget.target.closest("[data-open]");
    if (opener) openModal(opener.dataset.open);
    const closer = eventTarget.target.closest("[data-close]"); if (closer) closeModal(closer.dataset.close);
    const mood = eventTarget.target.closest("[data-mood]"); if (mood) { appState.mood = mood.dataset.mood; updatePreviews(); }
    const next = eventTarget.target.closest("[data-next]"); if (next) moveToDrawing();
    const memNav = eventTarget.target.closest("[data-memory-nav]"); if (memNav) refreshMemoryCard(Number(memNav.dataset.memoryNav));
    const ripEnvelope = eventTarget.target.closest("[data-rip-memory]"); if (ripEnvelope) ripMemoryEnvelope();
    const copy = eventTarget.target.closest("[data-copy]"); if (copy) copyValue(copy.dataset.copy);
    const ownerAction = eventTarget.target.closest("[data-owner-action]"); if (ownerAction) runOwnerAction(ownerAction.dataset.ownerAction);
    const send = eventTarget.target.closest("[data-send]"); if (send) submitMemory({ skipDrawing: send.dataset.skipDrawing === "true" });
    const toolButton = eventTarget.target.closest("[data-tool]");
    if (toolButton) {
      const tool = toolButton.dataset.tool;
      if (tool === "undo") drawController?.undo(); else if (tool === "clear") drawController?.clear(); else { drawController?.setTool(tool); document.querySelectorAll(".draw-tool").forEach((button) => button.classList.toggle("is-active", button === toolButton)); }
    }
    const colorButton = eventTarget.target.closest("[data-color]");
    if (colorButton) { drawController?.setColor(colorButton.dataset.color); document.querySelectorAll(".draw-color").forEach((button) => button.classList.toggle("is-active", button === colorButton)); }
  });
  app.addEventListener("submit", (submitEvent) => {
    if (submitEvent.target.matches("#capsule-setup-form")) { submitEvent.preventDefault(); createFrontendCapsule(); return; }
    if (submitEvent.target.matches("#join-form")) { submitEvent.preventDefault(); joinCapsule(submitEvent.target); }
  });
  app.addEventListener("input", (inputEvent) => {
    if (inputEvent.target.matches("#memory-author")) { appState.author = inputEvent.target.value.slice(0, 9); inputEvent.target.value = appState.author; updatePreviews(); }
    if (inputEvent.target.matches("#memory-message")) { appState.message = inputEvent.target.value.slice(0, MEMORY_MESSAGE_MAX_LENGTH); inputEvent.target.value = appState.message; updatePreviews(); }
    if (inputEvent.target.form?.matches("#capsule-setup-form") && ["name", "startDate", "endDate", "description"].includes(inputEvent.target.name)) {
      appState.capsuleDraft[inputEvent.target.name] = inputEvent.target.value;
      updateCapsuleSetupPreview();
    }
    if (inputEvent.target.matches("#invite-code")) {
      const digits = inputEvent.target.value.replace(/\D/g, "").slice(0, 6);
      inputEvent.target.value = inviteDisplay(digits);
      setInlineError("join-error");
    }
  });
  app.addEventListener("change", (inputEvent) => {
    if (inputEvent.target.form?.matches("#capsule-setup-form") && ["startDate", "endDate"].includes(inputEvent.target.name)) {
      appState.capsuleDraft[inputEvent.target.name] = inputEvent.target.value;
      updateCapsuleSetupPreview();
    }
    if (!inputEvent.target.matches("#photo-input")) return;
    const file = inputEvent.target.files?.[0]; if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) { setInlineError("memory-error", "Choose a JPEG, PNG, WebP, or GIF image."); inputEvent.target.value = ""; return; }
    if (file.size > MAX_IMAGE_SIZE) { setInlineError("memory-error", "Image must be 8 MB or smaller."); inputEvent.target.value = ""; return; }
    if (appState.photoPreview) URL.revokeObjectURL(appState.photoPreview);
    appState.photoFile = file;
    appState.photoPreview = URL.createObjectURL(file);
    setInlineError("memory-error"); updatePreviews(); showToast("Photo ready to send ✦");
  });
}

document.addEventListener("keydown", (eventTarget) => {
  if (eventTarget.key === "Escape" && appState.modal) closeModal(appState.modal);
  if (appState.modal === "viewer" && eventTarget.key === "ArrowLeft") refreshMemoryCard(-1);
  if (appState.modal === "viewer" && eventTarget.key === "ArrowRight") refreshMemoryCard(1);
});

window.addEventListener("resize", () => { if (appState.screen === "pulse") drawPulseChart(); });

window.addEventListener("popstate", () => {
  const code = window.location.pathname.slice(1);
  if (/^\d{6}$/.test(code)) loadEventByCode(code);
  else { closeEventStream(); appState.screen = "landing"; appState.event = null; appState.ownerToken = null; appState.memories = []; appState.memoryCount = 0; renderApp(); }
});

renderApp();
bindInteractions();
const initialInviteCode = window.location.pathname.slice(1);
if (/^\d{6}$/.test(initialInviteCode)) loadEventByCode(initialInviteCode);
