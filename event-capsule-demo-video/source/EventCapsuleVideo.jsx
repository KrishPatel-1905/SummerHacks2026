import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const C = {navy:'#02081b', blue:'#2357d8', coral:'#f25a47', yellow:'#f6c542', cream:'#f7eedc', mint:'#8dcab5', lavender:'#aa91d7', ink:'#151515'};
const photos = ['concert','ferris','campfire','mountains','fireworks','sunset'];
const scenes = [
  {from:0, dur:180, kicker:'EVERYONE REMEMBERS IT DIFFERENTLY', title:'The moment belongs\nto everyone.', copy:'Photos. Feelings. Tiny details. One shared story.'},
  {from:180, dur:180, kicker:'INTRODUCING', title:'EVENT\nCAPSULE', copy:'A shared digital keepsake for the moments worth holding onto.'},
  {from:360, dur:270, kicker:'01 — MAKE IT YOURS', title:'Create your capsule.', copy:'Name the event. Pick a color. Add a sticker. Watch it come alive.'},
  {from:630, dur:210, kicker:'02 — INVITE EVERYONE', title:'One scan.\nEveryone’s in.', copy:'Share a QR code or a six-character invite code.'},
  {from:840, dur:360, kicker:'03 — ADD A MEMORY', title:'Every perspective\ngets a place.', copy:'Guests add a photo, short message, mood, and hand-drawn touch.'},
  {from:1200, dur:270, kicker:'04 — KEEP THE SURPRISE', title:'Sealed like\na little keepsake.', copy:'Memories collect as envelopes, ready to find and open.'},
  {from:1470, dur:270, kicker:'05 — FEEL THE DAY', title:'Meet Event Pulse.', copy:'Moods, themes, activity, and the story of the day—together.'},
  {from:1740, dur:210, kicker:'ONE EVENT. EVERY PERSPECTIVE.', title:'Capture this moment\ntogether.', copy:'EVENT CAPSULE  ·  SUMMERHACKS 2026'},
];

const asset = (name) => staticFile(`assets/${name}`);
const font = (name) => staticFile(`assets/fonts/${name}`);

const css = `
@font-face{font-family:Space;src:url('${font('space-mono-bold.ttf')}')}@font-face{font-family:Hand;src:url('${font('caveat-brush.ttf')}')}@font-face{font-family:Patrick;src:url('${font('patrick-hand.ttf')}')}
*{box-sizing:border-box}.scene{font-family:Space;color:${C.cream};overflow:hidden;background:${C.navy}}
.grain{position:absolute;inset:0;opacity:.16;background-image:url('${asset('paper-grain.svg')}');mix-blend-mode:screen;pointer-events:none}
.stars{position:absolute;inset:-8%;background:url('${asset('galaxy-background.png')}') center/cover;filter:saturate(1.08) brightness(.72)}
.kicker{font-size:24px;letter-spacing:.18em;color:${C.yellow};margin-bottom:24px}.title{white-space:pre-line;font:92px/.88 Hand;letter-spacing:-.025em;margin:0}.copy{font:27px/1.45 Patrick;max-width:690px;margin:28px 0 0;color:#fff}
.marker{display:inline-block;position:relative;z-index:1}.marker:after{content:'';position:absolute;z-index:-1;left:-12px;right:-12px;bottom:2px;height:19px;background:${C.blue};transform:rotate(-1.5deg) skew(-10deg)}
.paper{background:${C.cream};color:${C.ink};border:4px solid ${C.ink};box-shadow:12px 14px 0 rgba(0,0,0,.42)}
.pill{display:inline-block;padding:10px 19px;background:${C.yellow};color:${C.ink};border:3px solid ${C.ink};font:19px Space;transform:rotate(-2deg)}
`;

const Enter = ({children, delay=0, y=44, style={}}) => {
  const frame = useCurrentFrame();
  const p = spring({frame:frame-delay, fps:30, config:{damping:16, stiffness:95}});
  return <div style={{opacity:p, transform:`translateY(${(1-p)*y}px)`, ...style}}>{children}</div>;
};

