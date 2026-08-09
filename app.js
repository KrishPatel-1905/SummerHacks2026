import {
  event,
  moods,
  draftMemory,
  polaroids,
  capsuleEnvelopes,
  mockMemories,
  mockPulseData,
} from "./mockData.js";

const MEMORY_MESSAGE_MAX_LENGTH = 50;

const appState = {
  screen: "landing",
  modal: null,
  memoryCount: event.memoryCount,
  message: draftMemory.message.slice(0, MEMORY_MESSAGE_MAX_LENGTH),
  mood: draftMemory.mood,
  author: draftMemory.author || "",
  photo: null,
  drawing: null,
  memoryIndex: 0,
  memoryViewerPhase: "sealed",
  memoryViewerTimer: null,
  hasPickedMemory: false,
  isSubmitting: false,
};

const app = document.querySelector("#app");
const toastEl = document.querySelector("#toast");

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

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

function PhotoScene(scene = "concert", className = "", useUserPhoto = false) {
  const custom = useUserPhoto && appState.photo ? `<img src="${appState.photo}" alt="Selected memory preview" />` : "";
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
  const hasDrawing = Boolean(item.drawing);
  const drawingMarkup = hasDrawing ? `
    <img class="envelope-base-art" src="./assets/leave-your-mark-envelope.png" alt="" draggable="false" />
    <img class="envelope-drawing" src="${esc(item.drawing)}" alt="" draggable="false" />` : `
    <div class="envelope-flap"></div>
    <span class="envelope-sketch envelope-sketch--a">//</span><span class="envelope-sketch envelope-sketch--b">⌁</span>
    ${index % 3 === 0 ? Tape(index % 2 ? "tan" : "blue", "envelope-tape") : ""}
    <span class="envelope-stamp">${stamps[index % stamps.length]}</span>
    <span class="envelope-postal">${postal[index % postal.length]}</span>
    <span class="envelope-mark">${esc(item.mark || "")}</span>
    <span class="envelope-doodle">${esc(item.doodle || "✦")}</span>
    <span class="envelope-seal envelope-seal--${item.seal || "planet"}">${item.seal === "heart" ? "♡" : item.seal === "smile" ? "☺" : item.seal === "star" ? "★" : "♄"}</span>`;
  return `<div class="envelope envelope--${item.color} ${hasDrawing ? "envelope--with-drawing" : ""} ${extra}" style="--envelope-tilt:${(index % 5 - 2) * 3}deg" ${hasDrawing ? 'role="img" aria-label="Your drawing inside the event capsule"' : ""}>${drawingMarkup}
  </div>`;
}

function CapsuleWindow(items = capsuleEnvelopes) {
  return `<div class="capsule-window capsule-window--art">
    <div class="envelope-stack" aria-label="A colorful stack of shared memory envelopes">
      ${items.map((item, index) => Envelope(item, index)).join("")}
    </div>
    <div class="window-glass"></div>
    <span class="window-shine"></span>
  </div>`;
}

