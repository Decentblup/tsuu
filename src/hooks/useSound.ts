import { createAudioPlayer, preload, AudioPlayer } from 'expo-audio';

const sTimeline = require('../../assets/sounds/timeline.wav');
const sStats = require('../../assets/sounds/statistics.wav');
const sSettings = require('../../assets/sounds/settings.wav');
const sSetTime = require('../../assets/sounds/set_time.wav');
const sSlider = require('../../assets/sounds/slider.wav');

// Preload into native memory for near-instant zero-latency playback
preload(sTimeline);
preload(sStats);
preload(sSettings);
preload(sSetTime);
preload(sSlider);

class SoundPool {
  players: AudioPlayer[] = [];
  hasPlayed: boolean[] = [];
  currentIndex = 0;

  constructor(source: any, count = 3) {
    for (let i = 0; i < count; i++) {
        const player = createAudioPlayer(source);
        // Ensure strictly max volume natively
        player.volume = 1.0;
        this.players.push(player);
        this.hasPlayed.push(false);
    }
  }

  play() {
    try {
      const idx = this.currentIndex;
      const player = this.players[idx];
      
      // Android Mediaplayer causes native playback to drop if we call seekTo(0) 
      // before it has fully finished async native initialization/buffering.
      // Since new players inherently start at 0, we can safely skip the rewind 
      // on their absolute first use and just call play(), allowing it to natively queue.
      if (this.hasPlayed[idx]) {
        player.seekTo(0); 
      }
      
      this.hasPlayed[idx] = true;
      player.play();

      this.currentIndex = (this.currentIndex + 1) % this.players.length;
    } catch (e) {
      console.log('Error playing sound from pool', e);
    }
  }
}

// Tailor the pool size 
const timelinePool = new SoundPool(sTimeline, 3);
const statisticsPool = new SoundPool(sStats, 3);
const settingsPool = new SoundPool(sSettings, 3);
const setTimePool = new SoundPool(sSetTime, 3);
const sliderPool = new SoundPool(sSlider, 15);

export const useSound = () => {
  const playSound = (name: 'timeline' | 'statistics' | 'settings' | 'setTime' | 'slider') => {
    if (name === 'timeline') timelinePool.play();
    else if (name === 'statistics') statisticsPool.play();
    else if (name === 'settings') settingsPool.play();
    else if (name === 'setTime') setTimePool.play();
    else if (name === 'slider') sliderPool.play();
  };

  return { playSound };
};
