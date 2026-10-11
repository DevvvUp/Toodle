"use client";

import React, { useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Tooltip,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CalculatedNode } from "@/lib/api";
import { FieldReport } from "@/store/simulator-store";

interface ToodleMapProps {
  nodes: CalculatedNode[];
  selectedNodeId?: string | number | null;
  onSelectNode: (id: string | number) => void;
  isSatellite: boolean;
  showRadar: boolean;
  radarUrl?: string | null;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  fieldReports?: FieldReport[];
}

function MapController({
  nodes,
  selectedNodeId,
  userLocation,
}: {
  nodes: CalculatedNode[];
  selectedNodeId?: string | number | null;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const hasFitted = useRef(false);

  const fitNodes = useCallback(() => {
    if (nodes.length > 0) {
      const bounds = nodes.map((n) => [n.lat, n.lng] as [number, number]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
    }
  }, [nodes, map]);

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    const handleResize = () => {
      map.invalidateSize();
      if (!hasFitted.current && nodes.length > 0) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          fitNodes();
          hasFitted.current = true;
        }
      }
    };

    // Run on mount
    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(container);

    const handleOrientation = () => {
      map.invalidateSize();
      if (nodes.length > 0) {
        fitNodes();
      }
    };
    window.addEventListener("orientationchange", handleOrientation);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", handleOrientation);
    };
  }, [map, nodes, fitNodes]);

  useEffect(() => {
    if (nodes.length > 0 && !hasFitted.current) {
      const container = map.getContainer();
      if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          map.invalidateSize();
          fitNodes();
          hasFitted.current = true;
        }
      }
    }
  }, [nodes, fitNodes, map]);

  useEffect(() => {
    if (selectedNodeId === "user" && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1 });
    } else if (selectedNodeId) {
      const target = nodes.find((n) => String(n.id) === String(selectedNodeId));
      if (target) {
        map.flyTo([target.lat, target.lng], 15, { duration: 1 });
      }
    }
  }, [selectedNodeId, nodes, userLocation, map]);

  return null;
}

export default function ToodleMap({
  nodes,
  selectedNodeId,
  onSelectNode,
  isSatellite,
  showRadar,
  radarUrl,
  userLocation,
  fieldReports = [],
}: ToodleMapProps) {
  const getNodeColor = (fri: number) => {
    if (fri >= 0.86) return "#ef4444";
    if (fri >= 0.66) return "#f59e0b";
    return "#22c55e";
  };

  const createReportIcon = (floodDetected: boolean) => {
    const color = floodDetected ? "#ef4444" : "#22c55e";
    return L.divIcon({
      html: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="${color}" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#fff"></circle></svg>`,
      className: "custom-div-icon",
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
  };

  return (
    <div
      className={`w-full h-full min-h-[280px] relative z-0 select-none ${
        !isSatellite ? "dark-map-tiles" : ""
      }`}
    >
      <MapContainer
        center={[28.6139, 77.209]}
        zoom={10}
        style={{ height: "100%", width: "100%", background: "#090909" }}
        zoomControl={false}
        attributionControl={false}
      >
        <MapController
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          userLocation={userLocation}
        />

        {isSatellite ? (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={19}
            keepBuffer={4}
            updateWhenIdle={false}
          />
        ) : (
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={19}
            keepBuffer={4}
            updateWhenIdle={false}
          />
        )}

        {showRadar && radarUrl && (
          <TileLayer url={radarUrl} opacity={0.6} maxZoom={19} keepBuffer={4} updateWhenIdle={false} />
        )}

        {/* User Location Accuracy Circle */}
        {userLocation && userLocation.accuracy && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={userLocation.accuracy}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              weight: 1,
              opacity: 0.25,
              fillOpacity: 0.1,
            }}
          />
        )}

        {/* User Location Marker */}
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#0099ff",
              weight: 2,
              opacity: 1,
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top">Your Location</Tooltip>
          </CircleMarker>
        )}

        {/* Nodes Markers */}
        {nodes.map((node) => {
          const color = getNodeColor(node.fri);
          const isSelected = String(node.id) === String(selectedNodeId);

          return (
            <CircleMarker
              key={String(node.id)}
              center={[node.lat, node.lng]}
              radius={isSelected ? 14 : 11}
              pathOptions={{
                fillColor: color,
                color: isSelected ? "#ffffff" : "#000000",
                weight: isSelected ? 3 : 2,
                opacity: 1,
                fillOpacity: 0.9,
              }}
              eventHandlers={{
                click: () => onSelectNode(node.id),
              }}
            >
              <Tooltip direction="top">
                <span className="font-medium text-xs">
                  {node.name} (FRI: {node.fri.toFixed(2)})
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Field Reports */}
        {fieldReports.map((report) => (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={createReportIcon(report.floodDetected)}
            eventHandlers={{
              click: () => onSelectNode(`report-${report.id}`),
            }}
          >
            <Tooltip direction="top">
              <span className="text-xs">
                {report.verdict} (VP: {report.vPooling.toFixed(2)})
              </span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