function EventCapsuleMachine(size = "hero") {
  return `<div class="capsule-machine capsule-machine--${size}" aria-label="Illustrated Event Capsule machine full of memory envelopes">
    <span class="machine-ground-shadow"></span>
    <img class="capsule-art" src="./assets/event-capsule-machine.png" alt="" draggable="false" />
    ${CapsuleWindow()}
    <strong class="capsule-art-label">EVENT<br>CAPSULE</strong>
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
  return `<main id="landing-screen" class="screen landing-screen is-active" data-screen="landing">
    <div class="landing-polaroids landing-polaroids--left">${polaroids.slice(0, 3).map((p, i) => Polaroid(p, i)).join("")}</div>
    <div class="landing-polaroids landing-polaroids--right">${polaroids.slice(3).map((p, i) => Polaroid(p, i + 3)).join("")}</div>
    <section class="landing-core">
      ${HandwrittenHeading("EVENT\nCAPSULE", { className: "landing-title" })}
      <p class="landing-tagline"><span>Capture this moment together.</span></p>
      <p class="capsule-note capsule-note--left">memories<br>float here <span>↗</span></p>
      <p class="capsule-note capsule-note--right">look inside <span>✦</span></p>
      ${EventCapsuleMachine("hero")}
      <div class="landing-actions">
        ${HandDrawnButton("CREATE CAPSULE", { tone: "blue", icon: "◉", action: 'data-nav="event" data-created="true"' })}
        <p class="join-label"><span>Already have a code?</span></p>
        <form class="join-form" id="join-form">
          <label class="sr-only" for="invite-code">Invite code</label>
          <input id="invite-code" inputmode="numeric" maxlength="7" value="${event.inviteDisplay}" />
          ${HandDrawnButton("JOIN", { tone: "coral", type: "submit" })}
        </form>
      </div>
    </section>
    <div class="landing-mascots mascot-group--left">${Mascot("astronaut", "Waving astronaut mascot")}${Mascot("alien", "Friendly alien mascot")}</div>
    <div class="landing-mascots mascot-group--right">${Mascot("robot", "Friendly robot mascot")}${Mascot("star", "Smiling star mascot")}</div>
  </main>`;
}

function EventScreen() {
  const capsuleFull = appState.memoryCount >= event.memoryLimit;
  return `<main id="event-screen" class="screen event-screen" data-screen="event">
    <header class="event-header">
      <div>
        ${HandwrittenHeading(event.title, { level: 1, className: "event-title" })}
        <p class="memory-count"><span data-memory-total>${appState.memoryCount}</span> memories so far!</p>
      </div>
      ${HandDrawnButton("SHARE ↗", { tone: "paper", className: "share-button", action: 'data-open="invite"' })}
    </header>
    <section class="event-machine-wrap">
      ${EventCapsuleMachine("event")}
      ${Mascot("star", "Smiling star mascot")}
    </section>
    <section class="event-actions" aria-label="Event actions">
      ${HandDrawnButton(capsuleFull ? "CAPSULE FULL" : "ADD YOUR MEMORY", { tone: "coral", icon: "+", action: `${capsuleFull ? 'disabled aria-disabled="true"' : 'data-open="add"'} data-add-memory` })}
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
    <label class="postcard-photo js-user-photo" for="photo-input" aria-label="Choose a photo from your computer">${appState.photo ? `<img src="${esc(appState.photo)}" alt="Selected memory preview" />` : UploadPlaceholder(true)}</label>
    <div class="postcard-copy">
      <span class="postal-lines" aria-hidden="true">〰〰〰</span>
      <span class="stamp">☆</span>
      <p class="js-preview-message">${esc(appState.message)}</p>
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
        <label class="polaroid upload-polaroid" for="photo-input" aria-label="Upload a photo from your computer">${Tape("blue", "polaroid-tape")}<div class="photo-scene photo-scene--upload js-user-photo">${appState.photo ? `<img src="${esc(appState.photo)}" alt="Selected memory preview" />` : UploadPlaceholder()}</div>${Tape("blue", "corner-tape")}</label>
        <label class="change-photo" for="photo-input"><span aria-hidden="true">▣</span> CHANGE PHOTO</label>
        <input class="sr-only" id="photo-input" type="file" accept="image/*" />
      </section>
      <section class="add-details-column">
        <label for="memory-author">Your name <span class="optional-label">(optional)</span></label>
        <input id="memory-author" type="text" maxlength="9" autocomplete="name" placeholder="e.g. Alex" value="${esc(appState.author)}" />
        <label for="memory-message">What’s on your mind right now?</label>
        <textarea id="memory-message" maxlength="${MEMORY_MESSAGE_MAX_LENGTH}">${esc(appState.message)}</textarea>
        <h3>MOOD</h3>
        ${MoodPicker()}
      </section>
      <section class="preview-column">
        <h3>LIVE POSTCARD PREVIEW</h3>
        ${PostcardPreview()}
      </section>
    </div>
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
        ${HandDrawnButton("SEND TO CAPSULE", { tone: "coral", icon: "➶", action: 'data-send="drawing"' })}
        <button class="skip-button" data-send="skip">SKIP</button>
      </aside>
    </div>
  </div>`;
  return PaperModal(content, "draw", "draw-modal");
}

function MemoryPostcard(memory) {
  return `<article class="memory-postcard" tabindex="-1" aria-label="Postcard from ${esc(memory.author || "Anonymous")}">
    <div class="memory-photo-frame">${Tape("blue", "memory-photo-tape")}${memory.photo ? `<img class="memory-user-photo" src="${esc(memory.photo)}" alt="Memory shared by ${esc(memory.author || "Anonymous")}" />` : PhotoScene(memory.scene)}</div>
    <div class="memory-copy">
      <span class="mood-sticker">${memory.mood}</span>
      <span class="stamp stamp--memory">${memory.stamp === "planet" ? "♄" : memory.stamp === "rocket" ? "➶" : "★"}</span>
      <p>${esc(memory.message)}</p>
      <span class="memory-author">— ${esc(memory.author || "Anonymous")}</span>
      <span class="writing-lines"></span>
      <div class="memory-meta"><span>♄ ✧</span><span><strong>${memory.date}</strong><br>${memory.relativeTime}</span></div>
    </div>
  </article>`;
}

function SealedMemoryEnvelope(memory) {
  const art = memory.envelopeArt || {
    ink: "#2357d8",
    phrase: "A LITTLE MEMORY",
    symbol: "✦",
    trail: "⌁  ·  ☆",
  };
  const drawing = memory.drawing
    ? `<img class="viewer-drawing-image" src="${esc(memory.drawing)}" alt="Drawing by ${esc(memory.author || "Anonymous")}" />`
    : `<span class="viewer-drawing-symbol">${esc(art.symbol)}</span>
      <span class="viewer-drawing-phrase">${esc(art.phrase)}</span>
      <span class="viewer-drawing-trail">${esc(art.trail)}</span>
      <span class="viewer-drawing-orbit"></span>`;

  return `<button class="sealed-memory-envelope envelope--${memory.envelopeColor || "cream"}" data-rip-memory style="--drawing-ink:${esc(art.ink || "#2357d8")}" aria-describedby="memory-viewer-hint" aria-label="Rip open ${esc(memory.author || "this guest")}'s envelope">
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
  const memory = mockMemories[appState.memoryIndex];
  return `<section class="modal-layer memory-layer" data-modal="viewer" aria-hidden="true">
    <div class="modal-scrim" data-close="viewer"></div>
    <button class="close-button viewer-close" data-close="viewer" aria-label="Close memory viewer">×</button>
    ${HandDrawnButton("PREV ENVELOPE", { tone: "paper", icon: "←", className: "memory-nav memory-nav--prev", action: 'data-memory-nav="-1"' })}
    <div class="memory-viewer-center">
      <div class="memory-viewer-heading" aria-hidden="true"><span>✦</span><strong>A MEMORY FOUND YOU</strong><span>✦</span></div>
      <div class="memory-envelope-stage" id="memory-envelope-stage">${SealedMemoryEnvelope(memory)}</div>
      <p class="memory-viewer-hint" id="memory-viewer-hint">Click the envelope to rip it open <span>↗</span></p>
      <p class="memory-viewer-count" id="memory-viewer-count">ENVELOPE ${appState.memoryIndex + 1} / ${mockMemories.length}</p>
    </div>
    ${HandDrawnButton("NEXT ENVELOPE", { tone: "paper", icon: "→", className: "memory-nav memory-nav--next", action: 'data-memory-nav="1"' })}
  </section>`;
}

