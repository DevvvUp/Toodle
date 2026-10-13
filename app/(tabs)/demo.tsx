import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { analyzeImage, dispatchUnit } from '../../src/lib/api';
import { validateRoadImage, RoadValidationResult } from '../../src/lib/imageValidation';
import { Camera, AlertTriangle, CheckCircle, Activity, MapPin, ShieldCheck } from 'lucide-react-native';
import { useSimulatorStore } from '../../src/store/simulator-store';
import { theme } from '../../src/theme';

const SHOW_DEBUG_LABELS = true;
const MAX_LABELS_SHOWN = 4;

const FLOOD_PRIORITY_LABELS = [
  'flood',
  'flash flood',
  'water',
  'puddle',
  'road',
  'street',
  'asphalt',
  'tarmac',
  'intersection',
  'highway',
  'pavement',
  'vehicle',
  'car',
  'motorcycle',
];

const FLOOD_PRIORITY_SET = new Set(FLOOD_PRIORITY_LABELS.map(s => s.toLowerCase()));

function getTopDisplayLabels(labels: any[] = [], maxCount = MAX_LABELS_SHOWN): any[] {
  const safeLabels = Array.isArray(labels) ? labels : [];

  // Sort so flood-relevant labels come first, then remaining by confidence descending
  const sorted = [...safeLabels].sort((a, b) => {
    const aName = ((a.Name || a.name || '') as string).toLowerCase().trim();
    const bName = ((b.Name || b.name || '') as string).toLowerCase().trim();
    const aConf = typeof a.Confidence === 'number' ? a.Confidence : typeof a.confidence === 'number' ? a.confidence : 0;
    const bConf = typeof b.Confidence === 'number' ? b.Confidence : typeof b.confidence === 'number' ? b.confidence : 0;

    const aPrio = FLOOD_PRIORITY_SET.has(aName);
    const bPrio = FLOOD_PRIORITY_SET.has(bName);

    if (aPrio && !bPrio) return -1;
    if (!aPrio && bPrio) return 1;
    return bConf - aConf;
  });

  // Remove duplicates by name (case-insensitive) and take first maxCount
  const seen = new Set<string>();
  const top: any[] = [];
  for (const item of sorted) {
    const key = ((item.Name || item.name || '') as string).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    top.push(item);
    if (top.length >= maxCount) break;
  }

  return top;
}

