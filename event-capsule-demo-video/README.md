# Event Capsule demo videos

Self-contained Remotion project and rendered 65-second hackathon ad variants.

## Finished videos

- `deliverables/event-capsule-voiceover.mp4` — conversational AI voiceover, original music, and captions.
- `deliverables/event-capsule-music-captions.mp4` — original music and captions without narration.

Both masters are 1920×1080, 30 fps, H.264 video with stereo AAC audio.

## Re-render

```powershell
npm install
npm run music
npm run render
```

The original music is generated locally by `source/generate-music.mjs`. Product artwork, fonts, narration clips, frame previews, and voice auditions are included in this folder.
