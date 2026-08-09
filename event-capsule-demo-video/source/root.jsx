import React from 'react';
import {Composition} from 'remotion';
import {LiveDemoVideo} from './LiveDemoVideo.jsx';
import {LiveDemoMobile} from './LiveDemoMobile.jsx';

export const VideoRoot = () => (
  <>
    <Composition id="EventCapsuleVoiceover" component={LiveDemoVideo} durationInFrames={1950} fps={30} width={1920} height={1080} defaultProps={{variant: 'voiceover'}} />
    <Composition id="EventCapsuleCaptions" component={LiveDemoVideo} durationInFrames={1950} fps={30} width={1920} height={1080} defaultProps={{variant: 'captions'}} />
    <Composition id="EventCapsuleVoiceoverMobile" component={LiveDemoMobile} durationInFrames={1950} fps={30} width={1080} height={1920} defaultProps={{variant: 'voiceover'}} />
    <Composition id="EventCapsuleCaptionsMobile" component={LiveDemoMobile} durationInFrames={1950} fps={30} width={1080} height={1920} defaultProps={{variant: 'captions'}} />
  </>
);