function InviteModal() {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const row = Math.floor(index / 21); const col = index % 21;
    const finder = (row < 7 && col < 7) || (row < 7 && col > 13) || (row > 13 && col < 7);
    const dark = finder ? (row % 6 !== 1 && col % 6 !== 1) : ((row * 7 + col * 11 + row * col) % 5 < 2);
    return `<i class="${dark ? "dark" : ""}"></i>`;
  }).join("");
  const content = `<div class="modal-content invite-content">
    ${HandwrittenHeading("INVITE EVERYONE", { level: 2, className: "modal-title" })}${Doodle("star", "title-doodle")}
    <div class="invite-grid">
      <section class="qr-side"><p class="scan-note">scan<br>me! <span>↘</span></p><div class="qr-card"><div class="mock-qr" aria-label="Decorative mock QR code">${cells}</div></div>${Mascot("astronaut", "Astronaut pointing to mock QR code")}</section>
      <section class="code-side"><h3>INVITE CODE</h3><div class="invite-code">${event.inviteDisplay}</div><div class="invite-url"><span>♄</span>${event.inviteUrl}</div>
        ${HandDrawnButton("COPY CODE", { tone: "blue", icon: "▣", action: 'data-copy="code"' })}
        ${HandDrawnButton("COPY LINK", { tone: "paper", icon: "↗", action: 'data-copy="link"' })}
      </section>
    </div>
  </div>`;
  return PaperModal(content, "invite", "invite-modal");
}

