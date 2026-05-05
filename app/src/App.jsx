import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopBar from './components/layout/TopBar';
import BottomNav from './components/layout/BottomNav';

import IncidentMap from './pages/public/IncidentMap';
import Dashboard from './pages/private/Dashboard';
import EmergencyControl from './pages/private/EmergencyControl';
import Settings from './pages/private/Settings';
import Logs from './pages/private/Logs';


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
      <BottomNav />
    </BrowserRouter>
  );
}
