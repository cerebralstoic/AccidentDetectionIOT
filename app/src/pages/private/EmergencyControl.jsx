import { useState } from 'react';
import { ref, set, push, serverTimestamp } from 'firebase/database';
import { getDatabase } from 'firebase/database';
import { useLiveSnapshot, useEvents, isDeviceOnline, DEVICE_ID } from '../../firebase';

const db = getDatabase();

function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString();
}
function formatRel(ts) {
    if (!ts) return '—';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
}

async function sendCommand(name, value) {
    const r = ref(db, `devices/${DEVICE_ID}/commands/${name}`);
    await set(r, { value, timestamp: serverTimestamp() });
}

async function logManualSOS(snapshot) {
    const r = ref(db, `devices/${DEVICE_ID}/events`);
    await push(r, {
        eventType: 'manual_sos',
        severity: 'severe',
        deviceId: DEVICE_ID,
        latitude:  snapshot?.latitude ?? null,
        longitude: snapshot?.longitude ?? null,
        ax: snapshot?.ax ?? 0,
        ay: snapshot?.ay ?? 0,
        az: snapshot?.az ?? 0,
        gx: snapshot?.gx ?? 0,
        gy: snapshot?.gy ?? 0,
        gz: snapshot?.gz ?? 0,
        tiltDeg:  snapshot?.tiltDeg  ?? 0,
        netAccel: snapshot?.netAccel ?? 0,
        vibrationState: snapshot?.vibrationState ?? 0,
        gpsReal: snapshot?.gpsReal ?? false,
        timestamp: serverTimestamp(),
        source: 'dashboard',
    });
}