function MoodRows() {
  return mockPulseData.moods.map((mood) => `<div class="pulse-mood-row"><span class="pulse-emoji">${mood.emoji}</span><span class="pulse-mood-label">${mood.label}</span><strong>${mood.value}%</strong><span class="marker-bar marker-bar--${mood.color}" style="--value:${mood.value}"><i></i></span></div>`).join("");
}

function EventPulseScreen() {
  return `<main id="pulse-screen" class="screen pulse-screen" data-screen="pulse">
    <section class="notebook">
      ${Tape("tan", "notebook-tape notebook-tape--left")}${Tape("tan", "notebook-tape notebook-tape--right")}
      <div class="notebook-page notebook-page--left">
        ${HandwrittenHeading("EVENT PULSE", { level: 1, className: "pulse-title", note: "what did today feel like?" })}
        <div class="memory-total"><strong data-memory-total>${appState.memoryCount}</strong> Memories</div>
        <h2 class="scribble-subhead">How the room felt</h2>${MoodRows()}
        <h2 class="scribble-subhead">What everyone talked about</h2>
        <div class="theme-cloud">${mockPulseData.themes.map((theme) => `<span class="theme theme--${theme.color}">${theme.label}</span>`).join("")}</div>
      </div>
      <div class="notebook-page notebook-page--right">
        <h2 class="scribble-subhead">What kept showing up</h2>
        <div class="pulse-objects">${mockPulseData.objects.map((obj) => `<div><span>${obj.icon}</span><p>${obj.label}</p></div>`).join("")}</div>
        <div class="timeline-head"><h2 class="scribble-subhead">Memories through the day</h2><p>Peak moment:<br><strong>${mockPulseData.peak}</strong></p></div>
        <canvas id="pulse-chart" aria-label="Mock memories through the day line chart"></canvas>
        <article class="story-card">${Tape("tan", "story-tape")}<h2>☆ The Story of the Day</h2><p>${esc(mockPulseData.story)}</p><span>♡</span></article>
        <button class="text-link pulse-back" data-nav="event">← BACK TO CAPSULE</button>
      </div>
    </section>
  </main>`;
}

function renderApp() {
  app.innerHTML = `${SpaceBackground()}<div class="app-shell">${LandingScreen()}${EventScreen()}${EventPulseScreen()}</div>${AddMemoryModal()}${DrawModal()}${MemoryViewer()}${InviteModal()}`;
  bindInteractions();
}

function showScreen(name) {
  appState.screen = name;
  document.querySelectorAll("[data-screen]").forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "pulse") requestAnimationFrame(drawPulseChart);
}

