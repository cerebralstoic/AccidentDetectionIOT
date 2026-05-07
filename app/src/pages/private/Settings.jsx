import { useEffect, useState } from 'react';
import { ref, set, onValue, serverTimestamp } from 'firebase/database';
import { getDatabase } from 'firebase/database';
import { useLiveSnapshot, isDeviceOnline, DEVICE_ID } from '../../firebase';

const db = getDatabase();

const DEFAULT_THRESHOLDS = {
    accelMinor:    7,    // netAccel m/s² for MINOR
    accelModerate: 12,
    accelSevere:   20,
    rolloverTilt:  75,   // deg
    rolloverGyro:  200,  // deg/s
    vibWindowMs:   500,
};

function formatRel(ts) {
    if (!ts) return 'Never';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
}

export default function Settings() {
    const { snapshot } = useLiveSnapshot();
    const online       = isDeviceOnline(snapshot);

    const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
    const [hotline,    setHotline]    = useState(() => localStorage.getItem('emergencyHotline') || '');
    const [autoSos,    setAutoSos]    = useState(() => localStorage.getItem('autoSos') !== 'false');
    const [channels,   setChannels]   = useState(() => {
        try { return JSON.parse(localStorage.getItem('alertChannels') || '{"push":true,"sms":true,"email":false}'); }
        catch { return { push: true, sms: true, email: false }; }
    });
    const [savedMsg,   setSavedMsg]   = useState('');

    // Subscribe to existing config in Firebase so dashboard reflects current values.
    useEffect(() => {
        const r = ref(db, `devices/${DEVICE_ID}/config/thresholds`);
        const unsub = onValue(r, (snap) => {
            const v = snap.val();
            if (v) setThresholds(prev => ({ ...prev, ...v }));
        });
        return unsub;
    }, []);

    const updateThresh = (key, val) => {
        setThresholds(prev => ({ ...prev, [key]: Number(val) }));
    };

    const saveThresholds = async () => {
        try {
            await set(ref(db, `devices/${DEVICE_ID}/config/thresholds`), {
                ...thresholds,
                updatedAt: serverTimestamp(),
            });
            setSavedMsg('Thresholds saved to cloud.');
        } catch (e) {
            setSavedMsg(`Save failed: ${e.message}`);
        }
        setTimeout(() => setSavedMsg(''), 4000);
    };

    const saveHotline = (v) => {
        setHotline(v);
        localStorage.setItem('emergencyHotline', v);
    };
    const toggleAutoSos = () => {
        const next = !autoSos;
        setAutoSos(next);
        localStorage.setItem('autoSos', String(next));
    };
    const toggleChannel = (key) => {
        const next = { ...channels, [key]: !channels[key] };
        setChannels(next);
        localStorage.setItem('alertChannels', JSON.stringify(next));
    };

    return (
        <div className="space-y-10 text-on-surface">
            <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8 bg-surface-container-low p-8 rounded-xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${online ? 'bg-tertiary' : 'bg-outline'}`}></div>
                    <div className="w-24 h-24 bg-surface-container-high rounded-xl flex items-center justify-center border border-outline-variant/15 flex-shrink-0">
                        <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>router</span>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                            <h1 className="text-2xl font-bold tracking-tight">{DEVICE_ID}</h1>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-widest ${online ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                                {online ? 'Active' : 'Offline'}
                            </span>
                        </div>
                        <p className="text-on-surface-variant text-sm font-medium">
                            ESP32 + MPU6050 + SW-420 · Firmware v0.2 (cloud-enabled)
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-6">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                                <span className="text-xs font-bold font-mono">
                                    {snapshot?.gpsReal ? 'Real GPS' : 'Mock GPS'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">sensors</span>
                                <span className="text-xs font-bold font-mono">
                                    Vib: {snapshot?.vibrationState ? 'ACTIVE' : 'idle'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-sm">update</span>
                                <span className="text-xs font-bold font-mono">{formatRel(snapshot?.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-4 bg-surface-container-high p-8 rounded-xl flex flex-col justify-between border border-primary/10">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Auto-SOS</span>
                            <button
                                onClick={toggleAutoSos}
                                className={`w-10 h-5 rounded-full relative transition-colors ${autoSos ? 'bg-primary' : 'bg-surface-container-highest'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${autoSos ? 'right-0.5 bg-on-primary' : 'left-0.5 bg-on-surface-variant'}`}></div>
                            </button>
                        </div>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed">
                            When on, confirmed accidents/rollovers automatically log to cloud and notify contacts.
                        </p>
                    </div>
                    <a
                        href="https://console.firebase.google.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 w-full py-3 bg-secondary-container text-on-secondary-container font-bold text-xs rounded uppercase tracking-widest hover:opacity-90 transition-opacity text-center block"
                    >
                        Open Firebase Console
                    </a>
                </div>
            </section>

            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#D32F2F]">Sensor Thresholds</h2>
                    <button
                        onClick={saveThresholds}
                        className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                        Save to Cloud
                    </button>
                </div>
                {savedMsg && <p className="text-xs text-tertiary font-bold">{savedMsg}</p>}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-surface-container-low p-6 rounded-xl space-y-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Severe Impact</span>
                                <h3 className="text-xl font-bold">Net Accel</h3>
                            </div>
                            <span className="material-symbols-outlined text-on-tertiary-container">speed</span>
                        </div>
                        <div className="space-y-4">
                            <input
                                value={thresholds.accelSevere}
                                onChange={(e) => updateThresh('accelSevere', e.target.value)}
                                className="w-full accent-primary"
                                max="40" min="10" step="0.5"
                                type="range"
                            />
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-on-surface-variant">
                                <span>10 m/s²</span>
                                <span className="text-primary text-sm">{Number(thresholds.accelSevere).toFixed(1)} m/s²</span>
                                <span>40 m/s²</span>
                            </div>
                        </div>
                        <p className="text-xs text-on-surface-variant opacity-70">
                            Above-gravity acceleration spike that flags a SEVERE impact.
                        </p>
                    </div>

                    <div className="bg-surface-container-low p-6 rounded-xl space-y-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Rollover Tilt</span>
                                <h3 className="text-xl font-bold">Tilt Angle</h3>
                            </div>
                            <span className="material-symbols-outlined text-on-tertiary-container">screen_rotation</span>
                        </div>
                        <div className="space-y-4">
                            <input
                                value={thresholds.rolloverTilt}
                                onChange={(e) => updateThresh('rolloverTilt', e.target.value)}
                                className="w-full accent-primary"
                                max="120" min="30" step="1"
                                type="range"
                            />
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-on-surface-variant">
                                <span>30°</span>
                                <span className="text-primary text-sm">{Number(thresholds.rolloverTilt).toFixed(0)}°</span>
                                <span>120°</span>
                            </div>
                        </div>
                        <p className="text-xs text-on-surface-variant opacity-70">
                            Sustained tilt past this angle (with gyro motion) signals a rollover.
                        </p>
                    </div>

                    <div className="bg-surface-container-low p-6 rounded-xl space-y-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Rotation Speed</span>
                                <h3 className="text-xl font-bold">Gyro Rate</h3>
                            </div>
                            <span className="material-symbols-outlined text-on-tertiary-container">explore</span>
                        </div>
                        <div className="space-y-4">
                            <input
                                value={thresholds.rolloverGyro}
                                onChange={(e) => updateThresh('rolloverGyro', e.target.value)}
                                className="w-full accent-primary"
                                max="500" min="50" step="10"
                                type="range"
                            />
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-on-surface-variant">
                                <span>50°/s</span>
                                <span className="text-primary text-sm">{Number(thresholds.rolloverGyro).toFixed(0)}°/s</span>
                                <span>500°/s</span>
                            </div>
                        </div>
                        <p className="text-xs text-on-surface-variant opacity-70">
                            Angular velocity above this confirms rollover candidate cycles.
                        </p>
                    </div>
                </div>

                <p className="text-[11px] text-on-surface-variant italic">
                    Saved to <code>/devices/{DEVICE_ID}/config/thresholds</code>. The ESP32 subscribes to this node and applies new values within ~1 second of clicking save — no reflash needed.
                </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">

                <div className="space-y-6">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#D32F2F]">Alert Channels</h2>
                    <div className="bg-surface-container-low rounded-xl overflow-hidden">
                        {[
                            { key: 'push',  icon: 'notifications_active', label: 'Push Notifications', desc: 'Real-time browser notifications' },
                            { key: 'sms',   icon: 'sms',                  label: 'SMS Emergency Alerts', desc: 'Direct text to emergency contacts' },
                            { key: 'email', icon: 'mail',                 label: 'Email Logs',           desc: 'Weekly summaries and incident reports' },
                        ].map(({ key, icon, label, desc }) => (
                            <div
                                key={key}
                                onClick={() => toggleChannel(key)}
                                className="p-5 flex items-center justify-between hover:bg-surface-container-high transition-colors group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">{icon}</span>
                                    <div>
                                        <div className="font-bold text-sm">{label}</div>
                                        <div className="text-[10px] text-on-surface-variant">{desc}</div>
                                    </div>
                                </div>
                                <div className={`w-10 h-5 rounded-full relative transition-colors ${channels[key] ? 'bg-primary' : 'bg-primary/20'}`}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${channels[key] ? 'right-0.5 bg-on-primary' : 'left-0.5 bg-primary'}`}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[11px] text-on-surface-variant italic">
                        Channel preferences are stored locally in your browser. Real notification delivery requires a backend integration (e.g. Firebase Cloud Messaging) — not yet wired.
                    </p>
                </div>

                <div className="space-y-6">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#D32F2F]">Emergency Contact</h2>
                    <div className="bg-surface-container-low p-6 rounded-xl">
                        <div className="space-y-4">
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Hotline Number</span>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-primary">call</span>
                                    <input
                                        value={hotline}
                                        onChange={(e) => saveHotline(e.target.value)}
                                        placeholder="+91 XXXXX XXXXX"
                                        className="w-full bg-surface-container-high border-none rounded-lg pl-10 pr-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary/40 text-on-surface"
                                        type="tel"
                                    />
                                </div>
                            </label>

                            {hotline && (
                                <a
                                    href={`tel:${hotline.replace(/\s/g, '')}`}
                                    className="w-full py-4 bg-primary text-on-primary font-black text-xs rounded uppercase tracking-[0.2em] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">call</span>
                                    Call {hotline}
                                </a>
                            )}

                            <p className="text-[11px] text-on-surface-variant italic">
                                Number is stored in your browser only. Tap to dial via your phone's dialer.
                            </p>
                        </div>
                    </div>
                </div>

            </section>
        </div>
    );
}
