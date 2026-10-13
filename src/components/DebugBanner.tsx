import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

let capturedError = '';
// @ts-ignore
const originalHandler = global.ErrorUtils?.getGlobalHandler();
// @ts-ignore
if (global.ErrorUtils) {
  // @ts-ignore
  global.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    capturedError = error?.message || String(error);
    if (originalHandler) originalHandler(error, isFatal);
  });
}

export default function DebugBanner() {
  const [apiResult, setApiResult] = useState('Loading...');
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    fetch(`${baseUrl}/api/nodes`, { method: 'GET' })
      .then(r => r.text())
      .then(t => setApiResult(`API ${t.substring(0, 20)}...`))
      .catch(e => setApiResult('Error: ' + e.message));
  }, []);

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>RENDER OK: {new Date().toISOString()}</Text>
      <Text style={styles.text}>OS: {Constants.platform?.android ? 'Android' : 'Other'} SDK: {Constants.expoVersion}</Text>
      <Text style={styles.text}>URL: {process.env.EXPO_PUBLIC_API_BASE_URL}</Text>
      <Text style={styles.text}>API: {apiResult}</Text>
      <Text style={styles.text} numberOfLines={1}>ERR: {capturedError || 'none'}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Text style={styles.text}>NW test: </Text>
        <View className="bg-red-500 w-4 h-4" style={{ width: 16, height: 16, backgroundColor: 'blue' /* default blue, overridden by NativeWind red if works */ }} />
        <Text style={styles.text}>  RA test: </Text>
        <Animated.View style={[{ width: 16, height: 16, backgroundColor: 'green' }, useAnimatedStyle(() => ({ opacity: opacity.value }))]} />
      </View>
      <View style={{ backgroundColor: '#111', padding: 8, marginTop: 4 }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>HOME BODY</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'yellow',
    padding: 10,
    paddingTop: 40,
    zIndex: 9999,
  },
  text: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 10,
  }
});
