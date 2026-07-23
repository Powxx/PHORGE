"use client";
import React, { useEffect, useRef, useState } from 'react';

interface ProfileMapProps {
  latitude: number;
  longitude: number;
  radius: number; // in km
  adresse?: string;
}

export default function ProfileMap({ latitude, longitude, radius, adresse }: ProfileMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  useEffect(() => {
    // 1. Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // 2. Load Leaflet JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setScriptsLoaded(true);
      document.body.appendChild(script);
    } else {
      // Check if Leaflet object is already available
      if ((window as any).L) {
        setScriptsLoaded(true);
      } else {
        const interval = setInterval(() => {
          if ((window as any).L) {
            setScriptsLoaded(true);
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, []);

  useEffect(() => {
    if (!scriptsLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Clean up existing map instance if it exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([latitude, longitude], 10);
    mapRef.current = map;

    // Load and display tile layers from OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Custom Gold Pin Marker
    const goldIcon = L.divIcon({
      className: 'custom-gold-marker-container',
      html: `<div class="w-5 h-5 bg-[#D4AF37] rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    // Add Marker at profile coordinates
    L.marker([latitude, longitude], { icon: goldIcon })
      .addTo(map)
      .bindPopup(adresse || "Ma position");

    // Add Circle representing search radius (radius in meters)
    L.circle([latitude, longitude], {
      color: '#D4AF37',
      fillColor: '#D4AF37',
      fillOpacity: 0.15,
      weight: 2,
      radius: radius * 1000 // Convert km to meters
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [scriptsLoaded, latitude, longitude, radius, adresse]);

  return (
    <div className="mt-6 text-left">
      <h4 className="text-sm font-bold text-zinc-500 mb-2 uppercase tracking-wider">Zone de recherche ({radius} km)</h4>
      <div 
        ref={mapContainerRef} 
        className="h-60 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm relative z-0"
      />
    </div>
  );
}
