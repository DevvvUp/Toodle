

export interface NodeData {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  region: string;
  drainType: string;
  base_vPooling?: number;
  base_aImpedance?: number;
  fri?: number;
}

export const DELHI_NODES: NodeData[] = [
  { id: "node-1", name: "Connaught Place", lat: 28.6304, lng: 77.2177, region: "Central", drainType: "Primary Arterial" },
  { id: "node-2", name: "Minto Bridge", lat: 28.6325, lng: 77.2246, region: "Central", drainType: "Underpass" },
  { id: "node-3", name: "ITO", lat: 28.6276, lng: 77.2411, region: "East", drainType: "Surface Interceptor" },
  { id: "4", name: "DTU Main Gate Intersection", lat: 28.7499, lng: 77.1165, region: "North West", drainType: "Campus Main" },
  { id: "node-5", name: "Shahbad Daulatpur", lat: 28.7365, lng: 77.1105, region: "North West", drainType: "Secondary Grate" },
  { id: "node-6", name: "Rohini Sec-14", lat: 28.7158, lng: 77.1211, region: "North West", drainType: "Residential Network" },
  { id: "node-7", name: "Azadpur Mandi", lat: 28.7071, lng: 77.1772, region: "North", drainType: "Commercial Trench" },
  { id: "node-8", name: "Pul Prahladpur", lat: 28.4975, lng: 77.2917, region: "South East", drainType: "Underpass" },
  { id: "node-9", name: "Dhaula Kuan", lat: 28.5918, lng: 77.1614, region: "South West", drainType: "Highway Interceptor" },
  { id: "node-10", name: "Mukarba Chowk", lat: 28.7358, lng: 77.1471, region: "North", drainType: "Arterial Culvert" },
  { id: "node-11", name: "Anand Vihar", lat: 28.6469, lng: 77.3161, region: "East", drainType: "Transit Hub Main" },
  { id: "node-12", name: "Kashmere Gate", lat: 28.6675, lng: 77.2285, region: "North", drainType: "Heritage Zone Trunk" },
];

export type Preset = "CLEAR" | "RAIN" | "CHOKE" | "STORM";

export interface NodeState {
  vPooling: number;
  aImpedance: number;
  rRate: number;
  drainStatus: string;
  history: number[]; // 60-min history of FRI scores
}

const generateHistory = (base: number, volatility: number) => {
  return Array.from({ length: 60 }, () => Math.max(0, Math.min(1, base + (Math.random() - 0.5) * volatility)));
};

export const getPresetState = (preset: Preset, nodeId: string | number): NodeState => {
  const isTargetNode = String(nodeId) === "4"; // DTU Main Gate

  switch (preset) {
    case "CLEAR":
      return {
        vPooling: isTargetNode ? 0.05 : Math.random() * 0.1,
        aImpedance: isTargetNode ? 0.10 : Math.random() * 0.15,
        rRate: 0,
        drainStatus: "Unobstructed Flow (2.5-8 kHz)",
        history: generateHistory(0.1, 0.05),
      };
    case "RAIN":
      return {
        vPooling: isTargetNode ? 0.35 : Math.random() * 0.4,
        aImpedance: isTargetNode ? 0.40 : Math.random() * 0.3,
        rRate: 0.5,
        drainStatus: "Partial Siltation (1.2-3 kHz)",
        history: generateHistory(0.4, 0.1),
      };
    case "CHOKE":
      return {
        vPooling: isTargetNode ? 0.88 : Math.random() * 0.6,
        aImpedance: isTargetNode ? 0.85 : Math.random() * 0.5,
        rRate: 0.6,
        drainStatus: isTargetNode ? "Severe Choke (850Hz Gurgle)" : "Elevated Impedance",
        history: generateHistory(isTargetNode ? 0.85 : 0.6, 0.15),
      };
    case "STORM":
      return {
        vPooling: isTargetNode ? 0.95 : Math.random() * 0.8 + 0.2,
        aImpedance: isTargetNode ? 0.92 : Math.random() * 0.7 + 0.3,
        rRate: 1.0,
        drainStatus: isTargetNode ? "Total Submersion Failure (Silent)" : "Critical Impedance",
        history: generateHistory(isTargetNode ? 0.95 : 0.8, 0.1),
      };
  }
};
