import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createAudioPlayer, preload, AudioPlayer } from 'expo-audio';
import { getSetting, setSetting } from '@/database';

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
        player.volume = 1.0;
        this.players.push(player);
        this.hasPlayed.push(false);
    }
  }

  play() {
    try {
      const idx = this.currentIndex;
      const player = this.players[idx];
      
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

interface SoundContextType {
  soundsEnabled: boolean;
  setSoundsEnabled: (enabled: boolean) => Promise<void>;
  playSound: (name: 'timeline' | 'statistics' | 'settings' | 'setTime' | 'slider') => void;
}

const SoundContext = createContext<SoundContextType>({
  soundsEnabled: true,
  setSoundsEnabled: async () => {},
  playSound: () => {},
});

export function SoundProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [soundsEnabled, setSoundsEnabledState] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const val = await getSetting('sounds_enabled', 'true');
        setSoundsEnabledState(val === 'true');
      } catch (e) {}
    }
    loadSettings();
  }, []);

  const setSoundsEnabled = async (enabled: boolean) => {
    setSoundsEnabledState(enabled);
    await setSetting('sounds_enabled', enabled ? 'true' : 'false');
  };

  const playSound = (name: 'timeline' | 'statistics' | 'settings' | 'setTime' | 'slider') => {
    if (!soundsEnabled) return;
    
    if (name === 'timeline') timelinePool.play();
    else if (name === 'statistics') statisticsPool.play();
    else if (name === 'settings') settingsPool.play();
    else if (name === 'setTime') setTimePool.play();
    else if (name === 'slider') sliderPool.play();
  };

  return (
    <SoundContext.Provider value={{ soundsEnabled, setSoundsEnabled, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export const useSound = () => useContext(SoundContext);

