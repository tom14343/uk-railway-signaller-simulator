import { useState } from 'react';
import { saveSettings, type Settings } from './settings';

type Screen = 'menu' | 'settings' | 'about';

interface Props {
  settings: Settings;
  onSettings: (s: Settings) => void;
  onStartTutorial: () => void;
  onFreePlay: () => void;
}

export function Menu({ settings, onSettings, onStartTutorial, onFreePlay }: Props) {
  const [screen, setScreen] = useState<Screen>('menu');

  const update = (s: Settings) => {
    onSettings(s);
    saveSettings(s);
  };

  if (screen === 'settings') {
    return (
      <div className="menu-screen">
        <div className="menu-card settings-card">
          <h2>Settings</h2>
          <label className="setting-row">
            <span>Default simulation speed</span>
            <select
              value={settings.defaultSpeed}
              onChange={(e) => update({ ...settings, defaultSpeed: Number(e.target.value) })}
            >
              {[1, 2, 4, 8, 16].map((v) => (
                <option key={v} value={v}>{v}×</option>
              ))}
            </select>
          </label>
          <label className="setting-row">
            <span>Signal labels on diagram</span>
            <input
              type="checkbox"
              checked={settings.showLabels}
              onChange={(e) => update({ ...settings, showLabels: e.target.checked })}
            />
          </label>
          <div className="setting-row">
            <span>Tutorial</span>
            <button className="menu-btn" onClick={() => { setScreen('menu'); onStartTutorial(); }}>
              Restart tutorial
            </button>
          </div>
          <div className="menu-actions">
            <button className="menu-btn" onClick={() => setScreen('menu')}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'about') {
    return (
      <div className="menu-screen">
        <div className="menu-card about-card">
          <h2>About</h2>
          <p>
            UK Railway Signaller Simulator is an open-source, browser-based educational
            simulation of British railway signalling. It currently contains one
            signalling area: <strong>Adamfield</strong>, a fictional four-line
            colour-light signalling territory with three stations.
          </p>
          <p>
            The simulation models four-aspect signalling, block sections, route
            and point interlocking, and timetable-driven train movements.
          </p>
          <p className="about-disclaimer">
            This is an educational simulation only. It is not an operational
            signalling system, is not safety-approved, and must not be used for
            real railway operation or training that requires certified material.
          </p>
          <p className="about-license">Released under the MIT License.</p>
          <div className="menu-actions">
            <button className="menu-btn" onClick={() => setScreen('menu')}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-screen">
      <div className="menu-hero">
        <div className="menu-tracks" aria-hidden="true">
          <div className="menu-track" /><div className="menu-track" /><div className="menu-track" /><div className="menu-track" />
        </div>
        <h1>UK Railway Signaller Simulator</h1>
        <p className="menu-subtitle">A railway signalling simulation.</p>
        <div className="menu-actions">
          <button className="menu-btn menu-btn-primary" onClick={onStartTutorial}>Start Tutorial</button>
          <button className="menu-btn" onClick={onFreePlay}>Free Play</button>
          <button className="menu-btn" onClick={() => setScreen('settings')}>Settings</button>
          <button className="menu-btn" onClick={() => setScreen('about')}>About</button>
        </div>
        <p className="menu-foot">Open source · Adamfield signalling area · Educational use only</p>
      </div>
    </div>
  );
}
