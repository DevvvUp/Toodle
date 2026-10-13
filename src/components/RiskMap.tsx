import React, { useEffect, useRef } from 'react';
import { View, Platform, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../theme';

interface RiskMapProps {
  liveNodes: any[];
  fieldReports?: any[];
  onNodePress: (id: string | number) => void;
  isSatellite: boolean;
  radarUrl?: string | null;
  userLocation?: { lat: number, lng: number } | null;
  focusNodeId?: string | number | null;
}

export default function RiskMap({ liveNodes, fieldReports = [], onNodePress, isSatellite, radarUrl, userLocation, focusNodeId }: RiskMapProps) {
  const webViewRef = useRef<WebView>(null);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.text}>Map rendering unavailable on web</Text>
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
        <style>
          body { padding: 0; margin: 0; background-color: #0a0a0a; }
          #map { height: 100vh; width: 100vw; }
          .leaflet-tile-pane { filter: ${isSatellite ? 'none' : 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.95) saturate(0.7)'}; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([28.6139, 77.2090], 11);
          L.control.attribution({ position: 'bottomright' }).addTo(map);

          let currentTileLayer = null;
          let radarLayer = null;

          function setTileLayer(isSat) {
            if (currentTileLayer) map.removeLayer(currentTileLayer);
            
            const url = isSat 
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
            
            const attribution = isSat ? 'Tiles &copy; Esri' : '&copy; OpenStreetMap contributors';

            currentTileLayer = L.tileLayer(url, { maxZoom: 19, attribution }).addTo(map);
            
            const pane = document.querySelector('.leaflet-tile-pane');
            if (pane) {
              pane.style.filter = isSat ? 'none' : 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.95) saturate(0.7)';
            }

            // Keep radar on top if it exists
            if (radarLayer) {
              radarLayer.bringToFront();
            }
          }
          
          setTileLayer(${isSatellite});

          let markers = {};
          let reportMarkers = {};
          let locationMarker = null;

          function getColor(fri) {
            if (fri >= 0.86) return '#ef4444';
            if (fri >= 0.66) return '#f59e0b';
            return '#22c55e';
          }

          function updateNodes(nodesData) {
            let bounds = [];
            nodesData.forEach(n => {
              const color = getColor(n.fri);
              const latlng = [n.lat, n.lng];
              bounds.push(latlng);
              
              if (markers[n.id]) {
                map.removeLayer(markers[n.id]);
              }

              const circle = L.circleMarker(latlng, {
                radius: 12,
                fillColor: color,
                color: '#000',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
              }).addTo(map);

              circle.bindTooltip(n.name + " (FRI: " + n.fri.toFixed(2) + ")", { direction: 'top' });
              
              circle.on('click', () => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NODE_CLICK', nodeId: n.id }));
              });

              markers[n.id] = circle;
            });

            if (bounds.length > 0 && !window.hasFittedBounds) {
              map.fitBounds(bounds, { padding: [20, 20] });
              window.hasFittedBounds = true;
            }
          }

          function updateReports(reports) {
            Object.values(reportMarkers).forEach(m => map.removeLayer(m));
            reportMarkers = {};

            reports.forEach(r => {
              const color = r.floodDetected ? '#ef4444' : '#22c55e';
              
              // Custom SVG icon for camera reports
              const svgIcon = L.divIcon({
                html: \`<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="\${color}" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#fff"></circle></svg>\`,
                className: 'custom-div-icon',
                iconSize: [24, 24],
                iconAnchor: [12, 24]
              });

              const marker = L.marker([r.lat, r.lng], { icon: svgIcon }).addTo(map);
              
              marker.on('click', () => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REPORT_CLICK', reportId: r.id }));
              });

              reportMarkers[r.id] = marker;
            });
          }

          function setRadar(url) {
            if (radarLayer) map.removeLayer(radarLayer);
            radarLayer = null;
            if (url) {
              radarLayer = L.tileLayer(url, { opacity: 0.6, maxZoom: 19 }).addTo(map);
            }
          }

          let locationAccuracyCircle = null;
          
          function setLocation(loc) {
            if (locationMarker) map.removeLayer(locationMarker);
            if (locationAccuracyCircle) map.removeLayer(locationAccuracyCircle);
            locationMarker = null;
            locationAccuracyCircle = null;

            if (loc && loc.lat && loc.lng) {
              if (loc.accuracy) {
                locationAccuracyCircle = L.circle([loc.lat, loc.lng], {
                  radius: loc.accuracy,
                  fillColor: '#3b82f6',
                  color: '#3b82f6',
                  weight: 1,
                  opacity: 0.2,
                  fillOpacity: 0.1
                }).addTo(map);
              }
              locationMarker = L.circleMarker([loc.lat, loc.lng], {
                radius: 6,
                fillColor: '#3b82f6',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
              }).addTo(map);
            }
          }

          function flyToNode(id) {
            if (id === 'user' && locationMarker) {
              map.flyTo(locationMarker.getLatLng(), 15, { duration: 1 });
            } else if (markers[id]) {
              const latlng = markers[id].getLatLng();
              map.flyTo(latlng, 15, { duration: 1 });
            }
          }

          document.addEventListener('message', function(e) {
            try {
              const data = JSON.parse(e.data);
              if (data.type === 'UPDATE_NODES') {
                updateNodes(data.nodes);
              } else if (data.type === 'SET_STYLE') {
                setTileLayer(data.isSatellite);
              } else if (data.type === 'SET_RADAR') {
                setRadar(data.url);
              } else if (data.type === 'SET_LOCATION') {
                setLocation(data.loc);
              } else if (data.type === 'UPDATE_REPORTS') {
                updateReports(data.reports);
              } else if (data.type === 'FLY_TO') {
                flyToNode(data.nodeId);
              }
            } catch (err) {}
          });
        </script>
      </body>
    </html>
  `;

  useEffect(() => {
    if (webViewRef.current && liveNodes.length > 0) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'UPDATE_NODES', nodes: liveNodes }));
    }
  }, [liveNodes]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'UPDATE_REPORTS', reports: fieldReports }));
    }
  }, [fieldReports]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'SET_STYLE', isSatellite }));
    }
  }, [isSatellite]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'SET_RADAR', url: radarUrl }));
    }
  }, [radarUrl]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'SET_LOCATION', loc: userLocation }));
    }
  }, [userLocation]);

  useEffect(() => {
    if (webViewRef.current && focusNodeId) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'FLY_TO', nodeId: focusNodeId }));
    }
  }, [focusNodeId]);

  return (
    <View style={styles.container}>
      <WebView 
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={["*"]}
        nestedScrollEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.ink} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
        renderError={() => (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>Map failed to load.</Text>
          </View>
        )}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'NODE_CLICK') {
              onNodePress(data.nodeId);
            } else if (data.type === 'REPORT_CLICK') {
              // Could handle opening a report sheet
              console.log('Report clicked', data.reportId);
            }
          } catch(e) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    borderColor: theme.colors.hairline,
    borderWidth: 1,
    backgroundColor: theme.colors.canvas,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body.fontFamily,
  },
  loadingContainer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: theme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: theme.colors.inkMuted,
    marginTop: 12,
    fontFamily: theme.typography.caption.fontFamily,
  },
  errorText: {
    color: theme.colors.risk.critical,
    fontFamily: theme.typography.body.fontFamily,
  }
});
