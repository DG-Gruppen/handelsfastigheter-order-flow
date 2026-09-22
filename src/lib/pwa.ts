/** True when the PWA is running in an installed/standalone context. */
export function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** True for iPhone / iPad / iPod user agents. */
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** True for Samsung Internet on Android. */
export function isSamsungBrowser(): boolean {
  return /samsungbrowser/i.test(navigator.userAgent);
}