const TextBlock = ({scene, align='left'}) => (
  <div style={{position:'absolute',left:align==='left'?105:990,right:align==='left'?900:100,top:150,zIndex:10,textAlign:align}}>
    <Enter><div className="kicker">{scene.kicker}</div></Enter>
    <Enter delay={8}><h1 className="title"><span className="marker">{scene.title}</span></h1></Enter>
    <Enter delay={18}><p className="copy" style={{marginLeft:align==='right'?'auto':0}}>{scene.copy}</p></Enter>
  </div>
);

const Intro = ({scene}) => {
  const frame=useCurrentFrame();
  return <AbsoluteFill className="scene"><div className="stars" style={{transform:`scale(${1+frame/9000})`}}/><TextBlock scene={scene}/>
    {photos.map((p,i)=>{const x=[1040,1380,1550,1120,1450,1660][i], y=[80,110,390,590,650,820][i]; const rot=[-8,6,-3,7,-5,4][i]; const q=spring({frame:frame-i*6,fps:30,config:{damping:18}});return <div key={p} className="paper" style={{position:'absolute',left:x,top:y,width:250,padding:12,opacity:q,transform:`translateY(${(1-q)*70}px) rotate(${rot}deg)`}}><Img src={asset(`photo-${p}.png`)} style={{width:'100%',display:'block',border:`3px solid ${C.ink}`}}/><div style={{font:'26px Patrick',padding:'12px 4px 4px'}}>a moment worth keeping ✦</div></div>})}
  </AbsoluteFill>;
};

const Machine = ({scene,final=false}) => {
  const frame=useCurrentFrame(); const p=spring({frame,fps:30,config:{damping:13,stiffness:80}});
  return <AbsoluteFill className="scene"><div className="stars"/><TextBlock scene={scene}/><Img src={asset('event-capsule-machine.png')} style={{position:'absolute',width:1010,right:20,top:205,filter:'drop-shadow(0 30px 22px #000)',transform:`scale(${.84+.16*p}) rotate(${Math.sin(frame/22)*.35}deg)`}}/>
    {final&&<><Img src={asset('mascot-crew-left.png')} style={{position:'absolute',left:40,bottom:-10,width:330}}/><Img src={asset('mascot-crew-right.png')} style={{position:'absolute',right:20,bottom:-10,width:340}}/></>}
  </AbsoluteFill>;
};

const Customize = ({scene}) => {const f=useCurrentFrame(); const colors=[C.blue,C.coral,C.mint,C.lavender]; const choice=Math.min(3,Math.floor(f/55));return <AbsoluteFill className="scene"><div className="stars"/><TextBlock scene={scene}/>
  <div className="paper" style={{position:'absolute',right:90,top:95,width:760,height:875,padding:42,transform:'rotate(1deg)'}}><div style={{font:'48px Hand'}}>CREATE YOUR CAPSULE</div><div style={{font:'18px Space',marginTop:30}}>EVENT NAME</div><div style={{borderBottom:`4px solid ${C.ink}`,font:'38px Patrick',padding:'12px 4px'}}>SummerHacks Afterglow</div><div style={{font:'18px Space',marginTop:34}}>PICK A COLOR</div><div style={{display:'flex',gap:22,marginTop:18}}>{colors.map((c,i)=><div key={c} style={{width:74,height:74,border:`4px solid ${C.ink}`,background:c,transform:i===choice?'scale(1.18) rotate(-5deg)':'none',boxShadow:i===choice?'6px 7px 0 #111':'none'}}/>)}</div><div style={{font:'18px Space',marginTop:38}}>LIVE PREVIEW</div><Img src={asset('event-capsule-machine.png')} style={{width:650,marginLeft:30,marginTop:4,filter:`drop-shadow(0 16px 8px ${colors[choice]}88)`}}/></div>
  </AbsoluteFill>};

