export type RiskLevel = "NORMAL" | "ADVISORY" | "WARNING" | "CRITICAL";

export interface FRIResult {
  score: number;
  level: RiskLevel;
  color: string;
  badgeColor: string;
  action: string;
}

export function calculateFRI(vPooling: number, aImpedance: number, rRate: number): FRIResult {
  const score = vPooling * 0.55 + aImpedance * 0.35 + rRate * 0.10;
  
  if (score <= 0.35) {
    return {
      score,
      level: "NORMAL",
      color: "text-green-500",
      badgeColor: "bg-green-500/10 text-green-500 border-green-500/20",
      action: "Monitor routine telemetry."
    };
  } else if (score <= 0.65) {
    return {
      score,
      level: "ADVISORY",
      color: "text-amber-500",
      badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      action: "Increase polling frequency. Dispatch municipal inspection if sustained."
    };
  } else if (score <= 0.85) {
    return {
      score,
      level: "WARNING",
      color: "text-orange-500",
      badgeColor: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      action: "Prepare maintenance crews. Alert local traffic authorities."
    };
  } else {
    return {
      score,
      level: "CRITICAL",
      color: "text-red-500",
      badgeColor: "bg-red-500/10 text-red-500 border-red-500/20",
      action: "Dispatch Hydro-Jet Truck to Clear Ingress Grate."
    };
  }
}
