import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { useEffect, useState } from 'react';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'ESP32-VEH-01';

// Subscribe to /devices/<id>/live — current ESP32 state, updated ~1 Hz.
export function useLiveSnapshot() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const r = ref(db, `devices/${DEVICE_ID}/live`);
    const unsub = onValue(r, (snap) => {
      setSnapshot(snap.val());
      setLoading(false);
    }, (err) => {
      console.error('useLiveSnapshot error', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { snapshot, loading };
}

// Subscribe to /devices/<id>/events — newest accidents/rollovers first.
export function useEvents(limit = 50) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = query(
      ref(db, `devices/${DEVICE_ID}/events`),
      orderByChild('timestamp'),
      limitToLast(limit),
    );
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setEvents(list);
      setLoading(false);
    }, (err) => {
      console.error('useEvents error', err);
      setLoading(false);
    });
    return unsub;
  }, [limit]);

  return { events, loading };
}

// Subscribe to /devices/<id>/telemetry — 30-second history points for charts.
export function useTelemetry(limit = 120) {
  const [points,  setPoints]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = query(
      ref(db, `devices/${DEVICE_ID}/telemetry`),
      orderByChild('timestamp'),
      limitToLast(limit),
    );
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setPoints(list);
      setLoading(false);
    }, (err) => {
      console.error('useTelemetry error', err);
      setLoading(false);
    });
    return unsub;
  }, [limit]);

  return { points, loading };
}

// "Online" if /live timestamp is within 10s of now. Useful for connection status UI.
export function isDeviceOnline(snapshot) {
  if (!snapshot?.timestamp) return false;
  return Date.now() - snapshot.timestamp < 10000;
}

// Subscribe to /public/incidents — every device's events from across the deployment.
// Used to show public alerts on the map for any viewer, even ones without a device.
export function usePublicIncidents(limit = 200) {
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const r = query(
      ref(db, 'public/incidents'),
      orderByChild('timestamp'),
      limitToLast(limit),
    );
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setIncidents(list);
      setLoading(false);
    }, (err) => {
      console.error('usePublicIncidents error', err);
      setLoading(false);
    });
    return unsub;
  }, [limit]);

  return { incidents, loading };
}

// Browser geolocation. Returns { coords: {lat, lon}, error, requesting }.
// Asks once on mount and watches for movement so the radius check stays current.
export function useViewerLocation() {
  const [coords,     setCoords]     = useState(null);
  const [error,      setError]      = useState(null);
  const [requesting, setRequesting] = useState(true);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported by this browser');
      setRequesting(false);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setRequesting(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setRequesting(false);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { coords, error, requesting };
}

// Haversine distance between two lat/lon points, in kilometers.
export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (d) => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
