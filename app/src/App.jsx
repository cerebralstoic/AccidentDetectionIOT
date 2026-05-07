import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopBar from './components/layout/TopBar';
import BottomNav from './components/layout/BottomNav';
import AlertSystem from './components/AlertSystem';
import { usePublicIncidents, useViewerLocation } from './firebase';

import IncidentMap from './pages/public/IncidentMap';
import Dashboard from './pages/private/Dashboard';
import EmergencyControl from './pages/private/EmergencyControl';
import Settings from './pages/private/Settings';
import Logs from './pages/private/Logs';

function GlobalAlerts() {
  const { incidents } = usePublicIncidents(200);
  const { coords }    = useViewerLocation();

  const [radiusKm, setRadiusKm] = useState(() => {
    const saved = Number(localStorage.getItem('alertRadiusKm'));
    return Number.isFinite(saved) && saved > 0 ? saved : 5;
  });

  useEffect(() => {
    const handler = () => {
      const v = Number(localStorage.getItem('alertRadiusKm'));
      if (Number.isFinite(v) && v > 0) setRadiusKm(v);
    };
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 1000);
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }, []);

  return (
    <AlertSystem
      incidents={incidents}
      viewerCoords={coords}
      radiusKm={radiusKm}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TopBar />
      <main className="pt-16 pb-20 min-h-screen max-w-7xl mx-auto w-full relative">
        <Routes>
          <Route path="/" element={<IncidentMap />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/emergency" element={<EmergencyControl />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <GlobalAlerts />
      <BottomNav />
    </BrowserRouter>
  );
}