function openModal(name) {
  if (name === "add" && appState.memoryCount >= event.memoryLimit) {
    showToast(`This capsule is full at ${event.memoryLimit} memories.`);
    return;
  }
  appState.modal = name;
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (!modal) return;
  if (name === "viewer") prepareMemoryViewer(true);
  modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false"); document.body.classList.add("modal-open");
  if (name === "draw") requestAnimationFrame(setupDrawingCanvas);
  modal.querySelector(name === "viewer" ? "[data-rip-memory]" : "button, input, textarea")?.focus({ preventScroll: true });
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

function updateMemoryTotals() {
  document.querySelectorAll("[data-memory-total]").forEach((node) => { node.textContent = appState.memoryCount; });
  const addButton = document.querySelector("[data-add-memory]");
  if (!addButton) return;
  const capsuleFull = appState.memoryCount >= event.memoryLimit;
  addButton.disabled = capsuleFull;
  addButton.setAttribute("aria-disabled", capsuleFull ? "true" : "false");
  if (capsuleFull) addButton.removeAttribute("data-open");
  else addButton.setAttribute("data-open", "add");
  const label = addButton.querySelector("span:last-child");
  if (label) label.textContent = capsuleFull ? "CAPSULE FULL" : "ADD YOUR MEMORY";
}

function updatePreviews() {
  document.querySelectorAll(".js-preview-message").forEach((node) => { node.textContent = appState.message || "Your memory goes here…"; });
  document.querySelectorAll(".js-preview-author").forEach((node) => { node.textContent = `— ${appState.author.trim() || "Anonymous"}`; });
  document.querySelectorAll(".js-preview-mood").forEach((node) => { node.textContent = appState.mood; });
  document.querySelectorAll(".mood-option").forEach((button) => {
    const selected = button.dataset.mood === appState.mood;
    button.classList.toggle("is-selected", selected); button.setAttribute("aria-checked", selected ? "true" : "false");
  });
  if (appState.photo) document.querySelectorAll(".js-user-photo").forEach((node) => { node.innerHTML = `<img src="${appState.photo}" alt="Selected memory preview" />`; });
}

function randomMemoryIndex() {
  if (mockMemories.length < 2 || !appState.hasPickedMemory) return Math.floor(Math.random() * mockMemories.length);
  const offset = 1 + Math.floor(Math.random() * (mockMemories.length - 1));
  return (appState.memoryIndex + offset) % mockMemories.length;
}

function updateMemoryViewerDetails(message = "Click the envelope to rip it open") {
  const hint = document.querySelector("#memory-viewer-hint");
  const count = document.querySelector("#memory-viewer-count");
  if (hint) hint.innerHTML = `${esc(message)} <span aria-hidden="true">↗</span>`;
  if (count) count.textContent = `ENVELOPE ${appState.memoryIndex + 1} / ${mockMemories.length}`;
}

function prepareMemoryViewer(pickRandom = false) {
  if (!mockMemories.length) return;
  clearTimeout(appState.memoryViewerTimer);
  if (pickRandom) appState.memoryIndex = randomMemoryIndex();
  appState.hasPickedMemory = true;
  appState.memoryViewerPhase = "sealed";
  const stage = document.querySelector("#memory-envelope-stage");
  if (stage) {
    stage.className = "memory-envelope-stage is-arriving";
    stage.innerHTML = SealedMemoryEnvelope(mockMemories[appState.memoryIndex]);
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove("is-arriving")));
  }
  updateMemoryViewerDetails();
  document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = false; });
}

function refreshMemoryCard(direction = 1) {
  if (appState.memoryViewerPhase === "ripping" || mockMemories.length < 2) return;
  appState.memoryViewerPhase = "cycling";
  const stage = document.querySelector("#memory-envelope-stage");
  if (!stage) return;
  document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = true; });
  stage.classList.add(direction > 0 ? "is-cycling-next" : "is-cycling-prev");
  appState.memoryViewerTimer = setTimeout(() => {
    appState.memoryIndex = (appState.memoryIndex + direction + mockMemories.length) % mockMemories.length;
    appState.memoryViewerPhase = "sealed";
    stage.className = `memory-envelope-stage ${direction > 0 ? "is-entering-next" : "is-entering-prev"}`;
    stage.innerHTML = SealedMemoryEnvelope(mockMemories[appState.memoryIndex]);
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
    stage.innerHTML = OpenedMemoryEnvelope(mockMemories[appState.memoryIndex]);
    updateMemoryViewerDetails("Postcard revealed — choose another envelope to keep exploring");
    document.querySelectorAll("[data-memory-nav]").forEach((button) => { button.disabled = false; });
    setTimeout(() => {
      stage.classList.remove("is-opening");
      stage.querySelector(".memory-postcard")?.focus({ preventScroll: true });
    }, 480);
  }, 760);
}

async function copyValue(kind) {
  const value = kind === "code" ? event.inviteCode : `https://${event.inviteUrl}`;
  try { await navigator.clipboard.writeText(value); showToast(kind === "code" ? "Invite code copied!" : "Invite link copied!"); }
  catch { showToast(`Copy this: ${value}`); }
}

