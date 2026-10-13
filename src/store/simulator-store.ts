import { create } from 'zustand';

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
  liveMode: boolean; // Renamed conceptually to mean "Live API Mode" vs demo data
  setLiveMode: (live: boolean) => void;
  liveWeatherMode: boolean; // NEW: Simulation vs Live weather
  setLiveWeatherMode: (live: boolean) => void;
  rainMmH: number;
  setRainMmH: (rain: number) => void;
  chokeMultiplier: number;
  setChokeMultiplier: (mult: number) => void;
  fieldReports: FieldReport[];
  addFieldReport: (report: FieldReport) => void;
}

export const useSimulatorStore = create<SimulatorState>((set) => ({
  liveMode: false,
  setLiveMode: (liveMode) => set({ liveMode }),
  liveWeatherMode: false,
  setLiveWeatherMode: (liveWeatherMode) => set({ liveWeatherMode }),
  rainMmH: 0,
  setRainMmH: (rainMmH) => set({ rainMmH }),
  chokeMultiplier: 1.0,
  setChokeMultiplier: (chokeMultiplier) => set({ chokeMultiplier }),
  fieldReports: [],
  addFieldReport: (report) => set((state) => ({ fieldReports: [report, ...state.fieldReports] })),
}));
