// Cloudinary delivery helpers.
//
// Our DB stores the original secure_url (full-resolution master). These helpers
// inject on-the-fly delivery transforms so shoppers get a small, sharp image
// instead of the heavy original:
//   f_auto  → AVIF/WebP when supported (smaller + higher quality than JPEG)
//   q_auto  → perceptual compression (visually lossless)
//   w_,c_limit → cap width to the display size; never upscales the original
//
// cldSrcSet() emits 1x/2x candidates so retina screens stay crisp.
// Both are safe no-ops for non-Cloudinary URLs or already-transformed URLs.

const UPLOAD_MARKER = "/image/upload/";

function withTransform(url: string, transform: string): string {
  const idx = url.indexOf(UPLOAD_MARKER);
  if (idx === -1) return url; // not a Cloudinary delivery URL
  const insertAt = idx + UPLOAD_MARKER.length;
  const rest = url.slice(insertAt);
  // Stored URLs always begin with a version segment ("v123456789/"). If the
  // first segment already looks like a transform, leave it untouched.
  if (!/^v\d+\//.test(rest) && /^[a-z]{1,3}_[^/]+/i.test(rest)) return url;
  return url.slice(0, insertAt) + transform + "/" + rest;
}

export function cldImg(
  url: string | null | undefined,
  width: number,
  quality = "auto"
): string {
  if (!url) return "";
  return withTransform(url, `f_auto,q_${quality},w_${width},c_limit`);
}

export function cldSrcSet(
  url: string | null | undefined,
  width: number,
  quality = "auto"
): string {
  if (!url) return "";
  return `${cldImg(url, width, quality)} 1x, ${cldImg(url, width * 2, quality)} 2x`;
}
