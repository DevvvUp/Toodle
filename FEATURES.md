# Toodle (FloodGuard AI) — Comprehensive System Specification & Feature Guide

> **Version:** 1.0.0  
> **Classification:** Production Urban Telemetry & Emergency Dispatch Platform  
> **Live Web Deployment:** [https://main.d8ovyga5ca3ks.amplifyapp.com](https://main.d8ovyga5ca3ks.amplifyapp.com)  
> **Android APK Build:** [Download v1.0.0 APK](https://expo.dev/artifacts/eas/QztcYs3Ddv6gBmXzEPBF2TFx_zAp-RYtk9gkvSVVUHA.apk)  
> **AWS Compute Role:** `FloodGuardAmplifyRole` (AWS Amplify Hosting Compute, `ap-south-1`)

---

## Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Dual-Platform Architecture](#2-dual-platform-architecture)
3. [The Flood Risk Index (FRI) Physics & Mathematics](#3-the-flood-risk-index-fri-physics--mathematics)
4. [Central Command Center](#4-central-command-center)
5. [Geospatial Mapping Engine](#5-geospatial-mapping-engine)
6. [Telemetry Deep-Dive (Node Inspection Sheet)](#6-telemetry-deep-dive-node-inspection-sheet)
7. [Emergency Dispatch & SMS Alerting System](#7-emergency-dispatch--sms-alerting-system)
8. [Field Scanner & Edge Vision AI (Demo Screen)](#8-field-scanner--edge-vision-ai-demo-screen)
9. [Diagnostics & System Health Architecture](#9-diagnostics--system-health-architecture)
10. [Design System & Responsive Ergonomics](#10-design-system--responsive-ergonomics)
11. [Monitoring Node Directory (Delhi NCR)](#11-monitoring-node-directory-delhi-ncr)
12. [Cloud Infrastructure & API Specifications](#12-cloud-infrastructure--api-specifications)
13. [Complete Features Matrix](#13-complete-features-matrix)

---

## 1. Executive Summary & Core Philosophy

**Toodle** (formerly *FloodGuard AI*) is an urban stormwater intelligence and autonomous emergency dispatch system engineered to eliminate urban flash flooding before surface water paralyses municipal traffic.

### The Problem It Solves
Traditional flood monitoring systems rely on **buoy floats, ultrasonic water-level sensors, or reactive citizen emergency calls**. By the time water levels reach traditional float sensors installed at road level, the drain is already 100% inundated, adjacent vehicles are submerged, and municipal response crews are blocked by traffic gridlock.

### The Toodle Paradigm: Zero New Hardware
Toodle replaces expensive physical sensor deployments by leveraging existing municipal infrastructure:
1. **Existing Municipal CCTV Cameras**: Ingested via streaming pipelines to measure surface pooling velocity ($V_{\text{pooling}}$) and vehicle wake water displacement using Computer Vision.
2. **Storm-Drain Acoustic Waveguides**: Acoustic sensing of drainage ingress grates to detect ultrasonic and acoustic frequency signatures ($A_{\text{impedance}}$), distinguishing between unobstructed torrents, gurgling silt choke, and silent total obstruction.
3. **Hyperlocal Weather Radar**: Real-time Doppler precipitation rate ($R_{\text{rate}}$) fed via Open-Meteo and RainViewer.
4. **Autonomous Emergency Dispatch**: Sub-3-second end-to-end latency from hazard detection to automated SMS dispatch of hydro-jet clearing crews before streets become impassable.

```
                    ┌───────────────────────────────┐
                    │  Existing Municipal CCTVs     │
                    │  & Traffic Camera Streams     │
                    └──────────────┬────────────────┘
                                   │
                                   ▼
┌───────────────────────┐   ┌───────────────┐   ┌────────────────────────┐
│  Acoustic Hydrophone  │──▶│  Toodle Cloud │◀──│  Doppler Radar &       │
│  Drain Resonator      │   │  Core Pipeline│   │  Open-Meteo Weather    │
└───────────────────────┘   └───────┬───────┘   └────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Multi-Modal Correlation:     │
                    │  FRI = 0.55*V + 0.35*A + 0.1*R│
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    ▼                              ▼
      ┌───────────────────────────┐  ┌───────────────────────────┐
      │  Municipal Command Center │  │  Hydro-Jet Crew Emergency │
      │  & Android Mobile App     │  │  SMS Broadcast (AWS SNS)  │
      └───────────────────────────┘  └───────────────────────────┘
```

---

## 2. Dual-Platform Architecture

Toodle provides **100% operational and visual parity** between its web management platform and native mobile client.

| Dimension | Web Application (`floodguard-ai`) | Mobile Android App (`floodguard-mobile`) |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 (App Router, Server-Side Rendering) | React Native 0.86 with Expo SDK 57 |
| **Styling** | Tailwind CSS + Lucide React + Framer Motion | NativeWind 4.2 + Lucide React Native + Reanimated 4 |
| **Deployment** | AWS Amplify Hosting Compute (SSR Node.js) | Standalone Android APK via EAS Build |
| **Hosting Region** | AWS `ap-south-1` (Mumbai) | Client-side Native Engine |
| **Mapping Engine** | React-Leaflet with dark inverted CartoDB tiles | React Native WebView Leaflet Bridge |
| **Camera Vision** | WebRTC `getUserMedia` with canvas extraction | `expo-camera` / `expo-image-picker` with high-accuracy GPS |
| **State Sync** | React Hooks, Server State & Optimistic UI | Zustand 5.0 State Store |
| **Telemetry Charts** | Recharts Responsive SVG Telemetry | `react-native-gifted-charts` & SVG Polyfills |

---

## 3. The Flood Risk Index (FRI) Physics & Mathematics

The **Flood Risk Index (FRI)** is a continuous, normalized metric between $0.00$ and $1.00$ representing the real-time probability of imminent street submersion.

### 3.1 Mathematical Derivation

$$\text{FRI} = 0.55 \cdot V_{\text{pooling}} + 0.35 \cdot A_{\text{impedance}} + 0.10 \cdot R_{\text{rate}}$$

Where:
- **$V_{\text{pooling}} \in [0.0, 1.0]$ (Visual Surface Pooling Ratio)**:  
  Computed using computer vision models (Amazon Rekognition label detection and semantic edge segmentation). Identifies surface specular reflections, standing water pools, and tire submersion ratios. Water detection confidence above 70% scales $V_{\text{pooling}}$ up to $0.85 - 0.95$.
- **$A_{\text{impedance}} \in [0.0, 1.0]$ (Acoustic Drain Impedance)**:  
  Derived from hydrophone audio spectrum analysis inside the drain catch-basin.
  - *Unobstructed flow* resonates at high velocity between **$2.5\text{ kHz} - 8.0\text{ kHz}$** ($A_{\text{impedance}} \le 0.15$).
  - *Partial siltation & plastic accumulation* generates turbulent low-frequency bubbling at **$1.2\text{ kHz} - 3.0\text{ kHz}$** ($A_{\text{impedance}} \approx 0.40$).
  - *Severe choke* shifts resonance to a choked gurgle at **$200\text{ Hz} - 900\text{ Hz}$** ($A_{\text{impedance}} \ge 0.85$).
  - *Total submersion failure* results in acoustic silence / complete damping ($A_{\text{impedance}} \ge 0.95$).
- **$R_{\text{rate}} \in [0.0, 1.0]$ (Normalized Rain Rate)**:  
  Sourced from Doppler radar and Open-Meteo precipitation metrics normalized against 100-year Delhi rainfall maximums ($50\text{ mm/hr} = 1.0$).

### 3.2 Threshold Tiers & Autonomous Actions

| Score Range | Risk Level | Badge Color | Hex Code | Automated Action Protocol |
| :---: | :---: | :---: | :---: | :--- |
| **$0.00 - 0.35$** | **NORMAL** | Green | `#22c55e` | Monitor routine telemetry; drain unobstructed. Polling cycle at 60s. |
| **$0.36 - 0.65$** | **ADVISORY** | Amber | `#eab308` | Increase polling frequency to 15s. Flag for municipal patrol if sustained >10 mins. |
| **$0.66 - 0.85$** | **WARNING** | Orange | `#f97316` | Pre-position regional hydro-jet trucks. Alert traffic police for lane diversion. |
| **$0.86 - 1.00$** | **CRITICAL** | Red | `#ef4444` | **Autonomous Dispatch Trigger**: Publish priority SMS payload to AWS SNS; log 15-min cooldown to DynamoDB. |

---

## 4. Central Command Center

The **Command Center** (`/command-center`) is the core operational dashboard for monitoring municipal drain networks.

```
+-----------------------------------------------------------------------------------+
|  [Toodle]  Command Center           [ SIMULATION / LIVE TOGGLE ]    (0) CRITICAL   |
+-----------------------------------------------------------------------------------+
| [Left Pane: 420px]                                  | [Right Pane: Sticky Map]   |
| 1. Rain Scenario Controller                         | - Custom Dark Map Tiles    |
|    [Clear] [Moderate] [Choke] [Storm]               | - Esri Satellite Overlay   |
|    [ > Play Storm Sequence (10s Auto-Tick) ]        | - RainViewer Radar Layer   |
|                                                     | - 12 Interactive Nodes     |
| 2. Priority Risk Queue (Dynamic Sorting)            | - Node Selection Sync      |
|    #1 DTU Main Gate ............ FRI: 0.95 (CRIT)   |                            |
|    #2 Minto Bridge ............. FRI: 0.88 (CRIT)   |                            |
|    #3 Connaught Place .......... FRI: 0.24 (NORM)   |                            |
|    ...                                              |                            |
+-----------------------------------------------------------------------------------+
```

### 4.1 Real-Time Simulation Engine & Weather Presets
Enables operators and municipal evaluators to simulate acute storm surges with instantaneous telemetry response:
- **CLEAR**: $V=0.05, A=0.10, R=0.00$. All 12 nodes report nominal flow.
- **MODERATE RAIN**: $V=0.35, A=0.40, R=0.50$. Elevated water flow, partial siltation alerts.
- **CHOKE**: $V=0.88, A=0.85, R=0.60$. Critical choke simulated at target node (**Node #4: DTU Main Gate**), causing FRI to cross into the Critical threshold ($0.87$).
- **STORM**: $V=0.95, A=0.92, R=1.00$. Catastrophic flash flood across Delhi NCR. Multiple arterial nodes (DTU, Minto Bridge, Pul Prahladpur) cross critical levels.

### 4.2 "Play Storm Sequence" (Auto-Tick Engine)
- A one-click automated demonstrator that plays out an evolving 4-stage tropical downpour over 10 seconds.
- Automatically transitions: `CLEAR` $\to$ `MODERATE` $\to$ `CHOKE` $\to$ `STORM`.
- Features animated pause/play controls, continuous FRI number tweening, and automatic queue re-sorting.

### 4.3 Framer Motion Priority Queue
- All 12 Delhi NCR monitoring nodes are continuously evaluated and ordered descending by FRI.
- Layout animations automatically slide higher-risk nodes to the top of the queue without jarring jumps.
- Displays node rank (`#1`, `#2`), full location name, arterial category, zone, and live animated FRI badge.

### 4.4 Full-Width Critical Hazard Banner
- Triggered dynamically whenever any node in the system crosses $\text{FRI} \ge 0.86$.
- Renders animated diagonal hazard warning stripes, lists the compromised node count and locations, and provides an immediate **"Review SMS Dispatch"** action button.

---

## 5. Geospatial Mapping Engine

Built on **Leaflet** with a custom high-contrast cartographic pipeline designed for low-latency emergency dispatch.

### 5.1 Sub-Pixel Seam Fix & Dark Inversion
- Inverted grayscale map tiles normally suffer from 1-pixel seam tears on fractional browser zoom levels and Retina screens.
- Toodle isolates the filter strictly to `.dark-map-tiles .leaflet-tile-pane` and applies GPU hardware acceleration:
  ```css
  .leaflet-tile {
    will-change: transform;
    backface-visibility: hidden;
    outline: 1px solid transparent;
  }
  ```
- Configures Leaflet with `keepBuffer={4}` and `updateWhenIdle={false}` for uninterrupted panning.

### 5.2 Dynamic Viewport Resolution (`ResizeObserver`)
- Prevents the classic Leaflet 0×0 pixel container race condition where the map centers on fallback coordinates (e.g., Jammu & Kashmir).
- Listens to container bounding rects via `ResizeObserver` and re-executes `map.invalidateSize()` and `map.fitBounds(delhiBounds)` with `[28, 28]` padding once dimensions resolve.

### 5.3 Satellite & Radar Precipitation Layers
- **Esri World Imagery**: 1-click toggle to high-resolution satellite imagery for inspecting canal geometry and urban topography.
- **RainViewer Live Radar**: Real-time Doppler precipitation overlay showing tropical storm cloud movements across northern India.

### 5.4 Node Markers & Geolocation
- Color-coded SVG pulse markers reflect node status (Green, Amber, Orange, Red).
- User Geolocation: Cyan pulsing beacon tracks the user’s live GPS coordinates via `navigator.geolocation` or native `expo-location`.

---

## 6. Telemetry Deep-Dive (Node Inspection Sheet)

Tapping or clicking any node on the map or in the priority queue triggers the **Node Inspection Sheet** (`components/node-sheet.tsx`).

```
+-------------------------------------------------------------+
| [X]  Node #4: DTU Main Gate Intersection                    |
|      Campus Main · North West             FRI: 0.95 CRITICAL|
+-------------------------------------------------------------+
| 60-MINUTE FRI TREND (Recharts Line Chart)                  |
| 1.0 |-------------------------------------- CRITICAL (0.86) |
| 0.8 |                  /-----\                              |
| 0.6 |-----------------/------- \----------- WARNING (0.66)  |
| 0.4 |----------------/----------\---------- ADVISORY (0.36) |
| 0.2 |_______________/            \______                    |
| 0.0 +------------------------------------------------------ |
|     -60m                  -30m                  Now         |
+-------------------------------------------------------------+
| MULTI-MODAL METRIC BREAKDOWN                                |
|  V_pooling:   [========================] 0.95 (High Puddle)  |
|  A_impedance: [======================  ] 0.92 (850Hz Gurgle)|
|  Rain Rate:   [========================] 1.00 (Storm Surge) |
+-------------------------------------------------------------+
| ACOUSTIC DRAIN HYDROPHONE SPECTRUM                          |
|  |||||||||||||||||||||||||||||||||||||| (Live Audio EQ)     |
|  Status: Total Submersion Failure (Silent Dead Choke)       |
+-------------------------------------------------------------+
| LOCAL WEATHER (Open-Meteo Live API)                         |
|  Temp: 28.4°C | Humidity: 92% | Wind: 14 km/h | Rain: 45mm/h|
|  Next 6-Hour Precipitation Probability: 95%                 |
+-------------------------------------------------------------+
| [ SEND EMERGENCY DISPATCH (SMS) ]                           |
+-------------------------------------------------------------+
```

### 6.1 60-Minute Historical Telemetry Chart
- Interactive **Recharts** line chart plotting 60 continuous 1-minute historical FRI telemetry points.
- Prominent threshold reference lines demarcating **Advisory (0.36)**, **Warning (0.66)**, and **Critical (0.86)**.

### 6.2 Component Metric Progress Gauges
- Explicit bar gauges decomposing the FRI into its constituent physical readings ($V_{\text{pooling}}$, $A_{\text{impedance}}$, $R_{\text{rate}}$).
- Contextual status text (e.g., *"Unobstructed Flow (2.5-8 kHz)"*, *"Partial Siltation (1.2-3 kHz)"*, *"Severe Choke (850Hz Gurgle)"*).

### 6.3 Animated Acoustic Waveform
- Simulated 16-band real-time equalizer displaying drain hydrophone frequencies.
- Illustrates transition from high-frequency white noise to low-frequency gurgle as drain impedance increases.

### 6.4 Hyperlocal Micro-Climate Feed
- Direct batch integration with **Open-Meteo API** (`/api/weather`).
- Displays ambient air temperature, relative humidity, wind velocity, hourly rain rate, and 6-hour precipitation forecast.

---

## 7. Emergency Dispatch & SMS Alerting System

The emergency dispatch subsystem triggers real-world municipal response teams via **AWS Simple Notification Service (SNS)**.

```
+---------------------------------------------------------------+
|                      SMS PREVIEW MODAL                        |
|                                                               |
|  To: Delhi Municipal Corporation Hydro-Jet Fleet              |
|  Topic: arn:aws:sns:ap-south-1:...:FloodGuardAlertTopic       |
|                                                               |
|  +---------------------------------------------------------+  |
|  | [CRITICAL ALERT - FLOODGUARD AI]                        |  |
|  | Node: #4 (DTU Main Gate Intersection)                   |  |
|  | Risk Score: 0.95 | Drain Status: Severe Choke (850Hz)   |  |
|  | Rec. Action: Dispatch Hydro-Jet Truck to Ingress Grate. |  |
|  +---------------------------------------------------------+  |
|                                                               |
|  [ Cancel ]                     [ CONFIRM & DISPATCH SMS ]    |
+---------------------------------------------------------------+
```

### 7.1 Dispatch Safety & Anti-Spam Gating
1. **FRI Threshold Gate**: Dispatches can only be generated if $\text{FRI} \ge 0.86$.
2. **Screen Anti-Spoofing Gate**: Rejected if the computer vision model detects that the user pointed the camera at a monitor or computer display (`screenDetected === true`).
3. **15-Minute DynamoDB Cooldown**:
   - Before firing an alert, the system queries DynamoDB with `PK: ALERT#{nodeId}, SK: COOLDOWN`.
   - If an active TTL exists, the API rejects the dispatch with **HTTP 429** and returns `remainingSeconds`.
   - Upon successful dispatch, DynamoDB records an atomic batch write:
     - `ALERT#{nodeId} | COOLDOWN` with `ttl = now + 900s`.
     - `ALERT#{nodeId} | STATUS#{timestamp}` recording SNS MessageId and FRI.

### 7.2 SNS Payload Structure
The SMS payload is formatted for immediate consumption by emergency vehicle drivers on cellular phones:
```text
[CRITICAL ALERT - FLOODGUARD AI]
Node: #4 (DTU Main Gate Intersection)
Risk Score: 0.95 | Drain Status: Total Submersion Failure (Silent)
Rec. Action: Dispatch Hydro-Jet Truck to Clear Ingress Grate.
```

---

## 8. Field Scanner & Edge Vision AI (Demo Screen)

The **Demo / Scanner Screen** (`/demo`) enables municipal inspectors and field crews to conduct real-time computer vision assessments using mobile device cameras.

```
+---------------------------------------------------------------+
|  FIELD SCANNER                          [ GPS: 28.7499, 77.1165 ]
+---------------------------------------------------------------+
|                                                               |
|    +-----------------------------------------------------+    |
|    | [HUD Reticle]                                       |    |
|    |                                                     |    |
|    |             +-------------------------+             |    |
|    |             | Water / Flood: 94.2%    |             |    |
|    |             +-------------------------+             |    |
|    |                                                     |    |
|    |   [ROAD VERIFIED: Road 88.4%, Asphalt 76.1%]        |    |
|    +-----------------------------------------------------+    |
|                                                               |
|   [ CAPTURE & ANALYZE ROADWAY ]                               |
+---------------------------------------------------------------+
| RESULTS:                                                      |
|   Road Verified: YES (True Outdoor Roadway)                   |
|   Water Pooling: 0.85 (Critical Surface Ponding)             |
|   Computed FRI:  0.87 (Critical Flood Risk)                   |
+---------------------------------------------------------------+
```

### 8.1 Live Camera Stream & High-Accuracy GPS
- Operates via WebRTC `getUserMedia` with `facingMode: "environment"` on web, and `expo-camera` on Android.
- Concurrently acquires device geolocation with 10-second timeout and high accuracy mode enabled.

### 8.2 Computer Vision Analysis Pipeline (Amazon Rekognition)
Captured frames are compressed to JPEG base64 and dispatched to `/api/analyze`. The server executes `DetectLabelsCommand` and applies specialized validation heuristics:
- **Water & Flood Classification**: Flags labels `Water`, `Flood`, `Puddle` with confidence $\ge 70\%$.
- **Outdoor Road Validation**: Requires primary road labels (`Road`, `Street`, `Asphalt`, `Tarmac`, `Highway`, `Intersection`) with confidence $\ge 60\%$, or flood context with urban elements $\ge 60\%$.
- **Anti-Spoofing Screen Detection**: Detects `Monitor`, `Screen`, `LCD Screen`, `Television`, `Laptop`, `Computer`. If screen confidence exceeds 80% without outdoor road features, `screenDetected` is flagged, blocking false alert dispatches.

---

## 9. Diagnostics & System Health Architecture

Accessible via `/settings`, the diagnostics screen performs end-to-end verification of cloud resources, credentials, and network connectivity.

### 9.1 AWS STS Compute Role Verification
Calls `/api/health` to inspect the IAM execution role of AWS Amplify Hosting Compute:
- **Assumed Role**: `arn:aws:sts::065241263488:assumed-role/FloodGuardAmplifyRole/...`
- **Region**: `ap-south-1` (Mumbai)
- **DynamoDB Table State**: Live probe against `FloodGuardState` returns `OK`.
- **SNS Topic State**: Live probe against `FloodGuardAlertTopic` returns `OK`.
- **Credential Source**: Validates `default-chain` STS assumed-role credentials with active `AWS_SESSION_TOKEN`.

### 9.2 API Endpoint Ping Harness
Runs parallel round-trip ping tests against:
- `/api/nodes`: Node state store read latency.
- `/api/weather`: Open-Meteo external gateway latency.
- `/api/analyze`: Rekognition inference pipeline readiness.

### 9.3 Test Alert Dispatch Trigger
Includes a protected simulation modal to test end-to-end SMS alerting without modifying production node state, validating SNS topic subscriber reachability.

---

## 10. Design System & Responsive Ergonomics

Toodle adheres to a strict high-contrast dark aesthetic engineered for harsh sunlight and rainy night conditions.

### 10.1 Color Palette & Semantic Tokens
- **Background Obsidian**: `#090909` (true dark for OLED battery savings and glare reduction).
- **Brand Primary Teal**: `#06353a` (matches official Toodle swirl logo).
- **Cyber Accent Cyan**: `#0099ff` / `#0ea5e9` (telemetry highlights and active tabs).
- **Status Normal**: `#22c55e` (Emerald Green).
- **Status Advisory**: `#eab308` (Amber Gold).
- **Status Warning**: `#f97316` (Emergency Orange).
- **Status Critical**: `#ef4444` (Hazard Red).
- **Borders & Dividers**: `#262626` / `#1c1c1c`.

### 10.2 Typography
- **UI & Prose**: `Inter` (variable font, weights 400, 500, 600, 700).
- **Telemetry & Numerics**: `Fira Code` (monospace font for tabular coordinates, latency timers, and FRI scores).

### 10.3 Responsive Layout Engine
- **Mobile Phones ($\le 640$px)**: 1-column sequential stack with fixed 64px bottom tab bar.
- **Landscape Phones ($\text{height} \le 500$px)**: Compact 48px bottom bar with hidden text labels; map height clamped to 40dvh.
- **Tablets ($641\text{px} - 1023\text{px}$)**: Centered 640px column with responsive touch targets (minimum 44px on coarse pointers).
- **Desktop ($\ge 1024$px)**: 72px left icon rail; Command Center expands to a 2-column layout (`grid-cols-[420px_1fr]`):
  - Left pane: Controls, presets, and priority queue.
  - Right pane: Full-height sticky interactive map.

---

## 11. Monitoring Node Directory (Delhi NCR)

Toodle monitors 12 strategic flood-prone arterial intersections across the National Capital Region (Delhi NCR):

| ID | Name | Coordinates | Region | Drainage Classification | Typical Vulnerability |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **node-1** | Connaught Place | $28.6304, 77.2177$ | Central | Primary Arterial | Radial market drainage backflow |
| **node-2** | Minto Bridge | $28.6325, 77.2246$ | Central | Underpass | Railway underbridge depression flooding |
| **node-3** | ITO | $28.6276, 77.2411$ | East | Surface Interceptor | Yamuna flood basin runoff |
| **4** | **DTU Main Gate** | $28.7499, 77.1165$ | North West | Campus Main | High-debris campus & transit junction |
| **node-5** | Shahbad Daulatpur | $28.7365, 77.1105$ | North West | Secondary Grate | Silt sedimentation from unpaved shoulders |
| **node-6** | Rohini Sec-14 | $28.7158, 77.1211$ | North West | Residential Network | High-density housing runoff |
| **node-7** | Azadpur Mandi | $28.7071, 77.1772$ | North | Commercial Trench | Organic vegetable waste grating blockage |
| **node-8** | Pul Prahladpur | $28.4975, 77.2917$ | South East | Underpass | Arterial underpass bowl accumulation |
| **node-9** | Dhaula Kuan | $28.5918, 77.1614$ | South West | Highway Interceptor | High-velocity grade interchange runoff |
| **node-10**| Mukarba Chowk | $28.7358, 77.1471$ | North | Arterial Culvert | National highway interchange culvert silt |
| **node-11**| Anand Vihar | $28.6469, 77.3161$ | East | Transit Hub Main | Bus terminal and rail yard convergence |
| **node-12**| Kashmere Gate | $28.6675, 77.2285$ | North | Heritage Zone Trunk | Low-elevation historical ring road |

---

## 12. Cloud Infrastructure & API Specifications

All endpoints are hosted on **AWS Amplify Hosting Compute** under Node.js runtime and are fully dynamic (`force-dynamic`).

### 12.1 `GET /api/health`
Probes AWS STS credentials, DynamoDB, and SNS topic access.
- **Response**:
  ```json
  {
    "generatedAt": "2026-10-11T18:10:41.540Z",
    "requestId": "bc53ce02-4a2b-40e9-ba6a-151fff033ebb",
    "region": "ap-south-1",
    "identity": {
      "account": "065241263488",
      "arn": "arn:aws:sts::065241263488:assumed-role/FloodGuardAmplifyRole/AmplifyHostingCompute-app=d8ovyga5ca3ks"
    },
    "resolved": {
      "ddbTable": "\"FloodGuardState\"",
      "snsTopicArn": "\"arn:aws:sns:ap-south-1:065241263488:FloodGuardAlertTopic\"",
      "region": "\"ap-south-1\""
    },
    "liveChecks": {
      "dynamoDb": "OK",
      "sns": "OK"
    }
  }
  ```

### 12.2 `GET /api/nodes` & `POST /api/nodes`
- **GET**: Scans DynamoDB `FloodGuardState` for items with `SK = "METADATA"`. Returns array of node states.
- **POST**: Appends a new reading to `PK: NODE#{id}, SK: READING#{timestamp}` with 30-day DynamoDB TTL.

### 12.3 `POST /api/analyze`
- **Input**: `{ "imageBase64": "<base64>" }`
- **Process**: Amazon Rekognition `DetectLabelsCommand`. Validates outdoor roadway and computes $V_{\text{pooling}}$.
- **Response**:
  ```json
  {
    "success": true,
    "labels": [ ... ],
    "v_pooling": 0.85,
    "flood_detected": true,
    "roadVerified": true,
    "screenDetected": false
  }
  ```

### 12.4 `POST /api/dispatch`
- **Input**:
  ```json
  {
    "nodeId": "4",
    "nodeName": "DTU Main Gate Intersection",
    "fri": 0.95,
    "drainStatus": "Severe Choke (850Hz Gurgle)",
    "action": "Dispatch Hydro-Jet Truck to Clear Ingress Grate.",
    "screenDetected": false
  }
  ```
- **Validation**: Enforces $\text{FRI} \ge 0.86$, `screenDetected === false`, and checks 15-minute cooldown.
- **Success Response (HTTP 200)**: `{ "success": true, "messageId": "9b1c7a82-..." }`
- **Cooldown Active (HTTP 429)**: `{ "success": false, "error": "Cooldown active", "remainingSeconds": 742 }`

### 12.5 `GET /api/weather`
- Fetches real-time weather and 6-hour precipitation forecasts for all 12 Delhi NCR coordinates in a single batch request to Open-Meteo.
- Returns temperature, relative humidity, wind velocity, hourly rain rate, and maximum 6-hour precipitation probability per node.

---

## 13. Complete Features Matrix

| Feature Area | Specific Capability | Web Implementation | Mobile Implementation |
| :--- | :--- | :---: | :---: |
| **Telemetry & FRI** | Physics-informed $0.55V + 0.35A + 0.10R$ | Yes | Yes |
| | 4-tier risk classification & color badges | Yes | Yes |
| | Real-time animated number tweening | Yes | Yes |
| **Command Center** | 4-preset rain scenario controller | Yes | Yes |
| | 10s auto-ticking "Play Storm Sequence" | Yes | Yes |
| | Dynamic layout-animated priority queue | Yes (Framer Motion) | Yes (Reanimated) |
| | Full-width critical hazard banner | Yes | Yes |
| **Mapping** | Dark inverted tiles with zero seam artifacts | Yes | Yes |
| | Container auto-sizing (`ResizeObserver`) | Yes | Yes |
| | Esri satellite basemap toggle | Yes | Yes |
| | RainViewer live radar precipitation layer | Yes | Yes |
| | Pulsing status markers & click-to-inspect | Yes | Yes |
| | Geolocation tracking dot | Yes | Yes |
| **Deep-Dive Sheet** | 60-minute FRI trend line chart | Yes (Recharts) | Yes (Gifted Charts) |
| | Component metric gauges ($V, A, R$) | Yes | Yes |
| | Animated 16-band acoustic equalizer | Yes | Yes |
| | Local Open-Meteo micro-climate telemetry | Yes | Yes |
| **Emergency Alerting**| SMS preview modal with exact alert copy | Yes | Yes |
| | AWS SNS direct broadcast to municipal fleet | Yes | Yes (via API) |
| | DynamoDB 15-minute anti-spam cooldown | Yes | Yes |
| | Rate-limit (429) remaining timer countdown | Yes | Yes |
| **Field Scanner** | Live device camera viewfinder | Yes (`getUserMedia`) | Yes (`expo-camera`) |
| | High-accuracy GPS with 10s timeout | Yes | Yes (`expo-location`) |
| | AWS Rekognition outdoor road validation | Yes | Yes |
| | Anti-spoofing screen detection | Yes | Yes |
| **Diagnostics** | STS assumed-role health probe | Yes | Yes |
| | Real-time endpoint latency ping tests | Yes | Yes |
| | Safe test SMS dispatch modal | Yes | Yes |
| **Responsiveness** | Mobile, tablet, desktop 2-pane & landscape | Yes | Native Responsive |
