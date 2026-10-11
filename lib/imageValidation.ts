export const SCREEN_CONFIDENCE_THRESHOLD = 80;
export const ROAD_PROTECT_THRESHOLD = 70;
export const INDOOR_CONFIDENCE_THRESHOLD = 80;
export const OUTDOOR_MIN_THRESHOLD = 60;
export const ROAD_SCENE_A_THRESHOLD = 60;
export const OUTDOOR_B_THRESHOLD = 80;
export const CONTEXT_B_THRESHOLD = 70;
export const FLOOD_C_THRESHOLD = 70;

export const SCREEN_LABELS: string[] = [
  'monitor',
  'screen',
  'lcd screen',
  'display',
  'television',
  'tv',
  'laptop',
  'computer',
  'pc',
  'tablet computer',
];

export const INDOOR_LABELS: string[] = [
  'indoors',
  'room',
  'bedroom',
  'living room',
  'kitchen',
  'office',
  'furniture',
  'wall',
  'ceiling',
  'floor',
];

export const ROAD_SCENE_LABELS_A: string[] = [
  'road',
  'street',
  'asphalt',
  'tarmac',
  'intersection',
  'highway',
  'freeway',
  'pavement',
  'sidewalk',
  'zebra crossing',
  'dirt road',
  'gravel',
  'path',
  'alleyway',
  'parking lot',
  'trail',
];

export const OUTDOOR_CONTEXT_LABELS_B: string[] = [
  'vehicle',
  'car',
  'motorcycle',
  'transportation',
  'wheel',
  'truck',
  'bus',
  'bicycle',
  'person',
  'building',
  'urban',
  'city',
  'soil',
  'mud',
  'puddle',
  'flood',
  'water',
  'ground',
];

export const FLOOD_LABELS_C: string[] = [
  'flood',
  'flash flood',
];

export const ROAD_PROTECT_LABELS: string[] = Array.from(new Set([
  ...ROAD_SCENE_LABELS_A,
  ...OUTDOOR_CONTEXT_LABELS_B,
  ...FLOOD_LABELS_C,
  'outdoors',
]));

export const ROAD_LABELS: string[] = ROAD_PROTECT_LABELS;

export interface ValidationLabel {
  Name?: string;
  name?: string;
  Confidence?: number;
  confidence?: number;
}

export interface RoadValidationResult {
  valid: boolean;
  reason: string;
  roadConfidence: number;
  screenConfidence: number;
}

export function validateRoadImage(labels: ValidationLabel[] = []): RoadValidationResult {
  const safeLabels = Array.isArray(labels) ? labels : [];

  let normalized = safeLabels.map(l => {
    const name = ((l.name ?? l.Name ?? '') as string).toLowerCase().trim();
    const conf = typeof l.confidence === 'number'
      ? l.confidence
      : typeof l.Confidence === 'number'
        ? l.Confidence
        : 0;
    return { name, confidence: conf };
  });

  const maxRaw = normalized.reduce((max, item) => Math.max(max, item.confidence), 0);
  if (maxRaw > 0 && maxRaw <= 1) {
    normalized = normalized.map(item => ({
      name: item.name,
      confidence: item.confidence * 100,
    }));
  }

  const screenSet = new Set(SCREEN_LABELS);
  const indoorSet = new Set(INDOOR_LABELS);
  const roadProtectSet = new Set(ROAD_PROTECT_LABELS);
  const roadSetA = new Set(ROAD_SCENE_LABELS_A);
  const contextSetB = new Set(OUTDOOR_CONTEXT_LABELS_B);
  const floodSetC = new Set(FLOOD_LABELS_C);

  let maxScreenConfidence = 0;
  let maxIndoorConfidence = 0;
  let outdoorsConfidence = 0;
  let maxRoadProtectConfidence = 0;

  for (const item of normalized) {
    if (screenSet.has(item.name)) {
      if (item.confidence > maxScreenConfidence) {
        maxScreenConfidence = item.confidence;
      }
    }
    if (indoorSet.has(item.name)) {
      if (item.confidence > maxIndoorConfidence) {
        maxIndoorConfidence = item.confidence;
      }
    }
    if (item.name === 'outdoors') {
      if (item.confidence > outdoorsConfidence) {
        outdoorsConfidence = item.confidence;
      }
    }
    if (roadProtectSet.has(item.name)) {
      if (item.confidence > maxRoadProtectConfidence) {
        maxRoadProtectConfidence = item.confidence;
      }
    }
  }

  // 1. Screen rejection: strong screen labels >= 80 AND no road label >= 70
  if (maxScreenConfidence >= SCREEN_CONFIDENCE_THRESHOLD && maxRoadProtectConfidence < ROAD_PROTECT_THRESHOLD) {
    return {
      valid: false,
      reason: 'This looks like a photo of a screen or device, not a real road. Point the camera at the actual street.',
      roadConfidence: Math.round(maxRoadProtectConfidence),
      screenConfidence: Math.round(maxScreenConfidence),
    };
  }

  // 2. Indoor rejection: indoor labels >= 80 AND outdoors < 60
  if (maxIndoorConfidence >= INDOOR_CONFIDENCE_THRESHOLD && outdoorsConfidence < OUTDOOR_MIN_THRESHOLD) {
    return {
      valid: false,
      reason: 'No road detected. Take a live photo of the road.',
      roadConfidence: Math.round(maxRoadProtectConfidence),
      screenConfidence: Math.round(maxScreenConfidence),
    };
  }

  // 3. ACCEPT as a road scene if ANY of:
  // a) road, street, asphalt, tarmac, etc >= 60
  // b) outdoors >= 80 AND context >= 70
  // c) flood or flash flood >= 70
  const qualifyingConfidences: number[] = [];

  for (const item of normalized) {
    if (roadSetA.has(item.name) && item.confidence >= ROAD_SCENE_A_THRESHOLD) {
      qualifyingConfidences.push(item.confidence);
    }
  }

  if (outdoorsConfidence >= OUTDOOR_B_THRESHOLD) {
    const matchingBConfidences: number[] = [];
    for (const item of normalized) {
      if (contextSetB.has(item.name) && item.confidence >= CONTEXT_B_THRESHOLD) {
        matchingBConfidences.push(item.confidence);
      }
    }
    if (matchingBConfidences.length > 0) {
      qualifyingConfidences.push(outdoorsConfidence, ...matchingBConfidences);
    }
  }

  for (const item of normalized) {
    if (floodSetC.has(item.name) && item.confidence >= FLOOD_C_THRESHOLD) {
      qualifyingConfidences.push(item.confidence);
    }
  }

  if (qualifyingConfidences.length > 0) {
    const highestValidConfidence = Math.max(...qualifyingConfidences);
    return {
      valid: true,
      reason: 'Outdoor road scene',
      roadConfidence: Math.round(highestValidConfidence),
      screenConfidence: Math.round(maxScreenConfidence),
    };
  }

  return {
    valid: false,
    reason: 'No road detected. Take a live photo of the road.',
    roadConfidence: Math.round(maxRoadProtectConfidence),
    screenConfidence: Math.round(maxScreenConfidence),
  };
}
