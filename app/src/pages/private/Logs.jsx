import { useMemo, useState } from 'react';
import { useEvents, useTelemetry } from '../../firebase';

function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString();
}
function formatDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
}

const SEVERITY_STYLES = {
    severe:   { dot: 'text-error',    bg: 'bg-error-container/10',    border: 'border-error',    label: 'text-error',    pill: 'bg-error-container text-on-error-container' },
    moderate: { dot: 'text-tertiary', bg: 'bg-tertiary/10',           border: 'border-tertiary', label: 'text-tertiary', pill: 'bg-tertiary-container text-on-tertiary-container' },
    minor:    { dot: 'text-secondary',bg: 'bg-secondary/10',          border: 'border-secondary',label: 'text-secondary',pill: 'bg-secondary-container text-on-secondary-container' },
};

function styleFor(severity) {
    return SEVERITY_STYLES[severity] || SEVERITY_STYLES.minor;
}

function eventToCsvRow(e) {
    return [
        new Date(e.timestamp || 0).toISOString(),
        e.eventType,
        e.severity,
        e.latitude,
        e.longitude,
        e.tiltDeg,
        e.netAccel,
        e.vibrationState,
        e.ax, e.ay, e.az,
        e.gx, e.gy, e.gz,
    ].map(v => v === undefined ? '' : String(v).replace(/,/g, ' ')).join(',');
}

