import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings as SettingsIcon, Info } from 'lucide-react-native';
import { theme } from '../../src/theme';

export default function Settings() {
  const [diagResults, setDiagResults] = useState({ nodes: '', weather: '', analyze: '', alert: '', health: '' });
  const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  let appVersion = '1.0.0';
  try { appVersion = require('../../../app.json').expo.version; } catch(e) {}
  let hostName = '';
  try { hostName = new URL(BASE_URL).hostname; } catch(e) {}

  const runChecks = async () => {
    const check = async (path: string, options?: any) => {
      try {
        const res = await fetch(BASE_URL + path, options);
        if (res.headers.get('content-type')?.includes('text/html')) {
          return 'FAIL: ' + res.status + ' HTML returned';
        }
        if (!res.ok) {
           let msg = 'Failed';
           try { const body = await res.json(); msg = body.error || msg; } catch {}
           return 'FAIL: ' + res.status + ' ' + msg;
        }
        return 'PASS';
      } catch (err: any) {
        return 'FAIL: ' + err.message;
      }
    };

    setDiagResults(prev => ({ ...prev, nodes: 'Testing...', weather: 'Testing...', analyze: 'Testing...', health: 'Testing...' }));
    const h = await check('/api/health');
    const n = await check('/api/nodes');
    const w = await check('/api/weather');
    const b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const a = await check('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: b64 }) });
    setDiagResults(prev => ({ ...prev, nodes: n, weather: w, analyze: a, health: h }));
  }

  const sendTestAlert = () => {
    Alert.alert('Send Test Alert', 'This will send one real email. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
          setDiagResults(prev => ({ ...prev, alert: 'Sending...' }));
          try {
            const res = await fetch(BASE_URL + '/api/dispatch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodeId: 4, nodeName: 'Test Node', fri: 0.95, action: 'Dispatch maintenance', drainStatus: 'App Dispatch' })
            });
            if (res.headers.get('content-type')?.includes('text/html')) {
              setDiagResults(prev => ({ ...prev, alert: 'FAIL: ' + res.status + ' HTML returned' }));
              return;
            }
            if (res.status === 429) {
              const b = await res.json();
              setDiagResults(prev => ({ ...prev, alert: 'Cooldown active. ' + b.remainingSeconds + 's left' }));
            } else if (!res.ok) {
               setDiagResults(prev => ({ ...prev, alert: 'FAIL: ' + res.status }));
            } else {
               const b = await res.json();
               setDiagResults(prev => ({ ...prev, alert: 'PASS: ' + (b.messageId || 'Success') }));
            }
          } catch (e: any) {
            setDiagResults(prev => ({ ...prev, alert: 'FAIL: ' + e.message }));
          }
      }}
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SettingsIcon color={theme.colors.ink} size={20} />
        <Text style={styles.headerTitle}>Settings & Info</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionTitle}>Connection diagnostics</Text>
        <View style={styles.card}>
          <Text style={{color: theme.colors.inkMuted, marginBottom: 4, fontFamily: theme.typography.micro.fontFamily}}>Host: {hostName}</Text>
          <Text style={{color: theme.colors.inkMuted, marginBottom: 8, fontFamily: theme.typography.micro.fontFamily}}>App Version: {appVersion}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Health</Text>
            <Text style={styles.value}>{diagResults.health || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nodes</Text>
            <Text style={styles.value}>{diagResults.nodes || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Weather</Text>
            <Text style={styles.value}>{diagResults.weather || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Analyze</Text>
            <Text style={styles.value}>{diagResults.analyze || '-'}</Text>
          </View>
          
          <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={runChecks}>
            <Text style={styles.buttonText}>Run checks</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={[styles.row, { borderBottomWidth: 0, paddingVertical: 0 }]}>
            <Text style={styles.label}>SNS Alert</Text>
            <Text style={styles.value}>{diagResults.alert || '-'}</Text>
          </View>
          <TouchableOpacity style={[styles.button, { marginTop: 12, backgroundColor: theme.colors.risk.criticalDarkBg, borderColor: theme.colors.risk.critical }]} onPress={sendTestAlert}>
            <Text style={[styles.buttonText, { color: theme.colors.risk.criticalDarkText }]}>Send test alert</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>KPIs & Thresholds</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Critical FRI Threshold</Text>
            <Text style={styles.value}>0.86</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Dispatch Cooldown</Text>
            <Text style={styles.value}>15 min</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Polling Frequency</Text>
            <Text style={styles.value}>10s</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Simulations</Text>
        <View style={[styles.card, styles.simCard]}>
          <View style={styles.simTextContainer}>
            <Text style={styles.simTitle}>Lens Occlusion Fallback</Text>
            <Text style={styles.simDesc}>Raises acoustic weight dynamically if camera is obstructed.</Text>
          </View>
          <Switch value={true} onValueChange={() => {}} trackColor={{ true: theme.colors.accentBlue, false: theme.colors.surface2 }} />
        </View>

        <Text style={styles.sectionTitle}>About App Architecture</Text>
        <View style={styles.infoCard}>
          <Info color={theme.colors.inkMuted} size={24} style={styles.infoIcon} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Live Integration</Text>
            <Text style={styles.infoDesc}>
              Amazon Rekognition (Computer Vision), Amazon SNS (Alerts), and Amazon DynamoDB (State) are fully live in this environment.{'\n\n'}
              Amazon Kinesis ingestion and Amazon SageMaker acoustic scoring models are simulated in this prototype version.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.hairline, marginBottom: 16, gap: 8 },
  headerTitle: { color: theme.colors.ink, fontFamily: theme.typography.headline.fontFamily, fontWeight: theme.typography.headline.fontWeight, letterSpacing: theme.typography.headline.letterSpacing },
  scroll: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  sectionTitle: { color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, fontSize: 18, marginBottom: 8, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing },
  card: { backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.hairline, borderRadius: theme.radii.xl, padding: 16, marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.hairlineSoft },
  label: { color: theme.colors.inkMuted, fontFamily: theme.typography.bodySm.fontFamily, letterSpacing: theme.typography.bodySm.letterSpacing },
  value: { color: theme.colors.ink, fontFamily: theme.typography.mono.fontFamily },
  button: { backgroundColor: theme.colors.surface2, borderColor: theme.colors.hairline, borderWidth: 1, borderRadius: theme.radii.pill, padding: 12, alignItems: 'center' },
  buttonText: { color: theme.colors.ink, fontWeight: theme.typography.button.fontWeight, fontFamily: theme.typography.button.fontFamily, letterSpacing: theme.typography.button.letterSpacing },
  simCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  simTextContainer: { flex: 1, paddingRight: 16 },
  simTitle: { color: theme.colors.ink, fontFamily: theme.typography.bodySm.fontFamily, letterSpacing: theme.typography.bodySm.letterSpacing },
  simDesc: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 2, fontFamily: theme.typography.micro.fontFamily, letterSpacing: theme.typography.micro.letterSpacing },
  infoCard: { backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.hairline, borderRadius: theme.radii.xl, padding: 16, flexDirection: 'row' },
  infoIcon: { marginRight: 12, marginTop: 4 },
  infoTextContainer: { flex: 1 },
  infoTitle: { color: theme.colors.ink, fontWeight: theme.typography.headline.fontWeight, fontFamily: theme.typography.headline.fontFamily, letterSpacing: theme.typography.headline.letterSpacing, marginBottom: 4 },
  infoDesc: { color: theme.colors.inkMuted, fontSize: 14, lineHeight: 20, fontFamily: theme.typography.bodySm.fontFamily, letterSpacing: theme.typography.bodySm.letterSpacing }
});
