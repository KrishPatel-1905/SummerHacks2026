import React from 'react';
import {Composition} from 'remotion';
import {LiveDemoVideo} from './LiveDemoVideo.jsx';

export const VideoRoot = () => (
  <>
    <Composition id="EventCapsuleVoiceover" component={LiveDemoVideo} durationInFrames={1950} fps={30} width={1920} height={1080} defaultProps={{variant: 'voiceover'}} />
    <Composition id="EventCapsuleCaptions" component={LiveDemoVideo} durationInFrames={1950} fps={30} width={1920} height={1080} defaultProps={{variant: 'captions'}} />
  </>
);