export default function EmergencyControl() {
    const { snapshot } = useLiveSnapshot();
    const { events }   = useEvents(20);
    const online       = isDeviceOnline(snapshot);

    const [buzzerOn, setBuzzerOn] = useState(false);
    const [ledOn,    setLedOn]    = useState(false);
    const [sosBusy,  setSosBusy]  = useState(false);
    const [sosMsg,   setSosMsg]   = useState('');

    const handleSOS = async () => {
        setSosBusy(true);
        setSosMsg('');
        try {
            await logManualSOS(snapshot);
            setSosMsg('SOS broadcast logged to cloud.');
        } catch (e) {
            setSosMsg(`Failed: ${e.message}`);
        }
        setSosBusy(false);
        setTimeout(() => setSosMsg(''), 5000);
    };

    const toggleBuzzer = async () => {
        const next = !buzzerOn;
        setBuzzerOn(next);
        try { await sendCommand('buzzer', next ? 1 : 0); } catch { /* device may not be listening yet */ }
    };
    const toggleLED = async () => {
        const next = !ledOn;
        setLedOn(next);
        try { await sendCommand('led', next ? 1 : 0); } catch { /* device may not be listening yet */ }
    };

    const eventCount = events.length;
    const lastEventTime = events[0]?.timestamp;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-on-surface">
            <div className="lg:col-span-8 space-y-8">

                <section className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 bg-primary h-full"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-on-surface mb-2 font-headline uppercase">Manual SOS Trigger</h1>
                            <p className="text-on-surface-variant max-w-md">
                                Logs an emergency event to the cloud with current location and IMU snapshot. Use only for real emergencies.
                            </p>
                        </div>
                        <div className="text-right tabular-nums">
                            <span className={`text-xs font-bold tracking-widest uppercase block mb-1 ${online ? 'text-tertiary' : 'text-outline'}`}>
                                {online ? 'Status: Online' : 'Status: Offline'}
                            </span>
                            <span className="text-sm font-medium text-on-surface-variant">
                                {snapshot?.timestamp ? formatRel(snapshot.timestamp) : '—'}
                            </span>
                        </div>
                    </div>

                    <div className="mt-12 flex justify-center">
                        <button
                            onClick={handleSOS}
                            disabled={sosBusy}
                            className="group relative w-64 h-64 rounded-full bg-gradient-to-br from-[#FFB3AC] to-[#670008] emergency-glow flex items-center justify-center active:scale-95 duration-100 transition-transform disabled:opacity-60"
                        >
                            <div className="absolute inset-4 rounded-full border-2 border-on-primary/20 animate-ping opacity-20"></div>
                            <div className="flex flex-col items-center text-on-primary">
                                <span className="material-symbols-outlined text-6xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
                                <span className="font-black text-2xl tracking-tighter uppercase">{sosBusy ? 'SENDING…' : 'ACTIVATE'}</span>
                            </div>
                        </button>
                    </div>

                    {sosMsg && (
                        <p className="mt-6 text-center text-sm font-bold text-tertiary">{sosMsg}</p>
                    )}
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-surface-container-high p-6 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface">
                                <span className="material-symbols-outlined">volume_up</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-on-surface">External Buzzer</h3>
                                <p className="text-xs text-on-surface-variant">Currently disabled in firmware</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleBuzzer}
                            className={`w-14 h-8 rounded-full relative flex items-center px-1 transition-colors ${buzzerOn ? 'bg-primary-container' : 'bg-surface-container-highest'}`}
                        >
                            <div className={`w-6 h-6 rounded-full transition-transform ${buzzerOn ? 'bg-primary translate-x-6' : 'bg-on-surface-variant'}`}></div>
                        </button>
                    </div>

                    <div className="bg-surface-container-high p-6 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface">
                                <span className="material-symbols-outlined">lightbulb</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-on-surface">LED Beacon</h3>
                                <p className="text-xs text-on-surface-variant">Active during local alerts</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleLED}
                            className={`w-14 h-8 rounded-full relative flex items-center px-1 transition-colors ${ledOn ? 'bg-primary-container' : 'bg-surface-container-highest'}`}
                        >
                            <div className={`w-6 h-6 rounded-full transition-transform ${ledOn ? 'bg-primary translate-x-6' : 'bg-on-surface-variant'}`}></div>
                        </button>
                    </div>
                </div>

                <div className="bg-secondary-container/20 p-8 rounded-xl backdrop-blur-sm relative">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
                            <h2 className="text-xl font-bold text-on-secondary-container">Cloud Connection</h2>
                        </div>
                        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full uppercase tracking-widest">
                            Firebase RTDB
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-surface-container-low rounded-lg text-center">
                            <span className="block text-2xl font-bold text-on-surface tabular-nums">{eventCount}</span>
                            <span className="text-[10px] uppercase text-on-surface-variant font-bold">Events Logged</span>
                        </div>
                        <div className="p-4 bg-surface-container-low rounded-lg text-center">
                            <span className="block text-2xl font-bold text-on-surface tabular-nums">
                                {snapshot?.timestamp ? formatRel(snapshot.timestamp) : '—'}
                            </span>
                            <span className="text-[10px] uppercase text-on-surface-variant font-bold">Last Heartbeat</span>
                        </div>
                        <div className={`p-4 bg-surface-container-low rounded-lg text-center border-l-2 ${online ? 'border-green-500/50' : 'border-outline/50'}`}>
                            <span className="block text-2xl font-bold text-on-surface tabular-nums">
                                {online ? 'OK' : 'OFF'}
                            </span>
                            <span className="text-[10px] uppercase text-on-surface-variant font-bold">Device Link</span>
                        </div>
                        <div className="p-4 bg-surface-container-low rounded-lg text-center">
                            <span className="block text-2xl font-bold text-on-surface tabular-nums">
                                {snapshot?.gpsReal ? 'REAL' : 'MOCK'}
                            </span>
                            <span className="text-[10px] uppercase text-on-surface-variant font-bold">GPS Source</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-8">

                <section className="bg-surface-container-low rounded-xl flex flex-col h-full overflow-hidden">
                    <div className="p-6">
                        <h2 className="text-lg font-bold text-on-surface uppercase tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Alert History
                        </h2>
                    </div>

                    <div className="flex-grow space-y-px">
                        {events.length === 0 && (
                            <p className="p-6 text-sm text-on-surface-variant">No alerts recorded yet.</p>
                        )}
                        {events.slice(0, 6).map((e, i) => (
                            <div
                                key={e.id}
                                className={`p-6 ${i === 0 ? 'bg-surface-container-high/50' : ''} flex items-start gap-4`}
                                style={{ opacity: 1 - i * 0.13 }}
                            >
                                <div className={`w-1 self-stretch rounded-full ${e.severity === 'severe' ? 'bg-primary' : e.severity === 'moderate' ? 'bg-tertiary' : 'bg-secondary'}`}></div>
                                <div className="flex-grow">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-bold text-on-surface capitalize">
                                            {e.eventType?.replace('_', ' ')}
                                        </span>
                                        <span className="text-[10px] font-bold text-on-surface-variant tabular-nums">
                                            {formatTime(e.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-on-surface-variant">
                                        {e.severity?.toUpperCase()}
                                        {e.netAccel !== undefined && ` · Net ${e.netAccel?.toFixed(1)} m/s²`}
                                        {e.tiltDeg !== undefined && ` · Tilt ${e.tiltDeg?.toFixed(0)}°`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => window.location.assign('/logs')}
                        className="m-6 py-3 px-4 bg-surface-container-highest text-on-surface text-xs font-bold rounded uppercase tracking-widest hover:bg-[#282A2C] transition-colors"
                    >
                        View Full Logs â†’
                    </button>
                </section>

                <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Sensor Diagnostics</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-xs text-on-surface">Net Acceleration</span>
                            <span className="text-xs font-bold text-on-surface tabular-nums">
                                {snapshot?.netAccel?.toFixed(2) ?? '—'} m/s²
                            </span>
                        </div>
                        <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                            <div className="bg-secondary h-full" style={{ width: `${Math.min((snapshot?.netAccel || 0) / 25 * 100, 100)}%` }}></div>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs text-on-surface">Tilt Angle</span>
                            <span className="text-xs font-bold text-on-surface tabular-nums">
                                {snapshot?.tiltDeg?.toFixed(1) ?? '—'}°
                            </span>
                        </div>
                        <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full" style={{ width: `${Math.min((snapshot?.tiltDeg || 0) / 180 * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