function submitMemory(includeDrawing = true) {
  if (appState.isSubmitting) return;
  if (appState.memoryCount >= event.memoryLimit) {
    closeModal("draw");
    updateMemoryTotals();
    showToast(`This capsule is full at ${event.memoryLimit} memories.`);
    return;
  }
  const drawLayer = document.querySelector('[data-modal="draw"]');
  const source = drawLayer?.querySelector(".custom-envelope");
  if (!source) return;
  appState.isSubmitting = true;
  drawLayer.querySelectorAll("[data-send]").forEach((button) => { button.disabled = true; });
  const drawing = includeDrawing ? drawController?.exportDrawing() || null : null;
  appState.drawing = drawing;
  source.classList.add("is-sealing");
  const from = source.getBoundingClientRect();
  setTimeout(() => {
    closeModal("draw"); showScreen("event");
    const target = document.querySelector("#event-screen .capsule-window")?.getBoundingClientRect();
    const flyer = document.createElement("div"); flyer.className = "flying-envelope";
    flyer.innerHTML = drawing ? `<img class="flying-envelope-drawing" src="${esc(drawing)}" alt="" /><span>♄</span>` : `<span>♄</span>`;
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
          const envelope = drawing
            ? { color: "cream", drawing }
            : { color: "coral", mark: "YOU", doodle: "✦", seal: "planet" };
          stack.querySelector(".just-added")?.classList.remove("just-added");
          stack.insertAdjacentHTML("beforeend", Envelope(envelope, stack.children.length, "just-added"));
          const addedEnvelope = stack.lastElementChild;
          setTimeout(() => {
            stack.classList.remove("is-shifting");
            addedEnvelope?.classList.remove("just-added");
          }, 620);
        }
        const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date()).toUpperCase();
        mockMemories.unshift({
          id: `memory-${Date.now()}`,
          scene: draftMemory.scene,
          photo: appState.photo,
          drawing,
          message: appState.message.trim() || "A memory from today.",
          author: appState.author.trim() || "Anonymous",
          mood: appState.mood,
          date,
          relativeTime: "added just now",
          envelopeColor: "coral",
          stamp: "star",
        });
        appState.memoryCount += 1;
        appState.memoryIndex = 0;
        appState.isSubmitting = false;
        drawLayer.querySelectorAll("[data-send]").forEach((button) => { button.disabled = false; });
        updateMemoryTotals();
        showToast(appState.memoryCount >= event.memoryLimit ? "Memory added — the capsule is now full! ✦" : "Memory added to the capsule! ✦");
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
  let tool = "pencil"; let color = "#2357d8"; let drawing = false; let last = null; const history = [];
  const resize = () => {
    const rect = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    const prior = canvas.width ? canvas.toDataURL() : null;
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (prior) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height); image.src = prior; }
  };
  resize(); window.addEventListener("resize", resize);
  const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const snapshot = () => { history.push(canvas.toDataURL()); if (history.length > 14) history.shift(); };
  const restore = (url) => { ctx.clearRect(0, 0, canvas.width, canvas.height); if (!url) return; const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight); image.src = url; };
  canvas.addEventListener("pointerdown", (event) => { snapshot(); drawing = true; last = point(event); canvas.setPointerCapture(event.pointerId); event.preventDefault(); });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return; const next = point(event); ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (tool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.lineWidth = 26; }
    else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = color; ctx.lineWidth = tool === "marker" ? 14 : 4; ctx.globalAlpha = tool === "marker" ? .62 : .92; }
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(next.x, next.y); ctx.stroke(); ctx.restore(); last = next;
  });
  const stop = () => { drawing = false; last = null; };
  canvas.addEventListener("pointerup", stop); canvas.addEventListener("pointercancel", stop);
  drawController = {
    setTool(next) { tool = next; }, setColor(next) { color = next; },
    undo() { restore(history.pop()); }, clear() { snapshot(); ctx.clearRect(0, 0, canvas.width, canvas.height); },
    exportDrawing() {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) return canvas.toDataURL("image/png");
      }
      return null;
    },
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
  ctx.globalAlpha = 1; ctx.font = "17px 'Patrick Hand', cursive"; ctx.fillStyle = "#171717"; ctx.textAlign = "center";
  mockPulseData.timelineLabels.forEach((label, i) => { const x = left + i * ((right - left) / 9); ctx.beginPath(); ctx.moveTo(x, bottom - 4); ctx.lineTo(x + (i % 2 ? 1.5 : -1.5), bottom + 6); ctx.stroke(); if (label) { ctx.save(); ctx.translate(x, h - 7); ctx.rotate((i % 3 - 1) * .018); ctx.fillText(label, 0, 0); ctx.restore(); } });
  [0, 15, 30, 45, 60, 75].forEach((value, i) => { const y = bottom - value / 75 * (bottom - top); ctx.textAlign = "right"; ctx.fillText(String(value), left - 10, y + 5); ctx.beginPath(); ctx.moveTo(left - 4, y); ctx.lineTo(left + 4, y + (i % 2 ? 1 : -1)); ctx.stroke(); });
  const points = mockPulseData.timeline.map((value, i) => ({ x: left + i * ((right - left) / 9), y: bottom - value / 75 * (bottom - top) }));
  for (let pass = 0; pass < 3; pass++) { ctx.beginPath(); ctx.strokeStyle = pass === 0 ? "#1746be" : pass === 1 ? "rgba(35,87,216,.48)" : "rgba(77,113,224,.3)"; ctx.lineWidth = pass === 0 ? 4.2 : pass === 1 ? 1.6 : .8; points.forEach((p, i) => i ? ctx.lineTo(p.x + pass * .8, p.y + (pass ? (i % 2 ? 1.4 : -1) : 0)) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
  points.forEach((p, i) => { ctx.fillStyle = i === 6 ? "#f25a47" : "#1746be"; ctx.strokeStyle = "#171717"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, i === 6 ? 6.5 : 4.7, .08, Math.PI * 2); ctx.fill(); ctx.stroke(); });
}

