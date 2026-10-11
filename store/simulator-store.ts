import { create } from 'zustand';
import { Preset, NodeState, getPresetState, DELHI_NODES } from '@/lib/mock-data';
import { calculateFRI, FRIResult } from '@/lib/fri';

export interface EvaluatedNode extends NodeState {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  drainType: string;
  fri: FRIResult;
}

export interface WeatherData {
  nodeId: string;
  tempC: number;
  humidity: number;
  rainMmH: number;
  windKmh: number;
  weatherCode: number;
  next6hPrecipMm: number[];
  precipProbMax: number;
}

export interface FieldReport {
  id: string;
  uri: string;
  lat: number;
  lng: number;
  verdict: string;
  vPooling: number;
  timestamp: string;
  floodDetected: boolean;
  accuracy: number;
  mocked: boolean;
}

interface SimulatorState {
  preset: Preset;
  isPlaying: boolean;
  nodes: EvaluatedNode[];
  liveMode: boolean;
  liveWeatherMode: boolean;
  rainMmH: number;
  chokeMultiplier: number;
  fieldReports: FieldReport[];
  weatherData: Record<string, WeatherData>;
  setPreset: (preset: Preset) => void;
  togglePlay: () => void;
  tick: () => void;
  setLiveMode: (live: boolean) => void;
  setLiveWeatherMode: (live: boolean) => void;
  setRainMmH: (rain: number) => void;
  setChokeMultiplier: (mult: number) => void;
  addFieldReport: (report: FieldReport) => void;
  updateWeatherData: (data: WeatherData[]) => void;
}

const PRESET_ORDER: Preset[] = ["CLEAR", "RAIN", "CHOKE", "STORM"];

function normalizeRain(rainMmH: number): number {
  if (rainMmH <= 0) return 0;
  if (rainMmH <= 2.5) return 0 + (rainMmH - 0) * (0.35 - 0) / (2.5 - 0);
  if (rainMmH <= 7.5) return 0.35 + (rainMmH - 2.5) * (0.65 - 0.35) / (7.5 - 2.5);
  if (rainMmH <= 15) return 0.65 + (rainMmH - 7.5) * (0.85 - 0.65) / (15 - 7.5);
  if (rainMmH <= 30) return 0.85 + (rainMmH - 15) * (1.0 - 0.85) / (30 - 15);
  return 1.0;
}

const evaluateNodes = (preset: Preset, liveMode: boolean, weatherData: Record<string, WeatherData>): EvaluatedNode[] => {
  return DELHI_NODES.map(node => {
    const state = getPresetState(preset, node.id);
    let rRate = state.rRate;
    
    if (liveMode && weatherData[node.id]) {
      rRate = normalizeRain(weatherData[node.id].rainMmH);
    }
    
    const fri = calculateFRI(state.vPooling, state.aImpedance, rRate);
    return { ...node, ...state, rRate, fri };
  });
};

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  preset: "CLEAR",
  isPlaying: false,
  liveMode: false,
  liveWeatherMode: false,
  rainMmH: 0,
  chokeMultiplier: 1.0,
  fieldReports: [],
  weatherData: {},
  nodes: evaluateNodes("CLEAR", false, {}),
  setPreset: (preset) => {
    const { liveMode, weatherData } = get();
    set({ preset, nodes: evaluateNodes(preset, liveMode, weatherData) });
  },
  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },
  tick: () => {
    const { preset, isPlaying, liveMode, weatherData } = get();
    if (!isPlaying) return;
    
    const currentIndex = PRESET_ORDER.indexOf(preset);
    if (currentIndex < PRESET_ORDER.length - 1) {
      const nextPreset = PRESET_ORDER[currentIndex + 1];
      set({ preset: nextPreset, nodes: evaluateNodes(nextPreset, liveMode, weatherData) });
    } else {
      set({ isPlaying: false });
    }
  },
  setLiveMode: (liveMode) => {
    const { preset, weatherData } = get();
    set({ liveMode, nodes: evaluateNodes(preset, liveMode, weatherData) });
  },
  setLiveWeatherMode: (liveWeatherMode) => set({ liveWeatherMode }),
  setRainMmH: (rainMmH) => set({ rainMmH }),
  setChokeMultiplier: (chokeMultiplier) => set({ chokeMultiplier }),
  addFieldReport: (report) => set((state) => ({ fieldReports: [report, ...state.fieldReports] })),
  updateWeatherData: (data) => {
    const { preset, liveMode } = get();
    const weatherData = data.reduce((acc, curr) => ({ ...acc, [curr.nodeId]: curr }), {} as Record<string, WeatherData>);
    set({ weatherData, nodes: evaluateNodes(preset, liveMode, weatherData) });
  }
}));
