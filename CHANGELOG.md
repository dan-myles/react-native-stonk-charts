# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.3] - 2025-10-06

### Changed

This is the initial release of `react-native-stonk-charts`, a fork of [`react-native-wagmi-charts`](https://github.com/coinjar/react-native-wagmi-charts) v2.7.3.

#### Major Updates

- **React Native Reanimated v4 Support**: Upgraded from Reanimated v2 (3.17.4) to v4 (4.1.2)
  - Migrated from `react-native-reanimated/plugin` to `react-native-worklets/plugin` in Babel config
  - Updated `Animated.addWhitelistedNativeProps` to `Animated.addWhitelistedUIProps`
  - Added `react-native-worklets` ^0.6.0 as a peer dependency

- **React Native Gesture Handler v2 Support**: Upgraded from ~2.24.0 to 2.28.0
  - Already using modern Gesture API, no breaking changes needed

- **Web Support Removed**: 
  - Removed all web-specific code and dependencies (react-dom, react-native-web, vite)
  - Deleted web-specific components and configurations
  - Focused exclusively on iOS and Android for better performance

- **React 19 Compatibility**: 
  - Fixed `usePrevious` hook to work with React 19's stricter `useRef` requirements
  - Updated `@types/react` to v19 for proper type support

#### Removed

- Web platform support (React Native Web, Vite)
- `react-native-haptic-feedback` peer dependency (examples use `expo-haptics` instead)
- Web-specific components:
  - `LineChart.HoverTrap` component removed
  - `src/charts/line/HoverTrap/index.web.tsx` deleted

#### Fixed

- TypeScript compatibility with React 19 and Reanimated v4
- Missing `orientation` prop type in `LineChart.Cursor`
- React type inconsistencies with pnpm overrides

#### Documentation

- Completely rewritten README with:
  - Clear indication this is a fork of wagmi-charts
  - Updated installation instructions for all package managers
  - Migration guide from wagmi-charts
  - Removed web-specific documentation
  - Enhanced credits and acknowledgments

#### Technical Details

- Package renamed from `react-native-wagmi-charts` to `react-native-stonk-charts`
- Podspec renamed to `react-native-stonk-charts.podspec`
- All example app code updated to use new package name
- Build system unchanged (react-native-builder-bob)

### Credits

This fork is based on the excellent work by the team at [CoinJar](https://github.com/coinjar) on `react-native-wagmi-charts`. 

Original library credits:
- [Rainbow's Animated Charts](https://github.com/rainbow-me/react-native-animated-charts)
- [@wcandillon](https://github.com/wcandillon) and his [Can It Be Done In React Native](https://www.youtube.com/wcandillon) series

[2.7.3]: https://github.com/dan-myles/react-native-stonk-charts/releases/tag/v2.7.3