function bindInteractions() {
  document.addEventListener("click", (eventTarget) => {
    const nav = eventTarget.target.closest("[data-nav]");
    if (nav) { showScreen(nav.dataset.nav); if (nav.dataset.created) showToast("Mock capsule created — welcome in!"); }
    const opener = eventTarget.target.closest("[data-open]"); if (opener) openModal(opener.dataset.open);
    const closer = eventTarget.target.closest("[data-close]"); if (closer) closeModal(closer.dataset.close);
    const mood = eventTarget.target.closest("[data-mood]"); if (mood) { appState.mood = mood.dataset.mood; updatePreviews(); }
    const next = eventTarget.target.closest("[data-next]"); if (next) { closeModal("add"); setTimeout(() => openModal("draw"), 80); }
    const memNav = eventTarget.target.closest("[data-memory-nav]"); if (memNav) refreshMemoryCard(Number(memNav.dataset.memoryNav));
    const ripEnvelope = eventTarget.target.closest("[data-rip-memory]"); if (ripEnvelope) ripMemoryEnvelope();
    const copy = eventTarget.target.closest("[data-copy]"); if (copy) copyValue(copy.dataset.copy);
    const send = eventTarget.target.closest("[data-send]"); if (send) submitMemory(send.dataset.send === "drawing");
    const toolButton = eventTarget.target.closest("[data-tool]");
    if (toolButton) {
      const tool = toolButton.dataset.tool;
      if (tool === "undo") drawController?.undo(); else if (tool === "clear") drawController?.clear(); else { drawController?.setTool(tool); document.querySelectorAll(".draw-tool").forEach((button) => button.classList.toggle("is-active", button === toolButton)); }
    }
    const colorButton = eventTarget.target.closest("[data-color]");
    if (colorButton) { drawController?.setColor(colorButton.dataset.color); document.querySelectorAll(".draw-color").forEach((button) => button.classList.toggle("is-active", button === colorButton)); }
  });
  document.querySelector("#join-form")?.addEventListener("submit", (submitEvent) => { submitEvent.preventDefault(); showScreen("event"); showToast("Joined SummerHacks 2026 ✦"); });
  document.querySelector("#memory-author")?.addEventListener("input", (inputEvent) => { appState.author = inputEvent.target.value; updatePreviews(); });
  document.querySelector("#memory-message")?.addEventListener("input", (inputEvent) => {
    appState.message = inputEvent.target.value.slice(0, MEMORY_MESSAGE_MAX_LENGTH);
    inputEvent.target.value = appState.message;
    updatePreviews();
  });
  document.querySelector("#photo-input")?.addEventListener("change", (inputEvent) => {
    const file = inputEvent.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { appState.photo = reader.result; updatePreviews(); showToast("Photo preview updated locally"); }; reader.readAsDataURL(file);
  });
}

document.addEventListener("keydown", (eventTarget) => {
  if (eventTarget.key === "Escape" && appState.modal) closeModal(appState.modal);
  if (appState.modal === "viewer" && eventTarget.key === "ArrowLeft") refreshMemoryCard(-1);
  if (appState.modal === "viewer" && eventTarget.key === "ArrowRight") refreshMemoryCard(1);
});

window.addEventListener("resize", () => { if (appState.screen === "pulse") drawPulseChart(); });

renderApp();