export default function Demo() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [validation, setValidation] = useState<RoadValidationResult | null>(null);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [smsPreview, setSmsPreview] = useState('');
  const [geotag, setGeotag] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const addFieldReport = useSimulatorStore(state => state.addFieldReport);

  const getAlertEligibility = (): { canSend: boolean; reason: string } => {
    if (!validation || !validation.valid) {
      return { canSend: false, reason: validation?.reason || 'Scene not verified' };
    }
    const isFlood = Boolean(result?.flood_detected && (result?.v_pooling || 0) >= 0.70);
    const isBlockage = Boolean(validation?.blockageDetected || result?.blockageDetected);
    if (!isFlood && !isBlockage) {
      if (result?.flood_detected && (result?.v_pooling || 0) < 0.70) {
        return { canSend: false, reason: 'Flood risk (V_pooling) below critical threshold (0.70) and no blockage detected' };
      }
      return { canSend: false, reason: 'Neither flood (≥0.70) nor drain blockage detected' };
    }
    if (!geotag) {
      return { canSend: false, reason: 'GPS location required' };
    }
    if (geotag.mocked === true) {
      return { canSend: false, reason: 'Mocked GPS locations are not allowed for alerts' };
    }
    const capturedTimestamp = new Date(geotag.capturedAt).getTime();
    const ageMs = Date.now() - capturedTimestamp;
    if (ageMs > 2 * 60 * 1000 || ageMs < -60000) {
      return { canSend: false, reason: 'Geotag expired (must be captured within 2 minutes)' };
    }
    return { canSend: true, reason: '' };
  };

  const takePhoto = async () => {
    setLocationError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setLocationError('Location permission is required to geotag reports. Please enable it in Settings.');
      return;
    }
    
    let location;
    try {
      location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 10000))
      ]) as Location.LocationObject;
    } catch (err: any) {
      setLocationError(err.message === 'Location timeout' ? 'Failed to get location fix within 10s. Please ensure GPS is active.' : 'Could not determine location.');
      return;
    }

    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      setLocationError('Camera permission is required.');
      return;
    }

    let res = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
    if (!res.canceled) {
      const gTag = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracyMeters: location.coords.accuracy,
        altitude: location.coords.altitude,
        capturedAt: new Date().toISOString(),
        mocked: location.mocked === true
      };
      setGeotag(gTag);
      processImage(res.assets[0].uri, gTag);
    }
  };

  const processImage = async (uri: string, currentGeotag: any) => {
    setImageUri(uri);
    setAnalyzing(true);
    setResult(null);
    setValidation(null);
    setSmsPreview('');
    
    try {
      const info = await ImageManipulator.manipulateAsync(uri, []);
      let { width: w, height: h } = info;
      let quality = 0.7;
      const MAX_SIZE = 1280;
      let newW = w, newH = h;
      if (w > h && w > MAX_SIZE) { newH = h * (MAX_SIZE / w); newW = MAX_SIZE; }
      else if (h > w && h > MAX_SIZE) { newW = w * (MAX_SIZE / h); newH = MAX_SIZE; }

      let manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: newW, height: newH } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Loop until base64 is under 2MB (~1.5MB binary equivalent)
      while (manipResult.base64!.length > 2 * 1024 * 1024 && quality > 0.1) {
        quality -= 0.2;
        newW *= 0.8;
        newH *= 0.8;
        manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: newW, height: newH } }],
          { compress: Math.max(0.1, quality), format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
      }

      setImageUri(manipResult.uri);

      const data = await analyzeImage(manipResult.base64!);
      
      const sortedLabels = (data.labels || []).sort((a: any, b: any) => {
        const aPrio = FLOOD_PRIORITY_SET.has((a.Name || a.name || '').toLowerCase().trim());
        const bPrio = FLOOD_PRIORITY_SET.has((b.Name || b.name || '').toLowerCase().trim());
        if (aPrio && !bPrio) return -1;
        if (!aPrio && bPrio) return 1;
        return (b.Confidence ?? b.confidence ?? 0) - (a.Confidence ?? a.confidence ?? 0);
      });

      const roadVal = validateRoadImage(data.labels || []);
      setValidation(roadVal);
      setResult({ ...data, labels: sortedLabels });

      // Only save report globally when image is a valid road scene
      if (roadVal.valid) {
        addFieldReport({
          id: Math.random().toString(36).substr(2, 9),
          uri: manipResult.uri,
          lat: currentGeotag.latitude,
          lng: currentGeotag.longitude,
          verdict: data.flood_detected ? "Flood Detected" : "No Flood",
          vPooling: data.v_pooling || 0,
          timestamp: currentGeotag.capturedAt,
          floodDetected: data.flood_detected,
          accuracy: currentGeotag.accuracyMeters,
          mocked: currentGeotag.mocked
        });
      }

    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDispatch = async () => {
    const eligibility = getAlertEligibility();
    if (!eligibility.canSend) {
      setResult((prev: any) => ({ ...prev, dispatchError: eligibility.reason }));
      return;
    }

    setDispatching(true);
    try {
      const isFlood = Boolean(result?.flood_detected && (result?.v_pooling || 0) >= 0.70);
      const isBlockage = Boolean(validation?.blockageDetected || result?.blockageDetected);
      const isBlockageOnly = isBlockage && !isFlood;
      const drainStatus = isBlockageOnly ? "Drain blockage detected (visual)" : "App Dispatch";

      const shouldIncludeCoords = isFlood || isBlockage;
      const coordsString = shouldIncludeCoords && geotag ? ` [GPS: ${geotag.latitude.toFixed(6)}, ${geotag.longitude.toFixed(6)}]` : '';
      const mapLink = shouldIncludeCoords && geotag ? `\nMap: https://www.openstreetmap.org/?mlat=${geotag.latitude}&mlon=${geotag.longitude}` : '';
      
      await dispatchUnit(
        4, 
        "DTU Main Gate", 
        result?.v_pooling || 0.92, 
        "Dispatch Hydro-Jet" + coordsString,
        { roadVerified: true, screenDetected: false, drainStatus, blockageDetected: isBlockage }
      );
      
      setSmsPreview(`[CRITICAL ALERT - FLOODGUARD AI]\nNode: #4 (DTU Main Gate Intersection)\nRisk Score: ${(result?.v_pooling || 0.92).toFixed(2)} | Drain Status: ${drainStatus}\nRec. Action: Dispatch Hydro-Jet Truck to Clear Ingress Grate.${mapLink}`);
    } catch (err: any) {
      setResult((prev: any) => ({ ...prev, dispatchError: err.message }));
    } finally {
      setDispatching(false);
    }
  };

  const openMap = () => {
    if (geotag) {
      Linking.openURL(`https://www.openstreetmap.org/?mlat=${geotag.latitude}&mlon=${geotag.longitude}#map=18/${geotag.latitude}/${geotag.longitude}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Live Field Capture</Text>
        <Text style={styles.subtitle}>Capture a geotagged photo to analyze flood risk via Amazon Rekognition.</Text>

        {locationError && (
          <View style={styles.errorCard}>
            <AlertTriangle color={theme.colors.risk.critical} size={24} style={{ marginBottom: 8 }} />
            <Text style={styles.errorText}>{locationError}</Text>
            <TouchableOpacity onPress={() => Linking.openSettings()} style={[styles.button, { backgroundColor: theme.colors.surface2, marginBottom: 8 }]}>
              <Text style={styles.buttonText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLocationError(null)} style={[styles.button, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!imageUri && !locationError && (
          <TouchableOpacity onPress={takePhoto} style={styles.captureButton}>
            <Camera color={theme.colors.onPrimary} size={32} style={{ marginBottom: 12 }} />
            <Text style={styles.captureButtonText}>Capture Field Image</Text>
            <Text style={styles.captureSubtext}>High-accuracy GPS required</Text>
          </TouchableOpacity>
        )}

        {imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            
            {analyzing && (
              <View style={styles.overlay}>
                <ActivityIndicator size="large" color={theme.colors.ink} />
                <Text style={styles.overlayText}>Analyzing with Amazon Rekognition...</Text>
              </View>
            )}

            {result?.labels?.map((l: any, i: number) => {
              if (!l.Instances) return null;
              const isPriority = FLOOD_PRIORITY_SET.has((l.Name || l.name || '').toLowerCase().trim());
              if (!showAllLabels && !isPriority) return null;

              return l.Instances.map((inst: any, idx: number) => {
                const box = inst.BoundingBox;
                if (!box) return null;
                const top = Math.max(0, box.Top * 100);
                const left = Math.max(0, box.Left * 100);
                const width = Math.min(100 - left, box.Width * 100);
                const height = Math.min(100 - top, box.Height * 100);
                return (
                  <View 
                    key={`${i}-${idx}`} 
                    style={[styles.boundingBox, { top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }]}
                  >
                    <Text style={styles.boxLabel}>{l.Name}</Text>
                  </View>
                );
              });
            })}
          </View>
        )}

        {result?.error && (
          <View style={styles.errorCard}>
            <AlertTriangle color={theme.colors.risk.critical} size={24} style={{ marginBottom: 8 }} />
            <Text style={styles.errorText}>{result.error}</Text>
            <TouchableOpacity onPress={() => setResult(null)} style={[styles.button, { backgroundColor: theme.colors.surface2 }]}>
              <Text style={styles.buttonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {result && !result.error && geotag && (() => {
          const alertEligibility = getAlertEligibility();
          const isDispatchDisabled = dispatching || !alertEligibility.canSend;

          return (
            <View style={{ marginTop: 16 }}>
              {validation && !validation.valid && (
                <View style={styles.invalidCard}>
                  <AlertTriangle color={theme.colors.risk.critical} size={24} style={{ marginBottom: 8 }} />
                  <Text style={styles.invalidTitle}>Image Rejected</Text>
                  <Text style={styles.invalidText}>{validation.reason}</Text>
                  {SHOW_DEBUG_LABELS && result?.labels && result.labels.length > 0 && (
                    <Text style={styles.debugLabelsText}>
                      Detected: {getTopDisplayLabels(result.labels, 12).map((l: any) => `${l.Name ?? l.name} ${Math.round(l.Confidence ?? l.confidence ?? 0)}%`).join(', ')}
                    </Text>
                  )}
                  <TouchableOpacity onPress={takePhoto} style={[styles.button, { backgroundColor: theme.colors.risk.critical, marginTop: 12 }]}>
                    <Text style={[styles.buttonText, { color: '#fff' }]}>Retake photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.resultsHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CheckCircle color={theme.colors.risk.normal} size={20} />
                  <Text style={styles.successText}>Analysis Complete</Text>
                  {validation?.valid && (
                    <View style={styles.badgeRoadVerified}>
                      <Text style={styles.badgeRoadVerifiedText}>Scene verified ({validation.roadConfidence}%)</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => setShowAllLabels(!showAllLabels)} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={styles.toggleText}>Toggle all boxes</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pillRow}>
                <View style={result?.flood_detected ? styles.pillActive : styles.pillInactive}>
                  <Text style={result?.flood_detected ? styles.pillActiveText : styles.pillInactiveText}>
                    {result?.flood_detected ? "Flood detected" : "No flood"}
                  </Text>
                </View>
                <View style={(validation?.blockageDetected || result?.blockageDetected) ? styles.pillWarning : styles.pillInactive}>
                  <Text style={(validation?.blockageDetected || result?.blockageDetected) ? styles.pillWarningText : styles.pillInactiveText}>
                    {(validation?.blockageDetected || result?.blockageDetected) ? "Blockage detected" : "No blockage"}
                  </Text>
                </View>
              </View>

              <View style={styles.geotagCard}>
                <View style={styles.geotagRow}>
                  <MapPin color={theme.colors.inkMuted} size={20} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.geotagLabel}>Location Data</Text>
                    <Text style={styles.geotagValue}>{geotag.latitude.toFixed(6)}, {geotag.longitude.toFixed(6)}</Text>
                    <Text style={styles.geotagSub}>Accuracy: {Math.round(geotag.accuracyMeters)}m | {new Date(geotag.capturedAt).toLocaleTimeString()}</Text>
                  </View>
                  {geotag.mocked ? (
                    <View style={styles.badgeUnverified}><Text style={styles.badgeUnverifiedText}>Mocked</Text></View>
                  ) : (
                    <View style={styles.badgeVerified}><Text style={styles.badgeVerifiedText}>Verified</Text></View>
                  )}
                </View>
                {geotag.accuracyMeters > 100 && (
                  <Text style={styles.warningText}>Warning: Low GPS Accuracy</Text>
                )}
                <TouchableOpacity onPress={openMap} style={styles.mapLinkBtn}>
                  <Text style={styles.mapLinkText}>View on Map</Text>
                </TouchableOpacity>
              </View>

              {getTopDisplayLabels(result.labels).map((l: any, i: number) => {
                const name = l.Name || l.name || '';
                const conf = typeof l.Confidence === 'number' ? l.Confidence : typeof l.confidence === 'number' ? l.confidence : 0;
                const isPriority = FLOOD_PRIORITY_SET.has(name.toLowerCase().trim());
                return (
                  <View key={i} style={styles.labelCard}>
                    <View style={styles.labelRow}>
                      <Text style={isPriority ? styles.labelNamePriority : styles.labelName}>{name}</Text>
                      <Text style={styles.labelScore}>{Number(conf).toFixed(1)}%</Text>
                    </View>
                    <View style={styles.barBackground}>
                      <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, conf))}%`, backgroundColor: isPriority ? theme.colors.ink : theme.colors.inkMuted }]} />
                    </View>
                  </View>
                );
              })}

              {validation?.valid && (
                <View style={[styles.card, { marginTop: 16, borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface1 }]}>
                  <View style={styles.vPoolRow}>
                    <Text style={{ color: theme.colors.risk.warningOrange }}>Calculated V_pooling:</Text>
                    <Text style={styles.vPoolScore}>{result.v_pooling || 0}</Text>
                  </View>
                  <Text style={styles.vPoolReason}>Reason: {result.reason || (result.flood_detected ? "Water/Flood keyword detected" : "No water/flood keywords detected")}</Text>
                </View>
              )}

              <TouchableOpacity 
                onPress={handleDispatch} 
                disabled={isDispatchDisabled} 
                style={[styles.dispatchButton, isDispatchDisabled && styles.dispatchButtonDisabled]}
              >
                <Activity color={isDispatchDisabled ? theme.colors.inkMuted : theme.colors.risk.criticalDarkText} size={20} style={{ marginRight: 8 }} />
                <Text style={[styles.dispatchButtonText, isDispatchDisabled && styles.dispatchButtonTextDisabled]}>
                  {dispatching ? "Sending..." : "Send Test Alert via SNS"}
                </Text>
              </TouchableOpacity>

              {!alertEligibility.canSend && (
                <Text style={styles.disabledReasonText}>{alertEligibility.reason}</Text>
              )}

              {result.dispatchError && <Text style={styles.dispatchErrorText}>{result.dispatchError}</Text>}

              {smsPreview ? (
                <View style={styles.smsCard}>
                  <Text style={styles.smsText}>{smsPreview}</Text>
                </View>
              ) : null}
              
              <TouchableOpacity onPress={() => setImageUri(null)} style={[styles.button, { marginTop: 16, backgroundColor: theme.colors.surface2 }]}>
                <Text style={styles.buttonText}>Capture Another Image</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.canvas },
  scroll: { flex: 1, padding: 16 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  title: { color: theme.colors.ink, fontSize: 24, fontWeight: theme.typography.displayCompact.fontWeight, fontFamily: theme.typography.displayCompact.fontFamily, letterSpacing: theme.typography.displayCompact.letterSpacing, marginBottom: 8 },
  subtitle: { color: theme.colors.inkMuted, fontFamily: theme.typography.body.fontFamily, letterSpacing: theme.typography.body.letterSpacing, fontSize: 15, marginBottom: 24 },
  card: { backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.hairline, borderRadius: theme.radii.xl, padding: 16 },
  captureButton: { backgroundColor: theme.colors.primary, padding: 24, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  captureButtonText: { color: theme.colors.onPrimary, fontSize: 18, fontFamily: theme.typography.headline.fontFamily, fontWeight: theme.typography.headline.fontWeight, letterSpacing: theme.typography.headline.letterSpacing },
  captureSubtext: { color: '#404040', fontSize: 12, marginTop: 8, fontFamily: theme.typography.micro.fontFamily, letterSpacing: theme.typography.micro.letterSpacing },
  imageContainer: { width: '100%', aspectRatio: 3/4, backgroundColor: theme.colors.surface1, borderRadius: theme.radii.xl, borderWidth: 1, borderColor: theme.colors.hairline, overflow: 'hidden', marginBottom: 24 },
  image: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  overlayText: { color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing, marginTop: 8 },
  boundingBox: { position: 'absolute', borderWidth: 2, borderColor: theme.colors.accentBlue, backgroundColor: 'rgba(0, 153, 255, 0.2)' },
  boxLabel: { position: 'absolute', top: -20, left: -2, backgroundColor: theme.colors.accentBlue, color: '#ffffff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 4 },
  errorCard: { backgroundColor: theme.colors.risk.criticalBg, borderColor: theme.colors.risk.criticalBorder, borderWidth: 1, borderRadius: theme.radii.xl, padding: 16, alignItems: 'center' },
  errorText: { color: theme.colors.risk.criticalMuted, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', fontFamily: theme.typography.body.fontFamily },
  invalidCard: { backgroundColor: theme.colors.risk.criticalBg, borderColor: theme.colors.risk.criticalBorder, borderWidth: 1, borderRadius: theme.radii.xl, padding: 16, alignItems: 'center', marginBottom: 16 },
  invalidTitle: { color: theme.colors.risk.critical, fontSize: 16, fontWeight: theme.typography.headline.fontWeight, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing, marginBottom: 4 },
  invalidText: { color: theme.colors.risk.criticalDarkText, fontSize: 13, textAlign: 'center', lineHeight: 18, fontFamily: theme.typography.caption.fontFamily, letterSpacing: theme.typography.caption.letterSpacing },
  button: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radii.pill, minHeight: 44, justifyContent: 'center', alignItems: 'center', width: '100%' },
  buttonText: { color: theme.colors.ink, fontSize: 14, fontWeight: theme.typography.button.fontWeight, fontFamily: theme.typography.button.fontFamily, letterSpacing: theme.typography.button.letterSpacing },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  successText: { color: theme.colors.risk.normal, marginLeft: 8, fontFamily: theme.typography.body.fontFamily },
  toggleText: { color: theme.colors.inkMuted, fontSize: 12, fontFamily: theme.typography.caption.fontFamily, letterSpacing: theme.typography.caption.letterSpacing },
  badgeRoadVerified: { backgroundColor: theme.colors.risk.normalBg, borderColor: theme.colors.risk.normalBorder, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radii.pill },
  badgeRoadVerifiedText: { color: theme.colors.risk.normalLight, fontSize: 11, fontWeight: 'bold', fontFamily: theme.typography.caption.fontFamily },
  geotagCard: { backgroundColor: theme.colors.surface1, borderColor: theme.colors.hairline, borderWidth: 1, borderRadius: theme.radii.xl, padding: 16, marginBottom: 16 },
  geotagRow: { flexDirection: 'row', alignItems: 'flex-start' },
  geotagLabel: { color: theme.colors.inkMuted, fontSize: 12, fontFamily: theme.typography.caption.fontFamily, letterSpacing: theme.typography.caption.letterSpacing },
  geotagValue: { color: theme.colors.ink, fontFamily: theme.typography.mono.fontFamily, fontSize: 16, marginVertical: 4 },
  geotagSub: { color: theme.colors.inkMuted, fontSize: 11, fontFamily: theme.typography.micro.fontFamily, letterSpacing: theme.typography.micro.letterSpacing },
  badgeVerified: { backgroundColor: theme.colors.risk.normalBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radii.pill },
  badgeVerifiedText: { color: theme.colors.risk.normalLight, fontSize: 10, fontWeight: 'bold' },
  badgeUnverified: { backgroundColor: theme.colors.risk.criticalBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radii.pill },
  badgeUnverifiedText: { color: theme.colors.risk.criticalMuted, fontSize: 10, fontWeight: 'bold' },
  warningText: { color: theme.colors.risk.warningOrange, fontSize: 12, marginTop: 8, fontFamily: theme.typography.caption.fontFamily },
  mapLinkBtn: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
  mapLinkText: { color: theme.colors.accentBlue, fontSize: 12, fontWeight: 'bold', fontFamily: theme.typography.caption.fontFamily, letterSpacing: theme.typography.caption.letterSpacing },
  labelCard: { backgroundColor: theme.colors.surface1, padding: 12, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.hairline, marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  labelNamePriority: { color: theme.colors.ink, fontWeight: 'bold', fontFamily: theme.typography.bodySm.fontFamily, letterSpacing: theme.typography.bodySm.letterSpacing },
  labelName: { color: theme.colors.ink, fontFamily: theme.typography.bodySm.fontFamily, letterSpacing: theme.typography.bodySm.letterSpacing },
  labelScore: { fontFamily: theme.typography.mono.fontFamily, fontSize: 14, color: theme.colors.inkMuted },
  barBackground: { height: 6, width: '100%', backgroundColor: theme.colors.surface2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%' },
  vPoolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  vPoolScore: { color: theme.colors.risk.warningOrange, fontWeight: 'bold', fontFamily: theme.typography.mono.fontFamily, fontSize: 20 },
  vPoolReason: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 4, fontFamily: theme.typography.caption.fontFamily },
  dispatchButton: { backgroundColor: theme.colors.risk.criticalDarkBg, borderColor: theme.colors.risk.critical, borderWidth: 1, padding: 16, borderRadius: theme.radii.pill, marginTop: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  dispatchButtonDisabled: { backgroundColor: theme.colors.surface1, borderColor: theme.colors.hairline, opacity: 0.7 },
  dispatchButtonText: { color: theme.colors.risk.criticalDarkText, fontWeight: theme.typography.headline.fontWeight, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing },
  dispatchButtonTextDisabled: { color: theme.colors.inkMuted },
  disabledReasonText: { color: theme.colors.inkMuted, fontSize: 12, textAlign: 'center', marginTop: 8, fontFamily: theme.typography.micro.fontFamily },
  dispatchErrorText: { color: theme.colors.risk.critical, fontSize: 12, textAlign: 'center', marginTop: 8, fontFamily: theme.typography.caption.fontFamily },
  smsCard: { backgroundColor: theme.colors.surface1, borderColor: theme.colors.hairline, borderWidth: 1, padding: 16, borderRadius: theme.radii.lg, marginTop: 16 },
  smsText: { color: theme.colors.ink, fontFamily: theme.typography.mono.fontFamily, fontSize: 12 },
  debugLabelsText: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 8, fontFamily: theme.typography.micro.fontFamily },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  pillActive: { backgroundColor: theme.colors.risk.criticalBg, borderColor: theme.colors.risk.criticalBorder, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill },
  pillActiveText: { color: theme.colors.risk.criticalMuted, fontSize: 11, fontWeight: 'bold', fontFamily: theme.typography.caption.fontFamily },
  pillWarning: { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill },
  pillWarningText: { color: '#fbbf24', fontSize: 11, fontWeight: 'bold', fontFamily: theme.typography.caption.fontFamily },
  pillInactive: { backgroundColor: theme.colors.surface2, borderColor: theme.colors.hairline, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill },
  pillInactiveText: { color: theme.colors.inkMuted, fontSize: 11, fontFamily: theme.typography.caption.fontFamily }
});
