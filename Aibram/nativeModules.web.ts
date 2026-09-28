/**
 * app/(tabs)/nativeModules.web.ts
 *
 * Web build of the native-modules bundle. Everything is null — index.tsx
 * already guards every call site with `if (IS_WEB || !Purchases) return`
 * (etc.), so purchases and ads are simply disabled when testing on web.
 */
export const Purchases: any = null;
export const mobileAds: any = null;
export const BannerAd: any = null;
export const BannerAdSize: any = null;
export const TestIds: any = null;