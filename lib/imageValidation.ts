export const SCREEN_CONFIDENCE_THRESHOLD = 80;
export const ROAD_PROTECT_THRESHOLD = 70;
export const INDOOR_CONFIDENCE_THRESHOLD = 80;
export const OUTDOOR_MIN_THRESHOLD = 60;

export const ROAD_SCENE_A_THRESHOLD = 60;
export const OUTDOORS_B_THRESHOLD = 70;
export const CONTEXT_B_THRESHOLD = 60;
export const PRIMARY_C_THRESHOLD = 75;
export const CONTEXT_C_THRESHOLD = 40;
export const INDOOR_C_MAX_THRESHOLD = 60;

export const BLOCKAGE_THRESHOLD = 70;

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
  'bridge',
  'tunnel',
  'underpass',
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
  'rubble',
  'debris',
  'garbage',
  'trash',
  'litter',
  'waste',
  'rubbish',
  'plastic',
  'drain',
  'sewer',
  'gutter',
  'manhole',
  'culvert',
  'canal',
  'nature',
];

export const PRIMARY_BLOCKAGE_WATER_LABELS_C: string[] = [
  'garbage',
  'trash',
  'litter',
  'waste',
  'rubbish',
  'drain',
  'sewer',
  'gutter',
  'manhole',
  'culvert',
  'puddle',
  'flood',
  'flash flood',
  'water',
];

export const SECONDARY_CONTEXT_LABELS_C: string[] = Array.from(new Set([
  'outdoors',
  'ground',
  'soil',
  ...ROAD_SCENE_LABELS_A,
]));

export const BLOCKAGE_LABELS: string[] = [
  'garbage',
  'trash',
  'litter',
  'waste',
  'rubbish',
  'plastic',
  'drain',
  'sewer',
  'gutter',
  'manhole',
  'culvert',
  'debris',
  'rubble',
];

export const ROAD_PROTECT_LABELS: string[] = Array.from(new Set([
  ...ROAD_SCENE_LABELS_A,
  ...OUTDOOR_CONTEXT_LABELS_B,
  ...PRIMARY_BLOCKAGE_WATER_LABELS_C,
  'outdoors',
]));

// Keep ROAD_LABELS export for backwards compatibility
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
  blockageConfidence: number;
  blockageDetected: boolean;
}

export function validateRoadImage(labels: ValidationLabel[] = []): RoadValidationResult {
  const safeLabels = Array.isArray(labels) ? labels : [];

  let normalized = safeLabels.map(l => {
    const name = ((l.name ?? l.Name ?? '') + '').toLowerCase().trim();
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
  const primarySetC = new Set(PRIMARY_BLOCKAGE_WATER_LABELS_C);
  const secondarySetC = new Set(SECONDARY_CONTEXT_LABELS_C);
  const blockageSet = new Set(BLOCKAGE_LABELS);

  let maxScreenConfidence = 0;
  let maxIndoorConfidence = 0;
  let outdoorsConfidence = 0;
  let maxRoadProtectConfidence = 0;
  let maxBlockageConfidence = 0;

  for (const item of normalized) {
    if (screenSet.has(item.name) && item.confidence > maxScreenConfidence) {
      maxScreenConfidence = item.confidence;
    }
    if (indoorSet.has(item.name) && item.confidence > maxIndoorConfidence) {
      maxIndoorConfidence = item.confidence;
    }
    if (item.name === 'outdoors' && item.confidence > outdoorsConfidence) {
      outdoorsConfidence = item.confidence;
    }
    if (roadProtectSet.has(item.name) && item.confidence > maxRoadProtectConfidence) {
      maxRoadProtectConfidence = item.confidence;
    }
    if (blockageSet.has(item.name) && item.confidence > maxBlockageConfidence) {
      maxBlockageConfidence = item.confidence;
    }
  }

  // 1. Screen rejection: strong screen labels >= 80 AND no road/outdoor label >= 70
  if (maxScreenConfidence >= SCREEN_CONFIDENCE_THRESHOLD && maxRoadProtectConfidence < ROAD_PROTECT_THRESHOLD) {
    return {
      valid: false,
      reason: 'This looks like a photo of a screen or device, not a real road. Point the camera at the actual street.',
      roadConfidence: Math.round(maxRoadProtectConfidence),
      screenConfidence: Math.round(maxScreenConfidence),
      blockageConfidence: Math.round(maxBlockageConfidence),
      blockageDetected: false,
    };
  }

  // 2. Indoor rejection: indoor labels >= 80 AND outdoors < 60
  if (maxIndoorConfidence >= INDOOR_CONFIDENCE_THRESHOLD && outdoorsConfidence < OUTDOOR_MIN_THRESHOLD) {
    return {
      valid: false,
      reason: 'No road detected. Take a live photo of the road.',
      roadConfidence: Math.round(maxRoadProtectConfidence),
      screenConfidence: Math.round(maxScreenConfidence),
      blockageConfidence: Math.round(maxBlockageConfidence),
      blockageDetected: false,
    };
  }

  // 3. ACCEPT as valid outdoor scene if ANY of:
  // (a) road, street, asphalt, tarmac, etc >= 60
  // (b) outdoors >= 70 AND context >= 60
  // (c) garbage, drain, puddle, etc >= 75 together with (outdoors/ground/soil/road >= 40 OR without any indoor label >= 60)
  const qualifyingConfidences: number[] = [];

  // Check rule (a)
  for (const item of normalized) {
    if (roadSetA.has(item.name) && item.confidence >= ROAD_SCENE_A_THRESHOLD) {
      qualifyingConfidences.push(item.confidence);
    }
  }

  // Check rule (b)
  if (outdoorsConfidence >= OUTDOORS_B_THRESHOLD) {
    const matchingB = normalized.filter(item => contextSetB.has(item.name) && item.confidence >= CONTEXT_B_THRESHOLD);
    if (matchingB.length > 0) {
      qualifyingConfidences.push(outdoorsConfidence, ...matchingB.map(m => m.confidence));
    }
  }

  // Check rule (c)
  const matchingCPrimary = normalized.filter(item => primarySetC.has(item.name) && item.confidence >= PRIMARY_C_THRESHOLD);
  if (matchingCPrimary.length > 0) {
    const hasSecondaryContext = normalized.some(item => secondarySetC.has(item.name) && item.confidence >= CONTEXT_C_THRESHOLD);
    const hasNoIndoorConflict = maxIndoorConfidence < INDOOR_C_MAX_THRESHOLD;
    if (hasSecondaryContext || hasNoIndoorConflict) {
      qualifyingConfidences.push(...matchingCPrimary.map(m => m.confidence));
    }
  }

  if (qualifyingConfidences.length > 0) {
    const highestValid = Math.max(...qualifyingConfidences);
    const blockageDetected = maxBlockageConfidence >= BLOCKAGE_THRESHOLD;
    return {
      valid: true,
      reason: blockageDetected ? 'Outdoor scene (blockage detected)' : 'Outdoor road scene',
      roadConfidence: Math.round(highestValid),
      screenConfidence: Math.round(maxScreenConfidence),
      blockageConfidence: Math.round(maxBlockageConfidence),
      blockageDetected,
    };
  }

  return {
    valid: false,
    reason: 'No road detected. Take a live photo of the road.',
    roadConfidence: Math.round(maxRoadProtectConfidence),
    screenConfidence: Math.round(maxScreenConfidence),
    blockageConfidence: Math.round(maxBlockageConfidence),
    blockageDetected: false,
  };
}
