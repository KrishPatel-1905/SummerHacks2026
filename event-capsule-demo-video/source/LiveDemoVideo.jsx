import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';

const C={navy:'#02081b',blue:'#2357d8',coral:'#f25a47',yellow:'#f6c542',cream:'#f7eedc',ink:'#141414'};
const voice=[
  {at:18,file:0,text:"The best moments aren't remembered by just one person."},
  {at:105,file:1,text:"Event Capsule brings everyone's memories together."},
  {at:225,file:2,text:'Create a capsule for any celebration, and make it yours.'},
  {at:570,file:3,text:'Invite everyone with one code, or a quick scan.'},
  {at:810,file:4,text:'Guests add photos, messages, moods, and personal doodles.'},
  {at:1320,file:5,text:'Each contribution becomes a sealed little keepsake.'},
  {at:1630,file:6,text:'Event Pulse turns every perspective into the story of the day.'},
  {at:1780,file:7,text:'One event. Every perspective. Capture this moment together, with Event Capsule.'},
];
const chapters=[
  {from:0,to:150,label:'A SHARED DIGITAL KEEPSAKE'},
  {from:150,to:540,label:'01  CREATE IT LIVE'},
  {from:540,to:750,label:'02  INVITE EVERYONE'},
  {from:750,to:1180,label:'03  ADD A MEMORY'},
  {from:1180,to:1390,label:'04  LEAVE YOUR MARK'},
  {from:1390,to:1625,label:'05  OPEN THE SURPRISE'},
  {from:1625,to:1727,label:'06  FEEL THE DAY'},
];
const asset=(x)=>staticFile(`assets/${x}`);

const ChapterTag=()=>{const f=useCurrentFrame();const c=chapters.find(x=>f>=x.from&&f<x.to);if(!c)return null;const local=f-c.from;const p=spring({frame:local,fps:30,config:{damping:18}});const out=interpolate(f,[c.to-12,c.to],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <div style={{position:'absolute',left:42,top:38,padding:'13px 20px',background:C.cream,color:C.ink,border:`3px solid ${C.ink}`,boxShadow:`7px 8px 0 ${C.blue}`,font:'700 21px Space',letterSpacing:'.08em',opacity:p*out,transform:`translateX(${(1-p)*-30}px) rotate(-1deg)`}}>{c.label}</div>};

const Captions=({variant,offset=0})=>{const f=useCurrentFrame()+offset;const line=[...voice].reverse().find(x=>f>=x.at);if(!line||f-line.at>155)return null;const age=f-line.at;const o=interpolate(age,[0,8,142,155],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <div style={{position:'absolute',left:variant==='captions'?250:330,right:variant==='captions'?250:330,bottom:30,padding:'15px 24px',background:'rgba(2,8,27,.9)',border:`2px solid ${C.cream}`,boxShadow:`7px 8px 0 ${C.blue}`,color:'#fff',font:'700 24px Space',lineHeight:1.25,textAlign:'center',opacity:o}}>{line.text}</div>};

const Opening=()=>{const f=useCurrentFrame();const o=interpolate(f,[0,12,105,130],[0,1,1,0],{extrapolateRight:'clamp'});return <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'linear-gradient(90deg,rgba(2,8,27,.82),rgba(2,8,27,.2),rgba(2,8,27,.72))',opacity:o}}><div style={{textAlign:'center',transform:`scale(${.94+Math.min(f,30)/500})`}}><div style={{font:'700 24px Space',letterSpacing:'.22em',color:C.yellow}}>EVERYONE REMEMBERS IT DIFFERENTLY</div><h1 style={{margin:'15px 0 0',font:'112px/.86 Hand',color:C.cream,textShadow:'0 8px 0 rgba(0,0,0,.35)'}}>See the whole moment<br/><span style={{position:'relative'}}>come alive.</span></h1></div></div>};

const Outro=()=>{const f=useCurrentFrame();const p=spring({frame:f,fps:30,config:{damping:16,stiffness:80}});return <AbsoluteFill style={{background:C.navy,overflow:'hidden',color:C.cream}}><Img src={asset('galaxy-background.png')} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'brightness(.72)'}}/><Img src={asset('event-capsule-machine.png')} style={{position:'absolute',width:1030,right:-40,top:170,filter:'drop-shadow(0 25px 18px #000)',transform:`translateX(${(1-p)*120}px) scale(${.9+.1*p})`}}/><div style={{position:'absolute',left:100,top:205,width:770,opacity:p,transform:`translateY(${(1-p)*45}px)`}}><div style={{font:'700 23px Space',letterSpacing:'.17em',color:C.yellow}}>ONE EVENT. EVERY PERSPECTIVE.</div><h1 style={{font:'108px/.85 Hand',margin:'25px 0',whiteSpace:'pre-line'}}>Capture this moment<br/>together.</h1><div style={{display:'inline-block',padding:'17px 25px',background:C.coral,border:`3px solid ${C.ink}`,boxShadow:`8px 9px 0 ${C.blue}`,font:'700 24px Space'}}>EVENT CAPSULE  ↗</div></div></AbsoluteFill>};

export const LiveDemoVideo=({variant})=><AbsoluteFill style={{background:C.navy}}><style>{`@font-face{font-family:Space;src:url('${staticFile('assets/fonts/space-mono-bold.ttf')}')}@font-face{font-family:Hand;src:url('${staticFile('assets/fonts/caveat-brush.ttf')}')}*{box-sizing:border-box}`}</style><Audio src={staticFile('audio/event-capsule-music.wav')} volume={variant==='voiceover'?.2:.4}/>{variant==='voiceover'&&voice.map(v=><Sequence key={v.file} from={v.at}><Audio src={staticFile(`audio/voice-${v.file}.mp3`)} volume={1}/></Sequence>)}<Sequence from={0} durationInFrames={1727}><OffthreadVideo src={staticFile('recordings/product-flow.webm')} playbackRate={.85} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/><ChapterTag/><Opening/><Captions variant={variant}/></Sequence><Sequence from={1727} durationInFrames={223}><Outro/><Captions variant={variant} offset={1727}/></Sequence></AbsoluteFill>;
