import { useState } from 'react';
import { Menu } from './ui/Menu';
import { loadSettings, saveSettings, type Settings } from './ui/settings';
import { Workstation } from './ui/Workstation';

type Screen = 'menu' | 'workstation';

export default function App() {
  const playParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('play');
  const [screen, setScreen] = useState<Screen>(playParam ? 'workstation' : 'menu');
  const [wsMode, setWsMode] = useState<'free' | 'tutorial'>(playParam ? 'free' : 'free');
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  if (screen === 'menu') {
    return (
      <Menu
        settings={settings}
        onSettings={updateSettings}
        onStartTutorial={() => {
          setWsMode('tutorial');
          setScreen('workstation');
        }}
        onFreePlay={() => {
          setWsMode('free');
          setScreen('workstation');
        }}
      />
    );
  }

  return (
    <Workstation
      mode={wsMode}
      settings={settings}
      onExit={() => setScreen('menu')}
      onModeChange={(m) => {
        setWsMode(m);
        if (m === 'free') setScreen('workstation');
      }}
    />
  );
}
