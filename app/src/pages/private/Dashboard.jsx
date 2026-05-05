import { useLiveSnapshot, useEvents, isDeviceOnline } from '../../firebase';

function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString();
}

function severityIndex(snapshot, lastEvent) {
    if (!snapshot) return 0;
    const net  = Math.min(snapshot.netAccel || 0, 25);
    const tilt = (snapshot.tiltDeg || 0) > 75 ? 5 : 0;
    let base   = (net / 25) * 5 + tilt;
    if (lastEvent && Date.now() - (lastEvent.timestamp || 0) < 60_000) base = 10;
    return Math.round(Math.min(base, 10));
}

function statusLabel(snapshot, online, lastEvent) {
    if (!online) return 'Offline';
    if (lastEvent && Date.now() - (lastEvent.timestamp || 0) < 60_000) return 'Alert';
    if ((snapshot?.netAccel || 0) > 5) return 'Active';
    return 'Normal';
}

export default function Dashboard() {
    const { snapshot } = useLiveSnapshot();
    const { events }   = useEvents(5);

    const online    = isDeviceOnline(snapshot);
    const lastEvent = events[0];
    const status    = statusLabel(snapshot, online, lastEvent);
    const sevIdx    = severityIndex(snapshot, lastEvent);

    const ax = snapshot?.ax ?? 0;
    const ay = snapshot?.ay ?? 0;
    const az = snapshot?.az ?? 0;
    const gx = snapshot?.gx ?? 0;
    const gy = snapshot?.gy ?? 0;
    const gz = snapshot?.gz ?? 0;

    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <section className="md:col-span-8 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between min-h-[320px] relative overflow-hidden group">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${status === 'Alert' ? 'bg-error' : status === 'Offline' ? 'bg-outline' : 'bg-tertiary'}`}></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-tertiary">shield_with_heart</span>
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                                {online ? 'Active Monitoring' : 'Device Offline'}
                            </span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-on-surface tabular-nums">{status}</h1>
                        <p className="mt-4 text-on-surface-variant max-w-md leading-relaxed">
                            {online
                                ? `Live telemetry from ${snapshot?.deviceId || 'device'}. Last update ${formatTime(snapshot?.timestamp)}.`
                                : 'No recent telemetry received. Check device power and Wi-Fi connection.'}
                        </p>
                    </div>

                    <div className="mt-8 flex gap-8 items-end relative z-10">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1">Severity Index</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black tabular-nums text-on-surface">{String(sevIdx).padStart(2, '0')}</span>
                                <span className="text-on-surface-variant font-medium">/10</span>
                            </div>
                        </div>
                        <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden mb-2">
                            <div
                                className={`h-full ${sevIdx >= 8 ? 'bg-error' : sevIdx >= 4 ? 'bg-tertiary' : 'bg-tertiary'} shadow-[0_0_12px_rgba(255,183,134,0.4)]`}
                                style={{ width: `${(sevIdx / 10) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="absolute -right-20 -top-20 w-80 h-80 bg-tertiary/5 rounded-full blur-[100px] group-hover:bg-tertiary/10 transition-colors duration-700"></div>
                </section>

                <aside className="md:col-span-4 bg-surface-container-high rounded-xl p-6 flex flex-col border-l-4 border-primary-container">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-6">Last Incident Summary</h3>
                    {lastEvent ? (
                        <div className="space-y-6">
                            <div>
                                <span className="block text-[10px] text-on-surface-variant uppercase mb-1">Timestamp</span>
                                <span className="text-sm font-semibold tabular-nums">{formatTime(lastEvent.timestamp)}</span>
                            </div>
                            <div className="p-4 bg-surface-container-highest rounded-lg">
                                <span className="block text-[10px] text-on-surface-variant uppercase mb-2">{lastEvent.eventType?.toUpperCase() || 'EVENT'} &bull; {lastEvent.severity?.toUpperCase() || ''}</span>
                                <p className="text-sm leading-snug">
                                    {lastEvent.eventType === 'rollover'
                                        ? `Rollover detected. Tilt ${lastEvent.tiltDeg?.toFixed(0)}°.`
                                        : `Impact detected. Net accel ${lastEvent.netAccel?.toFixed(1)} m/s².`}
                                    {' '}Vibration: {lastEvent.vibrationState ? 'YES' : 'NO'}.
                                </p>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase">Logged to Cloud</span>
                                <span className="material-symbols-outlined text-tertiary text-sm">check_circle</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-on-surface-variant">No incidents recorded yet.</p>
                    )}
                </aside>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div className="bg-surface-container-low rounded-xl p-6 relative">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h4 className="text-lg font-bold tracking-tight">Accelerometer</h4>
                            <p className="text-[10px] text-on-surface-variant uppercase font-medium">Linear (m/s²)</p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant/40">dynamic_feed</span>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary tracking-widest">AXIS X</span>
                            <span className="text-2xl font-black tabular-nums text-on-surface">{ax.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-tertiary tracking-widest">AXIS Y</span>
                            <span className="text-2xl font-black tabular-nums text-on-surface">{ay.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-secondary tracking-widest">AXIS Z</span>
                            <span className="text-2xl font-black tabular-nums text-on-surface">{az.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="mt-8 h-16 w-full flex items-end gap-1 overflow-hidden opacity-30">
                        {[Math.abs(ax), Math.abs(ay), Math.abs(az), Math.abs(ax), Math.abs(ay), Math.abs(az), Math.abs(ax), Math.abs(ay), Math.abs(az)].map((v, i) => (
                            <div key={i} className="bg-primary w-full" style={{ height: `${Math.min(v / 15 * 100, 100)}%` }}></div>
                        ))}
                    </div>
                </div>

                <div className="bg-surface-container-low rounded-xl p-6">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h4 className="text-lg font-bold tracking-tight">Gyroscope</h4>
                            <p className="text-[10px] text-on-surface-variant uppercase font-medium">Angular (deg/s)</p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant/40">explore</span>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        {[
                            { label: 'GX (Pitch)', val: gx },
                            { label: 'GY (Roll)',  val: gy },
                            { label: 'GZ (Yaw)',   val: gz },
                        ].map(({ label, val }) => (
                            <div key={label} className="flex flex-col gap-2">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-on-surface-variant">
                                    <span>{label}</span>
                                    <span className="tabular-nums">{val.toFixed(2)}</span>
                                </div>
                                <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-secondary"
                                        style={{ width: `${Math.min(Math.abs(val) / 250 * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-surface-container-lowest rounded-xl p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <span className={`w-2 h-2 rounded-full ${online ? 'bg-tertiary animate-pulse' : 'bg-outline'}`}></span>
                        <h4 className="text-sm font-bold tracking-wider uppercase">Live Feed</h4>
                    </div>

                    <div className="flex-1 space-y-4 overflow-hidden">
                        {events.length === 0 && (
                            <div className="text-[11px] font-medium leading-relaxed text-on-surface-variant">
                                {online
                                    ? 'No events yet. Device is broadcasting normally.'
                                    : 'Waiting for device telemetry…'}
                            </div>
                        )}
                        {events.slice(0, 5).map((e, i) => (
                            <div key={e.id} className="text-[11px] font-medium leading-relaxed" style={{ opacity: 1 - i * 0.18 }}>
                                <span className="text-on-surface-variant/60 tabular-nums">
                                    {new Date(e.timestamp || 0).toLocaleTimeString()}
                                </span>
                                <span className="ml-2 text-on-surface">
                                    {(e.eventType || 'event').toUpperCase()}: {e.severity || 'unknown'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            <button className="fixed right-6 bottom-24 z-50 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-[0_0_32px_rgba(255,179,172,0.25)] hover:scale-105 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
            </button>

        </div>
    );
}
