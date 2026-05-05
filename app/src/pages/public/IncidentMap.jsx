import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
    useLiveSnapshot, useEvents, isDeviceOnline, DEVICE_ID,
    usePublicIncidents, useViewerLocation, distanceKm,
} from '../../firebase';
import AlertSystem from '../../components/AlertSystem';

const PUBLIC_INCIDENT_TTL_MS = 24 * 60 * 60 * 1000; // hide UI markers older than 24h
const DEFAULT_ALERT_RADIUS_KM = 5;

// Custom red icon for public incidents (different from your device's blue marker).
const incidentIcon = new L.DivIcon({
    className: 'custom-incident-icon',
    html: `<div style="
        background:#FFB3AC;
        width:18px;height:18px;
        border-radius:50%;
        border:3px solid #670008;
        box-shadow:0 0 12px rgba(255,179,172,0.7);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

// Custom blue icon for the viewer's own location.
const viewerIcon = new L.DivIcon({
    className: 'custom-viewer-icon',
    html: `<div style="
        background:#4FC3F7;
        width:14px;height:14px;
        border-radius:50%;
        border:3px solid #01579B;
        box-shadow:0 0 12px rgba(79,195,247,0.6);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

// Default Leaflet marker icons break under bundlers because their CSS-relative
// image URLs don't resolve. Re-point them at CDN URLs.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Pan the map to follow the device when its coordinates update.
function FlyToDevice({ lat, lon }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lon) map.flyTo([lat, lon], map.getZoom(), { duration: 0.6 });
    }, [lat, lon, map]);
    return null;
}

function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString();
}

function tiltStatus(tilt) {
    if (tilt === undefined || tilt === null) return { label: 'Unknown', color: 'outline' };
    if (tilt > 75) return { label: 'Critical Tilt',  color: 'primary' };
    if (tilt > 45) return { label: 'Warning Tilt',   color: 'tertiary' };
    return { label: 'Nominal Range', color: 'secondary' };
}

