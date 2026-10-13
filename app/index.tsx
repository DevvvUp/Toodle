import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

export default function Splash() {
  return (
    <SafeAreaView style={styles.container}>
      <Image source={require('../assets/brand/toodle-logo-white.png')} style={[{ width: 64, height: 64 }, styles.icon]} resizeMode="contain" />
      <Text style={styles.title}>Toodle</Text>
      <Text style={styles.subtitle}>Predict floods before the street submerges.</Text>
      
      <View style={styles.grid}>
        {[{l: '<2.5s', t: 'Latency'}, {l: '88.4%', t: 'Accuracy'}, {l: '$0.003', t: '/node/hr'}, {l: '100%', t: 'Serverless'}].map((s, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardLabel}>{s.l}</Text>
            <Text style={styles.cardText}>{s.t}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/command-center')}>
        <Text style={styles.buttonText}>Open Command Center</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    color: theme.colors.ink,
    fontSize: 30,
    fontWeight: theme.typography.display.fontWeight,
    letterSpacing: theme.typography.display.letterSpacing,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    color: theme.colors.inkMuted,
    fontSize: 18,
    fontWeight: theme.typography.bodyLg.fontWeight,
    letterSpacing: theme.typography.bodyLg.letterSpacing,
    marginBottom: 40,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 48,
  },
  card: {
    width: '48%',
    backgroundColor: theme.colors.surface1,
    borderColor: theme.colors.hairline,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  cardLabel: {
    fontFamily: theme.typography.mono.fontFamily,
    color: theme.colors.ink,
    fontWeight: 'bold',
    fontSize: 18,
  },
  cardText: {
    fontFamily: theme.typography.micro.fontFamily,
    color: theme.colors.inkMuted,
    fontSize: 12,
    fontWeight: theme.typography.micro.fontWeight,
    letterSpacing: theme.typography.micro.letterSpacing,
    marginTop: 4,
  },
  button: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  buttonText: {
    fontFamily: theme.typography.headline.fontFamily,
    color: theme.colors.onPrimary,
    fontWeight: theme.typography.headline.fontWeight,
    letterSpacing: theme.typography.headline.letterSpacing,
    fontSize: 18,
  }
});