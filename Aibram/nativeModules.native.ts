/**
 * app/(tabs)/nativeModules.native.ts
 *
 * Metro (the Expo bundler) picks this file automatically on iOS/Android
 * because of the ".native.ts" suffix, and picks nativeModules.web.ts on web
 * instead — it never even looks inside the file it didn't pick. That's the
 * only way to keep react-native-purchases and react-native-google-mobile-ads
 * (both native-only, and both reference native internals web can't bundle)
 * out of the web build. Don't rename either file.
 */
import PurchasesDefault from 'react-native-purchases';
import {
  default as mobileAdsDefault,
  BannerAd as BannerAdImpl,
  BannerAdSize as BannerAdSizeImpl,
  TestIds as TestIdsImpl,
} from 'react-native-google-mobile-ads';

export const Purchases = PurchasesDefault;
export const mobileAds = mobileAdsDefault;
export const BannerAd = BannerAdImpl;
export const BannerAdSize = BannerAdSizeImpl;
export const TestIds = TestIdsImpl;