const Invite = ({scene}) => {const f=useCurrentFrame();return <AbsoluteFill className="scene"><div className="stars"/><TextBlock scene={scene}/><div className="paper" style={{position:'absolute',right:130,top:130,width:690,height:760,padding:48,transform:'rotate(-1.5deg)'}}><div style={{font:'54px Hand'}}>INVITE EVERYONE</div><div style={{display:'flex',gap:45,alignItems:'center',marginTop:45}}><div style={{width:270,height:270,padding:20,background:'#fff',border:`4px solid ${C.ink}`,display:'grid',gridTemplateColumns:'repeat(9,1fr)',gap:4}}>{Array.from({length:81},(_,i)=><i key={i} style={{background:(i*7%11<5||i%13===0)?C.ink:'transparent'}}/>)}</div><div><div style={{font:'18px Space'}}>INVITE CODE</div><div style={{font:'50px Space',letterSpacing:'.12em',marginTop:16}}>STAR26</div><div className="pill" style={{marginTop:40,transform:`scale(${1+.04*Math.sin(f/8)}) rotate(-2deg)`}}>SCAN TO JOIN ↗</div></div></div><div style={{font:'28px Patrick',marginTop:65}}>No accounts. No app download. Just one shared place for the whole event.</div></div></AbsoluteFill>};

const Contribute = ({scene}) => {const f=useCurrentFrame(); const typed='We made it — together!'.slice(0,Math.max(0,Math.floor((f-70)/3)));return <AbsoluteFill className="scene"><div className="stars"/><TextBlock scene={scene}/><div className="paper" style={{position:'absolute',right:55,top:65,width:850,height:930,padding:34,transform:'rotate(.7deg)'}}><div style={{font:'50px Hand'}}>ADD YOUR MEMORY</div><div style={{display:'grid',gridTemplateColumns:'330px 1fr',gap:36,marginTop:25}}><div><div style={{padding:12,border:`4px solid ${C.ink}`,background:'#fff'}}><Img src={asset('photo-concert.png')} style={{width:'100%',display:'block'}}/></div><div style={{font:'23px Patrick',marginTop:15}}>CHANGE PHOTO</div></div><div><div style={{font:'17px Space'}}>YOUR NAME</div><div style={{font:'30px Patrick',borderBottom:`3px solid ${C.ink}`,padding:'8px 0'}}>Maya</div><div style={{font:'17px Space',marginTop:28}}>YOUR MEMORY</div><div style={{font:'32px Patrick',border:`3px solid ${C.ink}`,height:125,padding:15}}>{typed}<span style={{opacity:f%20<10?1:0}}>|</span></div><div style={{font:'17px Space',marginTop:28}}>HOW DID IT FEEL?</div><div style={{display:'flex',gap:12,fontSize:43,marginTop:12}}><span>🙂</span><span style={{transform:'scale(1.22)',filter:'drop-shadow(4px 4px 0 #f25a47)'}}>🥳</span><span>❤️</span><span>🥹</span></div></div></div><div style={{marginTop:30,border:`3px dashed ${C.blue}`,padding:20,font:'29px Patrick'}}>✦ LIVE POSTCARD PREVIEW — “We made it — together!”</div><div className="pill" style={{float:'right',marginTop:25,background:C.coral,color:'#fff'}}>SEND TO CAPSULE ➶</div></div></AbsoluteFill>};

