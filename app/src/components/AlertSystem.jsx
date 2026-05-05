import { useEffect, useRef, useState } from 'react';
import { distanceKm } from '../firebase';

const SEVERITY_FREQ = {
    severe:   880, // A5
    moderate: 660, // E5
    minor:    440, // A4
};

// Plays a 3-pulse beep at the given frequency through the Web Audio API.
// No external assets needed.
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

// Renders a fixed-position toast stack and triggers buzzer on near-by incidents.
// `incidents`     — array sorted newest-first
// `viewerCoords`  — { lat, lon } or null (null = never beep)
// `radiusKm`      — beep only if incident is within this many km of viewer
export default function AlertSystem({ incidents, viewerCoords, radiusKm = 5 }) {
    const [audioReady,     setAudioReady]     = useState(false);
    const [toasts,         setToasts]         = useState([]);
    const audioCtxRef      = useRef(null);
    const lastSeenTsRef    = useRef(null); // newest event ts we've already shown

    // First load: capture the newest existing timestamp so we don't re-toast history.
    useEffect(() => {
        if (lastSeenTsRef.current === null && incidents.length > 0) {
            lastSeenTsRef.current = incidents[0].timestamp || 0;
        } else if (lastSeenTsRef.current === null) {
            lastSeenTsRef.current = 0;
        }
    }, [incidents]);

    // Watch for newer-than-seen incidents.
    useEffect(() => {
        if (lastSeenTsRef.current === null) return;
        const fresh = incidents.filter(i => (i.timestamp || 0) > lastSeenTsRef.current);
        if (fresh.length === 0) return;

        lastSeenTsRef.current = fresh[0].timestamp || lastSeenTsRef.current;

        fresh.forEach((inc) => {
            const dist = viewerCoords && inc.latitude !== undefined && inc.longitude !== undefined
                ? distanceKm(viewerCoords, { lat: inc.latitude, lon: inc.longitude })
                : Infinity;
            const inRadius = dist <= radiusKm;

            // Always toast.
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

            // Beep only if in radius and audio is unlocked.
            if (inRadius && audioReady && audioCtxRef.current) {
                const freq = SEVERITY_FREQ[inc.severity] || SEVERITY_FREQ.moderate;
                try { playBeep(audioCtxRef.current, freq); } catch { /* ignore */ }
            }
        });
    }, [incidents, viewerCoords, radiusKm, audioReady]);

    // Garbage-collect expired toasts.
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
            // Play a tiny silent blip to fully unlock on iOS.
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

    const dismissToast = (id) => setToasts((prev) => prev.filter(t => t.id !== id));

    return (
        <>
            {!audioReady && (
                <button
                    onClick={enableAudio}
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 bg-tertiary text-on-tertiary text-xs font-bold rounded-full shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
                >
                    <span className="material-symbols-outlined text-base">volume_up</span>
                    Enable sound alerts
                </button>
            )}

            <div className="fixed bottom-24 right-6 z-[1000] flex flex-col gap-3 max-w-sm pointer-events-none">
                {toasts.map((t) => {
                    const sev = t.inc.severity || 'minor';
                    const ringColor = sev === 'severe' ? 'border-error' : sev === 'moderate' ? 'border-tertiary' : 'border-secondary';
                    return (
                        <div
                            key={t.id}
                            className={`pointer-events-auto bg-surface-container-high rounded-xl p-4 border-l-4 ${ringColor} shadow-2xl backdrop-blur-md animate-[slideIn_0.3s_ease-out]`}
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
                                            âœ•
                                        </button>
                                    </div>
                                    <p className="text-xs text-on-surface-variant mt-1">
                                        {t.inc.deviceId} · {formatTime(t.inc.timestamp)}
                                    </p>
                                    {Number.isFinite(t.distKm) && (
                                        <p className={`text-[11px] font-bold mt-1 ${t.inRadius ? 'text-error' : 'text-on-surface-variant'}`}>
                                            {t.inRadius
                                                ? `âš  ${t.distKm.toFixed(1)} km from you`
                                                : `${t.distKm.toFixed(0)} km away`}
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
