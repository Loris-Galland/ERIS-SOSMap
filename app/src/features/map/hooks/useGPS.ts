import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import L from 'leaflet';

interface UserPosition {
  lat: number;
  lng: number;
  alt: number;
}

interface UseGPSProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  isActive: boolean;
}

export function useGPS({ mapInstance, isActive }: UseGPSProps) {
  const [userPosition, setUserPosition] = useState<UserPosition>({ lat: 0, lng: 0, alt: 0 });
  const [gpsStatus, setGpsStatus] = useState('Locating...');
  const userMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!isActive) return;

    let watchId: string | null = null;

    const startTracking = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.requestPermissions();
        }

        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
          (position, err) => {
            if (err) {
              console.warn('[GPS] Error:', err);
              return;
            }
            if (position) {
              const { latitude, longitude, altitude } = position.coords;

              setUserPosition({ lat: latitude, lng: longitude, alt: altitude || 0 });
              setGpsStatus('Connected');

              if (mapInstance.current) {
                if (userMarker.current) {
                  userMarker.current.setLatLng([latitude, longitude]);
                } else {
                  const icon = L.divIcon({
                    className: '',
                    html: `<div class="w-[18px] h-[18px] rounded-full border-[3px] border-white [.theme-contrasted_&]:!shadow-none" style="background-color: rgb(var(--eris-position)); box-shadow: 0 0 15px rgba(var(--eris-position), 0.6);"></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                  });
                  userMarker.current = L.marker([latitude, longitude], { icon }).addTo(mapInstance.current);
                  mapInstance.current.setView([latitude, longitude], 15);
                }
              }
            }
          },
        );
      } catch (error) {
        console.error('GPS Init Error:', error);
        setGpsStatus('GPS Unavailable');
      }
    };

    startTracking();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
      userMarker.current = null;
    };
  }, [isActive, mapInstance]);

  return { userPosition, gpsStatus };
}