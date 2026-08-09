import fs from 'node:fs';
import path from 'node:path';

const rate=44100, seconds=65, channels=2, samples=rate*seconds;
const data=Buffer.alloc(samples*channels*2); const bpm=112, beat=60/bpm;
const chords=[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]];
const clamp=x=>Math.max(-1,Math.min(1,x));
function env(t,len,a=.02,r=.12){return Math.min(1,t/a)*Math.min(1,(len-t)/r)}
function tone(t,f){return Math.sin(2*Math.PI*f*t)+.22*Math.sin(4*Math.PI*f*t)}
for(let n=0;n<samples;n++){
  const t=n/rate, bi=Math.floor(t/beat), bt=t%beat, ci=Math.floor(bi/4)%4;
  let v=0;
  for(const f of chords[ci]) v+=tone(t,f)*.055;
  const bass=chords[ci][0]/2; v+=tone(bt,bass)*env(bt,beat,.01,.16)*.18;
  if(bt<.16)v+=Math.sin(2*Math.PI*(95-260*bt)*bt)*env(bt,.16,.005,.08)*.36;
  const half=t%(beat*2); if(half>beat&&half<beat+.12){const x=half-beat;v+=(Math.random()*2-1)*env(x,.12,.002,.1)*.14;}
  const eighth=t%(beat/2); if(eighth<.035)v+=(Math.random()*2-1)*env(eighth,.035,.001,.025)*.055;
  const melody=[523.25,659.25,783.99,659.25,440,523.25,659.25,587.33][bi%8]; v+=tone(bt,melody)*env(bt,beat,.015,.22)*.055;
  const fade=Math.min(1,t/1.5,(seconds-t)/2); const s=Math.round(clamp(v*fade)*32767);
  data.writeInt16LE(s,n*4); data.writeInt16LE(s,n*4+2);
}
const header=Buffer.alloc(44); header.write('RIFF',0);header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*channels*2,28);header.writeUInt16LE(channels*2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
const out=path.resolve('source/public/audio/event-capsule-music.wav');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.concat([header,data]));console.log(out);
