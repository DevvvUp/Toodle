# Toodle Mobile App

This is a React Native + Expo mobile application that interfaces directly with the deployed server. 

## Requirements
- Node.js (v18+)
- Expo Go app on your physical device (or Android Emulator)

## Setup
1. Duplicate `.env.example` to `.env` and ensure `EXPO_PUBLIC_API_BASE_URL` points to your deployed website (e.g. `https://main.d8ovyga5ca3ks.amplifyapp.com`).
2. Run `npm install`
3. Run `npx expo start` to launch the Expo bundler.
4. Scan the QR code using the **Expo Go** app on your phone, or press `a` to run it in the Android Emulator.

## Architecture
**SECURITY NOTE**: The application never stores, bundles, or prints AWS credentials. All visual perception analysis (Amazon Rekognition), notifications (Amazon SNS), and data syncing (Amazon DynamoDB) are securely routed through the main website's `/api` layer.

## New Features & Sources
- **Live Weather**: Integrated via Open-Meteo API.
- **RainViewer Radar Overlay**: Tiles fetched via RainViewer API.
- **Geotagged Field Reports**: Camera-only captures ensuring high-accuracy GPS tags using `expo-location`. 
- **Map Sources & Attributions**: 
  - Standard street map provided by OpenStreetMap (© OpenStreetMap contributors).
  - Satellite imagery provided by Esri (Tiles © Esri).
- **Permissions**: Requires Foreground Location (for geotagging) and Camera (for capturing field reports). 

## Building the APK
To build a standalone APK, ensure you are logged into EAS:
```bash
npx eas-cli login
npm run build:apk
```
This triggers an EAS build using the `preview` profile defined in `eas.json`.
