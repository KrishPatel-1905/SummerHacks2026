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
  {from:0,to:150,label:'A SHARED DIGITAL KEEPSAKE',focus:960},
  {from:150,to:540,label:'01  CREATE IT LIVE',focus:530},
  {from:540,to:750,label:'02  INVITE EVERYONE',focus:960},
  {from:750,to:1180,label:'03  ADD A MEMORY',focus:960},
  {from:1180,to:1390,label:'04  LEAVE YOUR MARK',focus:960},
  {from:1390,to:1625,label:'05  OPEN THE SURPRISE',focus:960},
  {from:1625,to:1727,label:'06  FEEL THE DAY',focus:960,scale:.7,top:185},
];
const asset=x=>staticFile(`assets/${x}`);

const Header=()=>{const f=useCurrentFrame();const c=chapters.find(x=>f>=x.from&&f<x.to)||chapters[0];const p=spring({frame:f-c.from,fps:30,config:{damping:18}});return <><div style={{position:'absolute',left:55,right:55,top:54,display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}><div><div style={{font:'700 22px Space',letterSpacing:'.18em',color:C.yellow}}>SUMMERHACKS 2026</div><div style={{font:'78px/.84 Hand',color:C.cream,marginTop:12}}>EVENT CAPSULE</div></div><div style={{font:'34px Space',color:C.yellow}}>✦</div></div><div style={{position:'absolute',left:55,top:212,padding:'14px 18px',background:C.cream,color:C.ink,border:`3px solid ${C.ink}`,boxShadow:`7px 8px 0 ${C.blue}`,font:'700 20px Space',opacity:p,transform:`translateX(${(1-p)*-25}px) rotate(-1deg)`}}>{c.label}</div></>};

const MobileFootage=()=>{const f=useCurrentFrame();const c=chapters.find(x=>f>=x.from&&f<x.to)||chapters[0];const scale=c.scale??1.05;const left=500-c.focus*scale;const top=c.top??0;return <><OffthreadVideo src={staticFile('recordings/product-flow.webm')} playbackRate={.85} muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'blur(28px) brightness(.35) saturate(1.2)',transform:'scale(1.12)'}}/><div style={{position:'absolute',left:40,top:302,width:1000,height:1125,overflow:'hidden',background:C.navy,border:`4px solid ${C.cream}`,boxShadow:`12px 14px 0 ${C.blue}`}}><OffthreadVideo src={staticFile('recordings/product-flow.webm')} playbackRate={.85} muted style={{position:'absolute',left,top,width:1920*scale,height:1080*scale,maxWidth:'none'}}/></div><Header/></>};

const MobileCaptions=({offset=0})=>{const f=useCurrentFrame()+offset;const line=[...voice].reverse().find(x=>f>=x.at);if(!line||f-line.at>155)return null;const age=f-line.at;const o=interpolate(age,[0,8,142,155],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <div style={{position:'absolute',left:55,right:55,bottom:105,padding:'24px 25px',background:'rgba(2,8,27,.94)',border:`3px solid ${C.cream}`,boxShadow:`9px 10px 0 ${C.blue}`,color:'#fff',font:'700 31px/1.35 Space',textAlign:'center',opacity:o}}>{line.text}</div>};

const MobileOpening=()=>{const f=useCurrentFrame();const o=interpolate(f,[0,10,100,130],[0,1,1,0],{extrapolateRight:'clamp'});return <div style={{position:'absolute',left:40,right:40,top:302,height:1125,display:'grid',placeItems:'center',background:'rgba(2,8,27,.77)',opacity:o}}><div style={{textAlign:'center',padding:40}}><div style={{font:'700 21px Space',letterSpacing:'.15em',color:C.yellow}}>EVERYONE REMEMBERS IT DIFFERENTLY</div><h1 style={{font:'96px/.88 Hand',color:C.cream,margin:'26px 0'}}>See the whole<br/>moment<br/>come alive.</h1></div></div>};

const MobileOutro=()=>{const f=useCurrentFrame();const p=spring({frame:f,fps:30,config:{damping:16}});return <AbsoluteFill style={{background:C.navy,color:C.cream,overflow:'hidden'}}><Img src={asset('galaxy-background.png')} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'brightness(.72)'}}/><Img src={asset('event-capsule-machine.png')} style={{position:'absolute',width:1280,left:-100,top:270,filter:'drop-shadow(0 28px 20px #000)',transform:`translateY(${(1-p)*80}px) scale(${.92+.08*p})`}}/><div style={{position:'absolute',left:60,right:60,top:1040,textAlign:'center',opacity:p}}><div style={{font:'700 22px Space',letterSpacing:'.14em',color:C.yellow}}>ONE EVENT. EVERY PERSPECTIVE.</div><h1 style={{font:'100px/.88 Hand',margin:'28px 0 42px'}}>Capture this moment<br/>together.</h1><div style={{display:'inline-block',padding:'21px 30px',background:C.coral,border:`3px solid ${C.ink}`,boxShadow:`9px 10px 0 ${C.blue}`,font:'700 26px Space'}}>EVENT CAPSULE  ↗</div></div></AbsoluteFill>};

export const LiveDemoMobile=({variant})=><AbsoluteFill style={{background:C.navy}}><style>{`@font-face{font-family:Space;src:url('${staticFile('assets/fonts/space-mono-bold.ttf')}')}@font-face{font-family:Hand;src:url('${staticFile('assets/fonts/caveat-brush.ttf')}')}*{box-sizing:border-box}`}</style><Audio src={staticFile('audio/event-capsule-music.wav')} volume={variant==='voiceover'?.2:.4}/>{variant==='voiceover'&&voice.map(v=><Sequence key={v.file} from={v.at}><Audio src={staticFile(`audio/voice-${v.file}.mp3`)} volume={1}/></Sequence>)}<Sequence from={0} durationInFrames={1727}><MobileFootage/><MobileOpening/><MobileCaptions/></Sequence><Sequence from={1727} durationInFrames={223}><MobileOutro/><MobileCaptions offset={1727}/></Sequence></AbsoluteFill>;
