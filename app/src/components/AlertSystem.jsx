import { useEffect, useRef, useState } from 'react';
import { distanceKm } from '../firebase';

const SEVERITY_FREQ = {
    severe:   880,
    moderate: 660,
    minor:    440,
};

function playBeep(audioCtx, freq = 660) {
    const now = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.25, now + offset + 0.02);
        gain.gain.linearRampToValueAtTime(0,    now + offset + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + offset);
        osc.stop (now + offset + 0.2);
    });
}

function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString();
}

function formatDistance(km) {
    if (!Number.isFinite(km)) return null;
    if (km < 1)  return `${Math.round(km * 1000)} m ahead`;
    if (km < 10) return `${km.toFixed(1)} km ahead`;
    return `${Math.round(km)} km away`;
}

export default function AlertSystem({ incidents, viewerCoords, radiusKm = 5 }) {
    const [audioReady,  setAudioReady] = useState(false);
    const [toasts,      setToasts]     = useState([]);
    const audioCtxRef   = useRef(null);
    const lastSeenTsRef = useRef(null);

    useEffect(() => {
        if (lastSeenTsRef.current !== null) return;
        lastSeenTsRef.current = incidents.length > 0
            ? (incidents[0].timestamp || 0)
            : 0;
        console.log('[AlertSystem] baseline ts set to', lastSeenTsRef.current,
                    `(${incidents.length} existing incidents)`);
    }, [incidents]);

    useEffect(() => {
        if (lastSeenTsRef.current === null) return;
        const fresh = incidents.filter(i => (i.timestamp || 0) > lastSeenTsRef.current);
        console.log('[AlertSystem] check', {
            total: incidents.length,
            fresh: fresh.length,
            lastSeen: lastSeenTsRef.current,
            audioReady,
            radiusKm,
            viewerCoords,
        });
        if (fresh.length === 0) return;

        lastSeenTsRef.current = fresh[0].timestamp || lastSeenTsRef.current;

        fresh.forEach((inc) => {
            const dist = viewerCoords && inc.latitude !== undefined && inc.longitude !== undefined
                ? distanceKm(viewerCoords, { lat: inc.latitude, lon: inc.longitude })
                : Infinity;
            const inRadius = dist <= radiusKm;

            console.log('[AlertSystem] new incident', {
                id: inc.id,
                eventType: inc.eventType,
                severity: inc.severity,
                lat: inc.latitude, lon: inc.longitude,
                ts: inc.timestamp,
                distKm: dist,
                inRadius,
                willBeep: inRadius && audioReady,
            });

            setToasts((prev) => [
                {
                    id: inc.id,
                    inc,
                    distKm: dist,
                    inRadius,
                    expiresAt: Date.now() + 8000,
                },
                ...prev.slice(0, 4),
            ]);

            if (inRadius && audioReady && audioCtxRef.current) {
                const freq = SEVERITY_FREQ[inc.severity] || SEVERITY_FREQ.moderate;
                try { playBeep(audioCtxRef.current, freq); } catch (e) { console.error('beep failed', e); }
            }
        });
    }, [incidents, viewerCoords, radiusKm, audioReady]);

    useEffect(() => {
        const t = setInterval(() => {
            const now = Date.now();
            setToasts((prev) => prev.filter(x => x.expiresAt > now));
        }, 1000);
        return () => clearInterval(t);
    }, []);

    const enableAudio = () => {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001;
            osc.connect(gain).connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.01);
            audioCtxRef.current = ctx;
            setAudioReady(true);
        } catch (e) {
            console.error('Audio unlock failed', e);
        }
    };

    const testBeep = () => {
        if (!audioCtxRef.current) return;
        try { playBeep(audioCtxRef.current, SEVERITY_FREQ.moderate); } catch { /* ignore */ }
    };

    const dismissToast = (id) => setToasts((prev) => prev.filter(t => t.id !== id));

    return (
        <>
            {!audioReady ? (
                <button
                    onClick={enableAudio}
                    className="fixed top-20 right-4 z-[1000] px-3 py-2 bg-tertiary text-on-tertiary text-xs font-bold rounded-full shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
                >
                    <span className="material-symbols-outlined text-base">volume_up</span>
                    Enable sound
                </button>
            ) : (
                <button
                    onClick={testBeep}
                    title="Test buzzer"
                    className="fixed top-20 right-4 z-[1000] w-10 h-10 bg-surface-container-high text-on-surface rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                >
                    <span className="material-symbols-outlined text-base">volume_up</span>
                </button>
            )}

            <div className="fixed bottom-24 right-6 z-[1000] flex flex-col gap-3 max-w-sm pointer-events-none">
                {toasts.map((t) => {
                    const sev = t.inc.severity || 'minor';
                    const ringColor = sev === 'severe' ? 'border-error' : sev === 'moderate' ? 'border-tertiary' : 'border-secondary';
                    return (
                        <div
                            key={t.id}
                            className={`pointer-events-auto bg-surface-container-high rounded-xl p-4 border-l-4 ${ringColor} shadow-2xl backdrop-blur-md`}
                            style={{ animation: 'slideIn 0.3s ease-out' }}
                        >
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-error mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {t.inc.eventType === 'rollover' ? 'sync_problem' : 'crisis_alert'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline gap-2">
                                        <span className="text-sm font-bold text-on-surface capitalize">
                                            {t.inc.eventType?.replace('_', ' ')} · {sev}
                                        </span>
                                        <button
                                            onClick={() => dismissToast(t.id)}
                                            className="text-on-surface-variant hover:text-on-surface text-xs"
                                            aria-label="Dismiss"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <p className="text-xs text-on-surface-variant mt-1">
                                        {t.inc.deviceId} · {formatTime(t.inc.timestamp)}
                                    </p>
                                    {Number.isFinite(t.distKm) && (
                                        <p className={`text-[11px] font-bold mt-1 ${t.inRadius ? 'text-error' : 'text-on-surface-variant'}`}>
                                            {t.inRadius ? '⚠ ' : ''}{formatDistance(t.distKm)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