export default function IncidentMap() {
    const { snapshot }              = useLiveSnapshot();
    const { events }                = useEvents(20);
    const { incidents: allPublic }  = usePublicIncidents(200);
    const { coords: viewerCoords, error: locError } = useViewerLocation();
    const online                    = isDeviceOnline(snapshot);

    const lat = snapshot?.latitude  ?? 30.316494;
    const lon = snapshot?.longitude ?? 78.032191;
    const tilt = snapshot?.tiltDeg ?? 0;
    const tiltState = tiltStatus(tilt);

    const lastEvent = events[0];
    const externalMap = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=16`;

    const [radiusKm, setRadiusKm] = useState(() => {
        const saved = Number(localStorage.getItem('alertRadiusKm'));
        return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_ALERT_RADIUS_KM;
    });
    const updateRadius = (v) => {
        setRadiusKm(v);
        localStorage.setItem('alertRadiusKm', String(v));
    };

    // UI-only filter: hide public incidents older than 24h. They stay in the DB.
    const visiblePublic = useMemo(() => {
        const cutoff = Date.now() - PUBLIC_INCIDENT_TTL_MS;
        return allPublic.filter(i => (i.timestamp || 0) >= cutoff);
    }, [allPublic]);

    const nearbyCount = useMemo(() => {
        if (!viewerCoords) return 0;
        return visiblePublic.filter(i => {
            if (i.latitude === undefined || i.longitude === undefined) return false;
            return distanceKm(viewerCoords, { lat: i.latitude, lon: i.longitude }) <= radiusKm;
        }).length;
    }, [visiblePublic, viewerCoords, radiusKm]);

    return (
        <div className="relative flex flex-col md:flex-row overflow-hidden w-full h-[calc(100vh-8.5rem)]">
            <section className="flex-1 relative h-[530px] md:h-auto overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <MapContainer
                        center={[lat, lon]}
                        zoom={15}
                        style={{ height: '100%', width: '100%', background: '#1a1c1e' }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[lat, lon]}>
                            <Popup>
                                <strong>{DEVICE_ID}</strong> (your device)<br />
                                {lat.toFixed(6)}, {lon.toFixed(6)}<br />
                                {snapshot?.gpsReal ? 'Real GPS fix' : 'Mock coordinates'}
                                {lastEvent && (
                                    <>
                                        <br /><br />
                                        Last: {(lastEvent.eventType || 'event')} ({lastEvent.severity || '—'})<br />
                                        {formatTime(lastEvent.timestamp)}
                                    </>
                                )}
                            </Popup>
                        </Marker>
                        {online && (
                            <Circle
                                center={[lat, lon]}
                                radius={50}
                                pathOptions={{ color: '#FFB3AC', fillColor: '#FFB3AC', fillOpacity: 0.15 }}
                            />
                        )}

                        {visiblePublic.map((inc) => (
                            (inc.latitude !== undefined && inc.longitude !== undefined) && (
                                <Marker
                                    key={inc.id}
                                    position={[inc.latitude, inc.longitude]}
                                    icon={incidentIcon}
                                >
                                    <Popup>
                                        <strong>{inc.eventType?.toUpperCase()} · {inc.severity?.toUpperCase()}</strong><br />
                                        Device: {inc.deviceId || '—'}<br />
                                        {formatTime(inc.timestamp)}<br />
                                        {inc.netAccel !== undefined && <>Net accel: {inc.netAccel.toFixed(1)} m/s²<br /></>}
                                        {inc.tiltDeg !== undefined && <>Tilt: {inc.tiltDeg.toFixed(0)}°<br /></>}
                                        {viewerCoords && inc.latitude !== undefined && (
                                            <>Distance: {distanceKm(viewerCoords, { lat: inc.latitude, lon: inc.longitude }).toFixed(1)} km</>
                                        )}
                                    </Popup>
                                </Marker>
                            )
                        ))}

                        {viewerCoords && (
                            <>
                                <Marker position={[viewerCoords.lat, viewerCoords.lon]} icon={viewerIcon}>
                                    <Popup>You are here</Popup>
                                </Marker>
                                <Circle
                                    center={[viewerCoords.lat, viewerCoords.lon]}
                                    radius={radiusKm * 1000}
                                    pathOptions={{ color: '#4FC3F7', fillColor: '#4FC3F7', fillOpacity: 0.05, dashArray: '5,5' }}
                                />
                            </>
                        )}

                        <FlyToDevice lat={lat} lon={lon} />
                    </MapContainer>
                </div>

                <div className="absolute inset-0 pointer-events-none z-[400] p-6 flex flex-col justify-between">

                    <div className="flex flex-wrap gap-4 pointer-events-auto">
                        <div className="bg-surface-container-low/85 backdrop-blur-md p-4 rounded-xl border-l-4 border-primary shadow-2xl">
                            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Active Site Coordinates</p>
                            <h2 className="text-xl font-bold tabular-nums">
                                {lat.toFixed(4)}&deg; N, {lon.toFixed(4)}&deg; E
                            </h2>
                            <p className="text-sm text-on-surface-variant mt-1">
                                {snapshot?.gpsReal ? 'Live GPS fix' : 'Mock coordinates'} &bull; {DEVICE_ID}
                            </p>
                        </div>

                        <div className={`bg-surface-container-low/85 backdrop-blur-md p-4 rounded-xl border-l-4 ${online ? 'border-tertiary' : 'border-outline'} shadow-2xl`}>
                            <p className="text-[10px] uppercase tracking-widest text-on-tertiary font-bold mb-1">System Status</p>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>}
                                    <span className={`relative inline-flex rounded-full h-3 w-3 ${online ? 'bg-tertiary' : 'bg-outline'}`}></span>
                                </span>
                                <span className="text-lg font-bold">{online ? 'Sentinel: Monitoring' : 'Device: Offline'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-end gap-4 pointer-events-auto">
                        <div className="bg-surface-container-low/85 backdrop-blur-md p-4 rounded-xl shadow-2xl min-w-[260px]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                                    Alert Radius
                                </span>
                                <span className="text-sm font-bold tabular-nums text-primary">
                                    {radiusKm} km
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                step="1"
                                value={radiusKm}
                                onChange={(e) => updateRadius(Number(e.target.value))}
                                className="w-full accent-primary"
                            />
                            <p className="text-[10px] text-on-surface-variant mt-2">
                                {viewerCoords
                                    ? `${nearbyCount} incident${nearbyCount === 1 ? '' : 's'} within ${radiusKm} km · buzzer enabled`
                                    : locError
                                        ? 'Location denied — buzzer disabled, view-only.'
                                        : 'Requesting location…'}
                            </p>
                        </div>

                        <a
                            href={externalMap}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-surface-container-high rounded-lg text-xs font-bold text-on-surface hover:bg-surface-bright transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-base">open_in_new</span>
                            Open in OSM
                        </a>
                    </div>
                </div>
            </section>

            <AlertSystem
                incidents={allPublic}
                viewerCoords={viewerCoords}
                radiusKm={radiusKm}
            />

            <aside className="w-full md:w-[420px] bg-surface-container-low border-l border-[#37393B]/20 flex flex-col z-20 shadow-2xl overflow-y-auto">
                <div className="p-8 space-y-8">
                    <div>
                        <h3 className="text-sm font-bold tracking-widest text-on-surface-variant uppercase mb-4">Roll Stability Index</h3>
                        <div className="bg-surface-container-lowest p-6 rounded-2xl relative overflow-hidden border border-outline-variant/10">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <p className="text-5xl font-black tabular-nums tracking-tighter">{tilt.toFixed(1)}&deg;</p>
                                    <p className="text-xs font-medium text-on-surface-variant mt-1">Current Lateral Tilt</p>
                                </div>
                                <div className="text-right">
                                    <span className={`bg-${tiltState.color}-container/30 text-${tiltState.color} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                                        {tiltState.label}
                                    </span>
                                </div>
                            </div>
                            <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                                <div className="h-full bg-secondary" style={{ width: '25%' }}></div>
                                <div className="h-full bg-tertiary"  style={{ width: '50%' }}></div>
                                <div className="h-full bg-primary"   style={{ width: '25%' }}></div>
                            </div>
                            <div
                                className="absolute bottom-6 w-1 h-3 bg-white shadow-[0_0_10px_white]"
                                style={{ left: `${Math.min(Math.max((tilt / 180) * 100, 0), 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold tracking-widest text-on-surface-variant uppercase">Critical Feed</h3>
                            <span className="material-symbols-outlined text-primary text-sm animate-pulse">radio_button_checked</span>
                        </div>

                        <div className="space-y-4">
                            {events.length === 0 && (
                                <p className="text-sm text-on-surface-variant">No events recorded.</p>
                            )}
                            {events.slice(0, 6).map((e, i) => (
                                <div key={e.id} className="flex gap-4 group" style={{ opacity: 1 - i * 0.13 }}>
                                    <div className="flex flex-col items-center">
                                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-outline-variant'}`}></div>
                                        {i < events.length - 1 && (
                                            <div className={`w-px flex-1 ${i === 0 ? 'bg-gradient-to-b from-primary to-transparent' : 'bg-outline-variant/30'} mt-2`}></div>
                                        )}
                                    </div>
                                    <div className="pb-6">
                                        <p className={`text-[10px] font-bold tabular-nums ${i === 0 ? 'text-primary' : 'text-on-surface-variant'} mb-1`}>
                                            {formatTime(e.timestamp)}
                                        </p>
                                        <h4 className="text-sm font-bold text-on-surface">
                                            {e.eventType === 'rollover' ? 'Rollover Detected' : 'Impact Detected'} &bull; {e.severity?.toUpperCase()}
                                        </h4>
                                        <p className="text-xs text-on-surface-variant leading-relaxed">
                                            {e.eventType === 'rollover'
                                                ? `Tilt ${e.tiltDeg?.toFixed(0)}°, gyro spike confirmed.`
                                                : `Net accel ${e.netAccel?.toFixed(1)} m/s², vibration ${e.vibrationState ? 'YES' : 'NO'}.`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <a
                        href={externalMap}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-4 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-[0_8px_32px_rgba(211,47,47,0.3)] hover:scale-95 duration-100"
                    >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>navigation</span>
                        Navigate to Vehicle
                    </a>
                </div>
            </aside>
        </div>
    );
}