const Keepsake = ({scene}) => {const f=useCurrentFrame();return <AbsoluteFill className="scene"><div className="stars"/><TextBlock scene={scene}/><div style={{position:'absolute',right:90,top:120,width:800,height:820}}>{Array.from({length:7},(_,i)=><div key={i} className="paper" style={{position:'absolute',left:110+(i%3)*165,top:120+Math.floor(i/3)*150,width:330,height:205,background:[C.lavender,C.mint,C.yellow,C.coral,C.cream][i%5],transform:`translateY(${Math.max(0,120-(f-i*12)*4)}px) rotate(${[-7,4,-2,6,-5][i%5]}deg)`,padding:26,font:'34px Hand'}}>{['AK ✦','J + M ♡','WE DID IT!','8.08 ☆','CAPSULE','T + K','A LITTLE MEMORY'][i]}<div style={{font:'18px Space',position:'absolute',bottom:22,right:22}}>SEALED ●</div></div>)}</div></AbsoluteFill>};

const Pulse = ({scene}) => {const f=useCurrentFrame(); const bars=[72,54,39,25];return <AbsoluteFill className="scene"><div className="stars"/><TextBlock scene={scene}/><div className="paper" style={{position:'absolute',right:80,top:65,width:870,height:940,padding:42}}><div style={{font:'52px Hand'}}>EVENT PULSE</div><div style={{font:'20px Space',marginTop:15}}>WHAT DID TODAY FEEL LIKE?</div>{bars.map((b,i)=><div key={b} style={{display:'grid',gridTemplateColumns:'65px 150px 1fr 60px',alignItems:'center',gap:12,marginTop:28,font:'21px Space'}}><span style={{fontSize:38}}>{['🥳','❤️','🥹','🙂'][i]}</span><span>{['EXCITED','LOVED','EMOTIONAL','HAPPY'][i]}</span><div style={{height:25,border:`3px solid ${C.ink}`}}><div style={{height:'100%',width:`${Math.min(b,b*f/45)}%`,background:[C.coral,C.lavender,C.blue,C.mint][i]}}/></div><strong>{b}%</strong></div>)}<div style={{display:'flex',gap:16,marginTop:45}}>{['FRIENDS','MILESTONE','MUSIC','SUMMER'].map((x,i)=><span className="pill" key={x} style={{background:[C.yellow,C.mint,C.coral,C.lavender][i],fontSize:16}}>{x}</span>)}</div><div style={{marginTop:48,padding:25,border:`3px solid ${C.ink}`,font:'28px Patrick',lineHeight:1.35}}>☆ The Story of the Day<br/><span style={{fontSize:23}}>A joyful, high-energy celebration shaped by friendship, music, and one unforgettable shared milestone.</span></div></div></AbsoluteFill>};

const Caption = ({scene, variant}) => {const f=useCurrentFrame(); const opacity=interpolate(f,[0,10,scene.dur-16,scene.dur],[0,1,1,0]);return <div style={{position:'absolute',zIndex:50,left:variant==='captions'?280:370,right:variant==='captions'?280:370,bottom:45,padding:'18px 28px',background:'rgba(2,8,27,.88)',border:`2px solid ${C.cream}`,color:'#fff',font:'25px Space',textAlign:'center',opacity,boxShadow:`8px 8px 0 ${C.blue}`}}>{scene.copy}</div>};

const Scene = ({scene,index}) => {if(index===0)return <Intro scene={scene}/>;if(index===1||index===7)return <Machine scene={scene} final={index===7}/>;if(index===2)return <Customize scene={scene}/>;if(index===3)return <Invite scene={scene}/>;if(index===4)return <Contribute scene={scene}/>;if(index===5)return <Keepsake scene={scene}/>;return <Pulse scene={scene}/>};

export const EventCapsuleVideo = ({variant}) => <AbsoluteFill style={{background:C.navy}}><style>{css}</style><Audio src={staticFile('audio/event-capsule-music.wav')} volume={variant==='voiceover'?.24:.42}/>{scenes.map((s,i)=><Sequence key={s.from} from={s.from} durationInFrames={s.dur}>{variant==='voiceover'&&<Sequence from={18}><Audio src={staticFile(`audio/voice-${i}.mp3`)} volume={1}/></Sequence>}<Scene scene={s} index={i}/><Caption scene={s} variant={variant}/><div className="grain"/></Sequence>)}</AbsoluteFill>;
