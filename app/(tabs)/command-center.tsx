import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSimulatorStore } from '../../src/store/simulator-store';
import { fetchNodes, normalizeNodes, FloodNode } from '../../src/lib/api';
import { fetchLiveWeather, WeatherData, UserWeatherData } from '../../src/lib/weather';
import RiskMap from '../../src/components/RiskMap';
import { calculateFRI } from '../../src/lib/fri';
import { Activity, CloudRain, Droplets, Wind, Thermometer, Layers, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { getWeatherAt } from '../../src/lib/weather';
import { theme } from '../../src/theme';

export interface CalculatedNode extends FloodNode {
  fri: number;
  localWeather?: any;
}

function getDistanceAndBearing(
  userLat: number,
  userLng: number,
  nodeLat: number,
  nodeLng: number
): { distanceKm: number; bearing: string } {
  const R = 6371;
  const dLat = ((nodeLat - userLat) * Math.PI) / 180;
  const dLon = ((nodeLng - userLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((userLat * Math.PI) / 180) *
      Math.cos((nodeLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  const phi1 = (userLat * Math.PI) / 180;
  const phi2 = (nodeLat * Math.PI) / 180;
  const deltaLambda = ((nodeLng - userLng) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  deg = (deg + 360) % 360;
  const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const bearing = sectors[Math.round(deg / 45) % 8];

  return { distanceKm: Math.round(dist * 10) / 10, bearing };
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CommandCenterErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CommandCenter error caught by boundary:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Command Center Error</Text>
            <Text style={styles.errorMessage}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={this.reset}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function CommandCenterContent() {
  const { liveMode, rainMmH, setRainMmH, chokeMultiplier, setChokeMultiplier, liveWeatherMode, setLiveWeatherMode, fieldReports } = useSimulatorStore();
  const [nodes, setNodes] = useState<FloodNode[]>(() => normalizeNodes([]));
  const [dataSource, setDataSource] = useState('');
  const [isSatellite, setIsSatellite] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [radarUrl, setRadarUrl] = useState<string | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CalculatedNode | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number, accuracy?: number} | null>(null);
  const [userWeather, setUserWeather] = useState<UserWeatherData | null>(null);
  const [userPlaceName, setUserPlaceName] = useState<string>('');
  const [locationError, setLocationError] = useState<string>('');
  const [locationWatcher, setLocationWatcher] = useState<Location.LocationSubscription | null>(null);

  useEffect(() => {
    loadNodes();
    loadRadar();
    loadUserLocation();
    return () => {
      if (locationWatcher) locationWatcher.remove();
    };
  }, []);

  const loadUserLocation = async () => {
    try {
      setLocationError('');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied.');
        return;
      }
      
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      ]).catch(() => null);

      if (loc) await processLocation(loc);

      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 500, timeInterval: 60000 },
        (newLoc) => processLocation(newLoc)
      );
      setLocationWatcher(watcher);
    } catch (e: any) {
      setLocationError(e.message || 'Failed to get location');
    }
  };

  const processLocation = async (loc: Location.LocationObject) => {
    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;
    setUserLocation({ lat, lng, accuracy: loc.coords.accuracy || 0 });

    let placeName = '';
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocode && geocode.length > 0) {
        placeName = [geocode[0].district || geocode[0].city, geocode[0].region].filter(Boolean).join(', ');
        setUserPlaceName(placeName);
      } else {
        placeName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setUserPlaceName(placeName);
      }
    } catch (e) {
      placeName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setUserPlaceName(placeName);
    }

    const weather = await getWeatherAt(lat, lng);
    if (!('error' in weather)) {
      setUserWeather(weather);
    }
  };

  useEffect(() => {
    if (liveWeatherMode) {
      loadWeather(nodes);
    }
  }, [liveWeatherMode]);

  const loadNodes = async () => {
    try {
      const { data, source } = await fetchNodes();
      const loaded = Array.isArray(data) && data.length > 0 ? data : normalizeNodes([]);
      setNodes(loaded);
      setDataSource(source);
    } catch {
      setNodes(normalizeNodes([]));
      setDataSource('Demo data');
    }
  };

  const loadWeather = async (nodesToFetch?: FloodNode[]) => {
    setWeatherLoading(true);
    const target = nodesToFetch || (nodes.length > 0 ? nodes : undefined);
    const data = await fetchLiveWeather(target);
    if (data) {
      setWeatherData(data);
    } else {
      setLiveWeatherMode(false); // Fallback to simulation if weather fails
    }
    setWeatherLoading(false);
  };

  const loadRadar = async () => {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await res.json();
      if (data && data.host && data.radar && data.radar.past && data.radar.past.length > 0) {
        const path = data.radar.past[data.radar.past.length - 1].path;
        setRadarUrl(`${data.host}${path}/256/{z}/{x}/{y}/2/1_1.png`);
      }
    } catch (e) {
      // Hide silently
    }
  };

  const applySimulator = (type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'Clear') { setRainMmH(0); setChokeMultiplier(1.0); }
    if (type === 'Moderate') { setRainMmH(15); setChokeMultiplier(1.2); }
    if (type === 'Choke') { setRainMmH(25); setChokeMultiplier(2.0); }
    if (type === 'Storm') { setRainMmH(45); setChokeMultiplier(2.5); }
  };

  const getRRateFromWeather = (rain: number) => {
    if (rain === 0) return 0.0;
    if (rain <= 2.5) return (rain / 2.5) * 0.35;
    if (rain <= 7.5) return 0.35 + ((rain - 2.5) / 5) * 0.3;
    if (rain <= 15) return 0.65 + ((rain - 7.5) / 7.5) * 0.2;
    if (rain <= 30) return 0.85 + ((rain - 15) / 15) * 0.15;
    return 1.0;
  };

  const getNearestNodeId = () => {
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    if (!userLocation || safeNodes.length === 0) return null;
    let nearest = safeNodes[0];
    let minDist = Infinity;
    for (const n of safeNodes) {
      const dist = Math.hypot(n.lat - userLocation.lat, n.lng - userLocation.lng);
      if (dist < minDist) { minDist = dist; nearest = n; }
    }
    return nearest.id;
  };

  const nearestNodeId = getNearestNodeId();
  let userRRate = 0;
  if (userWeather) {
    userRRate = userWeather.rRate ?? getRRateFromWeather(userWeather.effectiveRainMmH ?? userWeather.rainMmH);
  }

  const calculatedNodes: CalculatedNode[] = (Array.isArray(nodes) ? nodes : []).map(n => {
    let distanceKm: number | undefined;
    let bearing: string | undefined;
    if (userLocation) {
      const db = getDistanceAndBearing(userLocation.lat, userLocation.lng, n.lat, n.lng);
      distanceKm = db.distanceKm;
      bearing = db.bearing;
    }

    if (liveMode) {
      return {
        ...n,
        distanceKm,
        bearing,
        fri: typeof n.fri === 'number' ? n.fri : 0.2,
      };
    }
    
    let currentRRate = 0;
    let nodeWeather: any = null;
    
    if (liveWeatherMode && weatherData.length > 0) {
      nodeWeather = weatherData.find(w => String(w.nodeId) === String(n.id));
      if (userWeather && String(n.id) === String(nearestNodeId)) {
        currentRRate = userWeather.rRate ?? getRRateFromWeather(userWeather.effectiveRainMmH ?? userWeather.rainMmH);
        nodeWeather = { ...nodeWeather, ...userWeather };
      } else {
        currentRRate = nodeWeather?.rRate ?? getRRateFromWeather(nodeWeather?.effectiveRainMmH ?? nodeWeather?.rainMmH ?? 0);
      }
    } else {
      currentRRate = rainMmH > 30 ? 1.0 : rainMmH / 30;
    }

    const vPool = typeof n.base_vPooling === 'number' ? n.base_vPooling : 0.25;
    const aImp = typeof n.base_aImpedance === 'number' ? n.base_aImpedance : 0.30;
    const result = calculateFRI(vPool * chokeMultiplier, aImp * chokeMultiplier, currentRRate);
    return {
      ...n,
      distanceKm,
      bearing,
      fri: result.score,
      localWeather: nodeWeather,
    };
  }).sort((a, b) => b.fri - a.fri);

  const topNodeWeather = calculatedNodes[0]?.localWeather;
  
  const weatherBadge = liveWeatherMode ? `LIVE · Open-Meteo${userPlaceName ? ' · ' + userPlaceName : ''}` : `SIMULATION`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Activity color={theme.colors.ink} size={20} />
          <Text style={styles.headerTitle}>Command Center</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.badge}>{weatherBadge}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.modeToggleRow}>
          <TouchableOpacity 
            style={[styles.modeTab, !liveWeatherMode && styles.modeTabActive]} 
            onPress={() => { setLiveWeatherMode(false); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.modeTabText, !liveWeatherMode && styles.modeTabTextActive]}>Simulation</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modeTab, liveWeatherMode && styles.modeTabActive]} 
            onPress={() => { setLiveWeatherMode(true); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.modeTabText, liveWeatherMode && styles.modeTabTextActive]}>Live Weather</Text>
          </TouchableOpacity>
        </View>

        {!liveWeatherMode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Simulate Rain Event</Text>
            <View style={styles.simRow}>
              {['Clear', 'Moderate', 'Choke', 'Storm'].map(type => (
                <TouchableOpacity key={type} style={styles.simButton} onPress={() => applySimulator(type)}>
                  <Text style={styles.simButtonText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {liveWeatherMode && locationError ? (
          <View style={styles.card}>
            <Text style={{color: theme.colors.risk.critical, marginBottom: 8, fontFamily: theme.typography.body.fontFamily}}>{locationError}</Text>
            <TouchableOpacity style={{backgroundColor: theme.colors.surface2, padding: 8, borderRadius: theme.radii.pill}} onPress={() => Linking.openSettings()}>
              <Text style={{color: theme.colors.ink, textAlign: 'center', fontFamily: theme.typography.button.fontFamily}}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{marginTop: 8}} onPress={loadUserLocation}>
              <Text style={{color: theme.colors.accentBlue, textAlign: 'center', fontFamily: theme.typography.button.fontFamily}}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {liveWeatherMode && weatherLoading && (
          <View style={styles.card}>
            <ActivityIndicator color={theme.colors.ink} />
            <Text style={{color: theme.colors.inkMuted, textAlign: 'center', marginTop: 8, fontFamily: theme.typography.micro.fontFamily}}>Fetching Open-Meteo data...</Text>
          </View>
        )}

        <View style={styles.mapWrapper}>
          <RiskMap 
            liveNodes={calculatedNodes} 
            fieldReports={fieldReports}
            onNodePress={(id) => {
              const node = calculatedNodes.find(n => n.id === id);
              if (node) setSelectedNode(node);
            }} 
            isSatellite={isSatellite} 
            radarUrl={showRadar ? radarUrl : null}
            userLocation={userLocation}
            focusNodeId={selectedNode?.id}
          />

          {liveWeatherMode && (
            (userWeather || topNodeWeather) ? (() => {
              const activeW = userWeather || topNodeWeather;
              const rainNow = activeW?.rainMmH ?? 0;
              const last24h = activeW?.last24hMm ?? 0;
              return (
                <View style={styles.weatherOverlay}>
                  <Text style={{color: theme.colors.inkMuted, fontSize: 10, fontFamily: theme.typography.micro.fontFamily, letterSpacing: theme.typography.micro.letterSpacing, marginBottom: 4}}>{userWeather ? 'Your location' : 'Default location (Delhi), location off'}</Text>
                  {rainNow === 0 && last24h >= 1 ? (
                    <Text style={{color: theme.colors.ink, fontSize: 10, fontFamily: theme.typography.caption.fontFamily, marginBottom: 4}}>
                      Clear now, rain in the last 24h: {last24h} mm
                    </Text>
                  ) : rainNow === 0 ? (
                    <Text style={{color: theme.colors.inkMuted, fontSize: 10, fontFamily: theme.typography.caption.fontFamily, marginBottom: 4}}>
                      Clear
                    </Text>
                  ) : null}
                  <View style={styles.weatherRow}>
                    <Thermometer color={theme.colors.ink} size={12} />
                    <Text style={styles.weatherText}>{activeW.tempC}°C (Feels {((activeW as any).feelsLikeC || activeW.tempC)}°C)</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <CloudRain color={theme.colors.ink} size={12} />
                    <Text style={styles.weatherText}>Rain now: {rainNow} mm/h</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Droplets color={theme.colors.inkMuted} size={12} />
                    <Text style={styles.weatherText}>Last 3h: {activeW.last3hMm ?? 0} mm · Last 24h: {last24h} mm</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Wind color={theme.colors.inkMuted} size={12} />
                    <Text style={styles.weatherText}>{activeW.windKmh} km/h</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <Droplets color={theme.colors.inkMuted} size={12} />
                    <Text style={styles.weatherText}>{activeW.precipProbMax ?? 0}% prob (6h)</Text>
                  </View>
                  <Text style={{color: theme.colors.inkMuted, fontSize: 8, marginTop: 4, fontFamily: theme.typography.micro.fontFamily}}>Updated {new Date().toLocaleTimeString().slice(0, 5)}</Text>
                </View>
              );
            })() : !weatherLoading ? (
              <View style={[styles.weatherOverlay, { opacity: 0.7 }]}>
                <Text style={{color: theme.colors.inkMuted, fontSize: 11, fontStyle: 'italic', fontFamily: theme.typography.caption.fontFamily}}>Weather unavailable</Text>
              </View>
            ) : null
          )}
        </View>

        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.toggleButton} onPress={() => setIsSatellite(!isSatellite)}>
            <Layers color={theme.colors.inkMuted} size={16} />
            <Text style={styles.toggleButtonText}>{isSatellite ? 'Dark Street' : 'Satellite'}</Text>
          </TouchableOpacity>
          {radarUrl && (
            <TouchableOpacity style={[styles.toggleButton, showRadar && { borderColor: theme.colors.accentBlue }]} onPress={() => setShowRadar(!showRadar)}>
              <CloudRain color={showRadar ? theme.colors.accentBlue : theme.colors.inkMuted} size={16} />
              <Text style={[styles.toggleButtonText, showRadar && { color: theme.colors.accentBlue }]}>Radar</Text>
            </TouchableOpacity>
          )}
          {userLocation && (
              <TouchableOpacity style={styles.toggleButton} onPress={() => {
                const nearest = calculatedNodes.find(n => n.id === nearestNodeId);
                const mockFri = calculateFRI(nearest?.base_vPooling || 0.5, nearest?.base_aImpedance || 0.5, userRRate).score;
                setSelectedNode({
                  id: 'user',
                  name: 'My Location',
                  fri: mockFri,
                  base_vPooling: nearest?.base_vPooling || 0.5,
                  base_aImpedance: nearest?.base_aImpedance || 0.5,
                  lat: userLocation.lat,
                  lng: userLocation.lng,
                  region: 'Current Location',
                  drainType: 'User Device GPS',
                  localWeather: userWeather,
                });
              }}>
              <MapPin color={theme.colors.accentBlue} size={16} />
              <Text style={styles.toggleButtonText}>Me</Text>
            </TouchableOpacity>
          )}
        </View>

        {selectedNode && (
          <View style={styles.nodeSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedNode.name}</Text>
              <TouchableOpacity onPress={() => setSelectedNode(null)} style={{ padding: 4 }}>
                <Text style={{ color: theme.colors.inkMuted, fontFamily: theme.typography.button.fontFamily, letterSpacing: theme.typography.button.letterSpacing, fontWeight: '500' }}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>FRI Score</Text>
              <Text style={[styles.sheetValue, { color: selectedNode.fri > 0.8 ? theme.colors.risk.critical : theme.colors.risk.normal }]}>{selectedNode.fri.toFixed(2)}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>V_pooling (Simulated)</Text>
              <Text style={styles.sheetValue}>{(selectedNode.base_vPooling * chokeMultiplier).toFixed(2)}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>A_impedance (Simulated)</Text>
              <Text style={styles.sheetValue}>{(selectedNode.base_aImpedance * chokeMultiplier).toFixed(2)}</Text>
            </View>
            
            {liveWeatherMode ? (
              selectedNode.localWeather ? (() => {
                const lw = selectedNode.localWeather;
                const rainNow = lw.rainMmH ?? 0;
                const last24h = lw.last24hMm ?? 0;
                return (
                  <View style={styles.localWeatherBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={styles.localWeatherTitle}>Local Weather</Text>
                      {rainNow === 0 && last24h >= 1 ? (
                        <Text style={{ color: theme.colors.accentBlue, fontSize: 10, fontFamily: theme.typography.caption.fontFamily }}>
                          Clear now, rain in the last 24h: {last24h} mm
                        </Text>
                      ) : rainNow === 0 ? (
                        <Text style={{ color: theme.colors.inkMuted, fontSize: 10, fontFamily: theme.typography.caption.fontFamily }}>
                          Clear
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={styles.lwText}>{lw.tempC}°C</Text>
                      <Text style={styles.lwText}>Rain now: {rainNow} mm/h</Text>
                      <Text style={styles.lwText}>{lw.windKmh} km/h wind</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[styles.lwText, { color: theme.colors.inkMuted }]}>Last 3h: {lw.last3hMm ?? 0} mm</Text>
                      <Text style={[styles.lwText, { color: theme.colors.inkMuted }]}>Last 24h: {last24h} mm</Text>
                      <Text style={[styles.lwText, { color: theme.colors.inkMuted }]}>{lw.precipProbMax ?? 0}% prob</Text>
                    </View>
                  </View>
                );
              })() : (
                <View style={styles.localWeatherBox}>
                  <Text style={[styles.localWeatherTitle, { color: theme.colors.inkMuted }]}>Local Weather</Text>
                  <Text style={{ color: theme.colors.inkMuted, fontSize: 11, fontStyle: 'italic' }}>Weather unavailable</Text>
                </View>
              )
            ) : selectedNode.localWeather ? (
              <View style={styles.localWeatherBox}>
                <Text style={styles.localWeatherTitle}>Local Weather</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.lwText}>{selectedNode.localWeather.tempC}°C</Text>
                  <Text style={styles.lwText}>{selectedNode.localWeather.rainMmH} mm/h</Text>
                  <Text style={styles.lwText}>{selectedNode.localWeather.windKmh} km/h wind</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority Queue</Text>
          <Text style={styles.queueSubtitle}>Delhi NCR monitoring nodes</Text>
          {calculatedNodes.slice(0, 8).map(n => (
            <TouchableOpacity key={String(n.id)} style={styles.queueCard} onPress={() => setSelectedNode(n)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.queueName}>{n.name}</Text>
                {userLocation && n.distanceKm !== undefined && n.bearing ? (
                  <Text style={styles.queueDistance}>{`${n.distanceKm} km ${n.bearing}`}</Text>
                ) : null}
              </View>
              <Text style={styles.queueFri}>FRI: {n.fri.toFixed(2)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {fieldReports.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Field Reports</Text>
            {fieldReports.map(r => (
              <TouchableOpacity key={r.id} style={styles.queueCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin color={r.floodDetected ? theme.colors.risk.critical : theme.colors.risk.normal} size={16} />
                  <Text style={[styles.queueName, { marginLeft: 8 }]}>{r.verdict}</Text>
                </View>
                <Text style={styles.queueFri}>VP: {r.vPooling.toFixed(2)} | {new Date(r.timestamp).toLocaleTimeString()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.hairline },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: theme.typography.headline.fontFamily, color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, letterSpacing: theme.typography.headline.letterSpacing, fontSize: 16 },
  badge: { color: theme.colors.inkMuted, fontSize: 12, fontFamily: theme.typography.micro.fontFamily, letterSpacing: theme.typography.micro.letterSpacing },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  modeToggleRow: { flexDirection: 'row', margin: 16, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.hairline },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radii.pill },
  modeTabActive: { backgroundColor: theme.colors.surface2 },
  modeTabText: { color: theme.colors.inkMuted, fontFamily: theme.typography.button.fontFamily, letterSpacing: theme.typography.button.letterSpacing, fontSize: 12 },
  modeTabTextActive: { color: theme.colors.ink },
  card: { backgroundColor: theme.colors.surface1, borderColor: theme.colors.hairline, borderWidth: 1, borderRadius: theme.radii.xl, padding: 16, marginHorizontal: 16, marginBottom: 16 },
  cardTitle: { fontFamily: theme.typography.headline.fontFamily, color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, letterSpacing: theme.typography.headline.letterSpacing, marginBottom: 12 },
  simRow: { flexDirection: 'row', justifyContent: 'space-between' },
  simButton: { backgroundColor: theme.colors.surface2, borderRadius: theme.radii.pill, padding: 8, minHeight: 44, justifyContent: 'center' },
  simButtonText: { color: theme.colors.ink, fontSize: 12, fontFamily: theme.typography.caption.fontFamily, letterSpacing: theme.typography.caption.letterSpacing },
  mapWrapper: { height: 400, width: '100%', position: 'relative' },
  weatherOverlay: { position: 'absolute', top: 32, left: 32, backgroundColor: 'rgba(20,20,20,0.9)', borderRadius: theme.radii.md, padding: 8, borderWidth: 1, borderColor: theme.colors.hairline },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  weatherText: { color: theme.colors.ink, fontSize: 10, fontFamily: theme.typography.mono.fontFamily },
  mapControls: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 8 },
  toggleButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.surface1, borderColor: theme.colors.hairline, borderWidth: 1, borderRadius: theme.radii.pill, padding: 12, alignItems: 'center', minHeight: 44 },
  toggleButtonText: { color: theme.colors.inkMuted, fontFamily: theme.typography.caption.fontFamily, letterSpacing: theme.typography.caption.letterSpacing, fontSize: 12 },
  nodeSheet: { backgroundColor: theme.colors.surface1, margin: 16, borderRadius: theme.radii.xl, padding: 16, borderWidth: 1, borderColor: theme.colors.hairline },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing, fontSize: 16 },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.hairlineSoft },
  sheetLabel: { color: theme.colors.inkMuted, fontSize: 14, fontFamily: theme.typography.bodySm.fontFamily, letterSpacing: theme.typography.bodySm.letterSpacing },
  sheetValue: { color: theme.colors.ink, fontFamily: theme.typography.mono.fontFamily },
  localWeatherBox: { marginTop: 12, backgroundColor: theme.colors.surface2, padding: 12, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.hairlineSoft },
  localWeatherTitle: { color: theme.colors.ink, fontWeight: 'bold', marginBottom: 8, fontSize: 12, fontFamily: theme.typography.caption.fontFamily, letterSpacing: theme.typography.caption.letterSpacing },
  lwText: { color: theme.colors.inkMuted, fontSize: 12, fontFamily: theme.typography.mono.fontFamily },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, marginBottom: 4, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing },
  queueSubtitle: { color: theme.colors.inkMuted, fontFamily: theme.typography.caption.fontFamily, fontSize: 12, letterSpacing: theme.typography.caption.letterSpacing, marginBottom: 8 },
  queueCard: { backgroundColor: theme.colors.surface1, padding: 16, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.hairline, marginBottom: 8, minHeight: 44 },
  queueName: { color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing },
  queueDistance: { color: theme.colors.inkMuted, fontFamily: theme.typography.caption.fontFamily, fontSize: 11, letterSpacing: theme.typography.caption.letterSpacing },
  queueFri: { color: theme.colors.inkMuted, fontFamily: theme.typography.mono.fontFamily, marginTop: 4 },
  errorContainer: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    backgroundColor: theme.colors.surface1,
    borderColor: theme.colors.risk.critical,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  errorTitle: {
    fontFamily: theme.typography.headline.fontFamily,
    color: theme.colors.risk.critical,
    fontSize: 18,
    fontWeight: theme.typography.headline.fontWeight,
    letterSpacing: theme.typography.headline.letterSpacing,
    marginBottom: 12,
  },
  errorMessage: {
    fontFamily: theme.typography.mono.fontFamily,
    color: theme.colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    fontFamily: theme.typography.headline.fontFamily,
    color: theme.colors.onPrimary,
    fontWeight: theme.typography.headline.fontWeight,
    letterSpacing: theme.typography.headline.letterSpacing,
    fontSize: 14,
  },
});

export default function CommandCenter() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <CommandCenterErrorBoundary onReset={() => setResetKey(k => k + 1)}>
      <CommandCenterContent key={resetKey} />
    </CommandCenterErrorBoundary>
  );
}