function downloadCSV(events) {
    const header = 'timestamp_iso,eventType,severity,latitude,longitude,tiltDeg,netAccel,vibrationState,ax,ay,az,gx,gy,gz';
    const csv = [header, ...events.map(eventToCsvRow)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function Logs() {
    const { events }      = useEvents(200);
    const { points }      = useTelemetry(40);

    const [search, setSearch]     = useState('');
    const [filter, setFilter]     = useState('all');
    const [sevFilter, setSevFilter] = useState({ severe: true, moderate: true, minor: true });
    const [selectedId, setSelectedId] = useState(null);

    const filtered = useMemo(() => {
        return events.filter(e => {
            if (filter === 'rollover' && e.eventType !== 'rollover') return false;
            if (filter === 'accident' && e.eventType !== 'accident') return false;
            if (e.severity && !sevFilter[e.severity]) return false;
            if (search) {
                const hay = `${e.eventType} ${e.severity} ${formatDateTime(e.timestamp)}`.toLowerCase();
                if (!hay.includes(search.toLowerCase())) return false;
            }
            return true;
        });
    }, [events, filter, sevFilter, search]);

    const selected = useMemo(
        () => filtered.find(e => e.id === selectedId) || filtered[0] || null,
        [filtered, selectedId]
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-8rem)] text-on-surface">
            <aside className="lg:col-span-3 flex flex-col gap-6">

                <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Search Logs</label>
                        <div className="relative">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-surface-container-highest border-none rounded-lg py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/40 placeholder:text-outline text-on-surface"
                                placeholder="Query events..."
                                type="text"
                            />
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <label className="text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Quick Filters</label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'all',      label: 'All' },
                                { id: 'accident', label: 'Impact' },
                                { id: 'rollover', label: 'Rollover' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={`${filter === f.id ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest hover:bg-surface-bright text-on-surface'} flex-1 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-colors`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <label className="text-[0.6875rem] uppercase tracking-widest text-on-surface-variant font-bold">Severity</label>
                        <div className="space-y-3">
                            {[
                                { key: 'severe',   label: 'Severe',   color: 'error' },
                                { key: 'moderate', label: 'Moderate', color: 'tertiary' },
                                { key: 'minor',    label: 'Minor',    color: 'secondary' },
                            ].map(s => (
                                <label key={s.key} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={sevFilter[s.key]}
                                        onChange={() => setSevFilter(p => ({ ...p, [s.key]: !p[s.key] }))}
                                        className="hidden"
                                    />
                                    <div className={`w-4 h-4 rounded bg-${s.color}/20 border ${sevFilter[s.key] ? `border-${s.color}` : `border-${s.color}/40`} group-hover:bg-${s.color}/30 transition-colors`}></div>
                                    <span className="text-sm text-on-surface">{s.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => downloadCSV(filtered)}
                        disabled={filtered.length === 0}
                        className="mt-4 w-full bg-secondary-container text-on-secondary-container py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-lg">file_download</span>
                        Export ({filtered.length}) CSV
                    </button>
                </div>

                {events[0] && (
                    <div className="bg-surface-container-highest p-6 rounded-xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                        <div className="flex justify-between items-start mb-4">
                            <span className="bg-error-container text-on-error-container text-[10px] font-bold px-2 py-0.5 rounded">LAST INCIDENT</span>
                            <span className="text-[10px] tabular-nums text-outline">{formatTime(events[0].timestamp)}</span>
                        </div>
                        <h3 className="text-lg font-bold leading-tight mb-2 text-on-surface capitalize">
                            {events[0].eventType} &bull; {events[0].severity}
                        </h3>
                        <p className="text-xs text-on-surface-variant mb-4">
                            {events[0].eventType === 'rollover'
                                ? `Tilt reached ${events[0].tiltDeg?.toFixed(0)}°. Gyro spike confirmed.`
                                : `Net acceleration peaked at ${events[0].netAccel?.toFixed(1)} m/s².`}
                        </p>
                        <button
                            onClick={() => setSelectedId(events[0].id)}
                            className="text-primary text-xs font-bold hover:underline"
                        >
                            VIEW FULL REPORT
                        </button>
                    </div>
                )}
            </aside>

            <section className="lg:col-span-6 flex flex-col bg-surface-container-low rounded-xl overflow-hidden h-[600px] lg:h-full">
                <div className="p-6 bg-surface-container-high flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold tracking-tight text-on-surface">Event Feed</h2>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div>
                        <span className="text-[10px] uppercase font-black tracking-widest text-tertiary">Live Monitoring</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-1">
                    {filtered.length === 0 && (
                        <div className="p-8 text-center text-on-surface-variant text-sm">
                            No events match the current filters.
                        </div>
                    )}

                    {filtered.map((e) => {
                        const s = styleFor(e.severity);
                        const isSelected = selected?.id === e.id;
                        return (
                            <button
                                key={e.id}
                                onClick={() => setSelectedId(e.id)}
                                className={`w-full text-left flex gap-4 p-4 rounded-lg ${s.bg} border-l-4 ${s.border} group cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary/40' : 'hover:opacity-90'}`}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <span className={`material-symbols-outlined ${s.dot}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {e.eventType === 'rollover' ? 'sync_problem' : 'crisis_alert'}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className={`text-[10px] font-bold ${s.label} uppercase`}>
                                            {e.eventType} &bull; {e.severity}
                                        </span>
                                        <span className="text-[10px] tabular-nums text-outline">{formatTime(e.timestamp)}</span>
                                    </div>
                                    <p className="text-xs text-on-surface-variant block">
                                        {e.eventType === 'rollover'
                                            ? `Tilt ${e.tiltDeg?.toFixed(1)}°, gyro confirmed for 3 cycles.`
                                            : `Net accel ${e.netAccel?.toFixed(2)} m/s², vibration ${e.vibrationState ? 'YES' : 'NO'}.`}
                                        {' '}Lat {e.latitude?.toFixed(4)}, Lon {e.longitude?.toFixed(4)}.
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="lg:col-span-3 flex flex-col gap-6">
                <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-tertiary">
                    <h3 className="text-sm font-black tracking-widest text-on-surface mb-6 uppercase">Incident Detail</h3>

                    {selected ? (
                        <div className="space-y-6">
                            <div>
                                <label className="text-[0.6875rem] text-on-surface-variant font-bold uppercase block mb-1">Timestamp</label>
                                <span className="text-base tabular-nums font-bold text-tertiary">{formatDateTime(selected.timestamp)}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[0.6875rem] text-on-surface-variant font-bold uppercase block mb-1">Severity</label>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${styleFor(selected.severity).pill} capitalize`}>{selected.severity}</span>
                                </div>
                                <div>
                                    <label className="text-[0.6875rem] text-on-surface-variant font-bold uppercase block mb-1">Type</label>
                                    <span className="text-xs font-bold text-on-surface capitalize">{selected.eventType}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[0.6875rem] text-on-surface-variant font-bold uppercase block mb-2">Sensor Snapshot</label>
                                <div className="bg-surface-container-highest p-4 rounded-lg space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-outline">Net Accel</span>
                                        <span className="text-sm tabular-nums font-bold text-on-surface">{selected.netAccel?.toFixed(2)} m/s²</span>
                                    </div>
                                    <div className="w-full bg-surface-container-low h-1 rounded-full overflow-hidden">
                                        <div className="bg-error h-full" style={{ width: `${Math.min((selected.netAccel || 0) / 25 * 100, 100)}%` }}></div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-outline">Tilt</span>
                                        <span className="text-sm tabular-nums font-bold text-on-surface">{selected.tiltDeg?.toFixed(1)}°</span>
                                    </div>
                                    <div className="w-full bg-surface-container-low h-1 rounded-full overflow-hidden">
                                        <div className="bg-primary h-full" style={{ width: `${Math.min((selected.tiltDeg || 0) / 180 * 100, 100)}%` }}></div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-outline">Vibration</span>
                                        <span className="text-sm tabular-nums font-bold text-on-surface">{selected.vibrationState ? 'YES' : 'NO'}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[0.6875rem] text-on-surface-variant font-bold uppercase block mb-2">Location</label>
                                <a
                                    className="block text-xs font-mono text-primary hover:underline"
                                    href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}&zoom=16`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {selected.latitude?.toFixed(6)}, {selected.longitude?.toFixed(6)} â†—
                                </a>
                                <p className="text-[10px] text-on-surface-variant mt-1">
                                    {selected.gpsReal ? 'Real GPS fix' : 'Mock coordinates'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-on-surface-variant">Select an event from the feed.</p>
                    )}
                </div>

                <div className="bg-[#1A1C1E] p-6 rounded-xl flex-1 flex flex-col justify-center items-center text-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-outline-variant">analytics</span>
                    <p className="text-xs text-outline font-medium max-w-[180px]">
                        {points.length} telemetry samples retained · {events.length} total events.
                    </p>
                </div>
            </section>

        </div>
    );
}
