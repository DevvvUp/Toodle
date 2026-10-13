import { Tabs } from 'expo-router';
import { Activity, Camera, Settings } from 'lucide-react-native';
import { theme } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      sceneStyle: { backgroundColor: theme.colors.canvas }, 
      headerShown: false, 
      tabBarStyle: { backgroundColor: theme.colors.canvas, borderTopColor: theme.colors.hairline }, 
      tabBarActiveTintColor: theme.colors.accentBlue, 
      tabBarInactiveTintColor: theme.colors.inkMuted, 
      tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 12, letterSpacing: -0.12 } 
    }}>
      <Tabs.Screen name="command-center" options={{ title: 'Command', tabBarIcon: ({color}) => <Activity color={color} size={24}/> }} />
      <Tabs.Screen name="demo" options={{ title: 'Demo', tabBarIcon: ({color}) => <Camera color={color} size={24}/> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({color}) => <Settings color={color} size={24}/> }} />
    </Tabs>
  );
}