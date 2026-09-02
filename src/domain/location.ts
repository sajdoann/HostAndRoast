/**
 * Where a dinner happens: a maps link plus directions in words.
 *
 * The link is pasted by a guest-facing user and rendered as an `href`, so it
 * is only ever trusted after `safeLocationUrl` has vetted the scheme — a
 * `javascript:` or `data:` URL in an anchor runs as soon as someone taps it.
 */

/** Schemes we will put in an href. Anything else is not a place you can go. */
const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * Normalize a pasted location link, or undefined if it isn't one we'll link
 * to. A bare "maps.app.goo.gl/xyz" is assumed to be https.
 */
export function safeLocationUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return undefined;
    if (!url.hostname) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** True once a dinner has somewhere to go, in a link or in words. */
export function hasLocation(event: {
  locationUrl?: string;
  locationNote?: string;
}): boolean {
  return !!safeLocationUrl(event.locationUrl) || !!event.locationNote?.trim();
}
