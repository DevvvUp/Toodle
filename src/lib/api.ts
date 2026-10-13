import { DELHI_NODES as mockNodes } from './mock-data';

export const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse(res: Response) {
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    let hostName = '';
    try {
      hostName = new URL(res.url).hostname;
    } catch (e) {}
    const bodyPreview = text.substring(0, 80).replace(/\n/g, ' ');
    const debugText = `\nStatus: ${res.status}\nHost: ${hostName}\nContent-Type: ${contentType || 'none'}\nBody: ${bodyPreview}`;
    throw new ApiError(res.status, 'Server returned HTML: the website API is not reachable.' + debugText);
  }

  if (!res.ok) {
    let msg = 'Unknown error';
    try {
      const errorData = await res.json();
      msg = errorData.error || msg;
      if (res.status === 429 && errorData.remainingSeconds) {
        msg = 'alert cooldown, ' + Math.ceil(errorData.remainingSeconds / 60) + ' minutes left';
      }
    } catch (e) {}

    if (res.status === 413) msg = 'image too large';
    else if (res.status === 502) msg = 'AWS permission problem';
    else if (res.status === 503) msg = 'server not configured for AWS';
    else if (res.status === 429 && !msg.includes('cooldown')) msg = 'alert cooldown';

    throw new ApiError(res.status, res.status + ': ' + msg);
  }

  return res;
}

export interface FloodNode {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  region: string;
  drainType: string;
  base_vPooling: number;
  base_aImpedance: number;
  fri?: number;
  distanceKm?: number;
  bearing?: string;
}

export function normalizeNodes(raw: any): FloodNode[] {
  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && Array.isArray(raw.nodes)) {
    list = raw.nodes;
  } else if (raw && Array.isArray(raw.data)) {
    list = raw.data;
  } else if (raw && Array.isArray(raw.items)) {
    list = raw.items;
  }

  if (!Array.isArray(list) || list.length === 0) {
    return mockNodes.map((m, index) => {
      const isTarget = m.id === '4' || m.id === 'node-4';
      return {
        id: String(m.id || `node-${index + 1}`),
        name: String(m.name || `Node ${m.id}`),
        lat: typeof m.lat === 'number' ? m.lat : Number(m.lat) || 28.6139,
        lng: typeof m.lng === 'number' ? m.lng : Number(m.lng) || 77.2090,
        region: String(m.region || 'Delhi NCR'),
        drainType: String(m.drainType || 'Secondary Grate'),
        base_vPooling: typeof m.base_vPooling === 'number' ? m.base_vPooling : (isTarget ? 0.70 : 0.25),
        base_aImpedance: typeof m.base_aImpedance === 'number' ? m.base_aImpedance : (isTarget ? 0.65 : 0.30),
        fri: typeof m.fri === 'number' ? m.fri : undefined,
      };
    });
  }

  return list.map((item: any, index: number) => {
    const id = String(item.id || item.PK?.replace(/^NODE#/, '') || `node-${index + 1}`);
    const isTarget = id === '4' || id === 'node-4';
    const base_vPooling = typeof item.base_vPooling === 'number'
      ? item.base_vPooling
      : typeof item.v_pooling === 'number'
        ? item.v_pooling
        : (isTarget ? 0.70 : 0.25);
    const base_aImpedance = typeof item.base_aImpedance === 'number'
      ? item.base_aImpedance
      : typeof item.a_impedance === 'number'
        ? item.a_impedance
        : (isTarget ? 0.65 : 0.30);

    return {
      id,
      name: String(item.name || `Node ${id}`),
      lat: typeof item.lat === 'number' ? item.lat : parseFloat(item.lat) || 28.6139,
      lng: typeof item.lng === 'number' ? item.lng : parseFloat(item.lng) || 77.2090,
      region: String(item.region || 'Delhi NCR'),
      drainType: String(item.drainType || 'Secondary Grate'),
      base_vPooling,
      base_aImpedance,
      fri: typeof item.fri === 'number' ? item.fri : undefined,
    };
  });
}

export async function fetchNodes(): Promise<{ data: FloodNode[]; source: string }> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(BASE_URL + '/api/nodes', { signal: controller.signal } as RequestInit);
    clearTimeout(id);
    
    await handleResponse(res.clone());
    const json = await res.json();
    const data = normalizeNodes(json);
    const dataSource = res.headers.get('x-data-source') === 'dynamodb' ? 'AWS connected' : 'Demo data';
    return { data, source: dataSource };
  } catch (err: any) {
    clearTimeout(id);
    console.warn("fetchNodes failed, using Demo data.", err.message);
    return { data: normalizeNodes(mockNodes), source: 'Demo data' };
  }
}

export async function fetchNodesStrict(): Promise<FloodNode[]> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(BASE_URL + '/api/nodes', { signal: controller.signal } as RequestInit);
    clearTimeout(id);
    await handleResponse(res.clone());
    const json = await res.json();
    return normalizeNodes(json);
  } catch (err: any) {
    clearTimeout(id);
    throw new ApiError(err.status || 0, err.message || 'Network error');
  }
}

export async function dispatchUnit(
  nodeId: number | string,
  nodeName: string,
  fri: number,
  action: string,
  metadata?: { roadVerified?: boolean; screenDetected?: boolean; drainStatus?: string; blockageDetected?: boolean }
) {
  try {
    const payload: Record<string, any> = {
      nodeId,
      nodeName,
      fri,
      action,
      drainStatus: metadata?.drainStatus || 'App Dispatch',
      ...(metadata?.blockageDetected ? { blockageDetected: true } : {})
    };
    if (metadata && typeof metadata.roadVerified === 'boolean') {
      payload.roadVerified = metadata.roadVerified;
    }
    if (metadata && typeof metadata.screenDetected === 'boolean') {
      payload.screenDetected = metadata.screenDetected;
    }
    const res = await fetch(BASE_URL + '/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await handleResponse(res.clone());
    return await res.json();
  } catch (err: any) {
    throw new ApiError(err.status || 0, err.message || 'Network error');
  }
}

export async function analyzeImage(base64: string) {
  try {
    const res = await fetch(BASE_URL + '/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    await handleResponse(res.clone());
    return await res.json();
  } catch (err: any) {
    throw new ApiError(err.status || 0, err.message || 'Analysis network error');
  }
}
export async function fetchHealth() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(BASE_URL + '/api/health', { signal: controller.signal } as RequestInit);
    clearTimeout(id);
    await handleResponse(res.clone());
    return await res.json();
  } catch (err: any) {
    clearTimeout(id);
    throw new ApiError(err.status || 0, err.message || 'Network error');
  }
}
