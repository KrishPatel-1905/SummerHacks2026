# Event Capsule demo videos

Self-contained Remotion project and rendered 65-second hackathon ad variants. The videos use a real, automated browser session rather than static product mockups.

## Finished videos

- `deliverables/event-capsule-voiceover.mp4` — conversational AI voiceover, original music, and captions.
- `deliverables/event-capsule-music-captions.mp4` — original music and captions without narration.

Both masters are 1920×1080, 30 fps, H.264 video with stereo AAC audio.

## Re-render

```powershell
npm install
npm run capture
npm run music
npm run render
```

Run the app's `npm run dev:memory` command on port 3100 before `npm run capture`. The capture drives capsule creation, invitation, photo upload, message and mood entry, envelope drawing, memory reveal, and Event Pulse with a visible custom cursor.

The original music is generated locally by `source/generate-music.mjs`. Product artwork, fonts, narration clips, live browser footage, frame previews, and voice auditions are included in this folder.
