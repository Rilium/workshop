import type { BrandPresentation } from "../googleDriveService";

export function extractGoogleFileId(url = "") {
  return (
    url.match(/\/(?:presentation|file)\/d\/([^/?#]+)/)?.[1] ||
    url.match(/[?&]id=([^&#]+)/)?.[1] ||
    ""
  );
}

export function getDeckOpenUrl(deck: BrandPresentation) {
  const id = deck.id || extractGoogleFileId(deck.url) || extractGoogleFileId(deck.previewUrl);
  const isNativeSlides = deck.mimeType === "application/vnd.google-apps.presentation";
  if (isNativeSlides && id) return `https://docs.google.com/presentation/d/${id}/edit`;
  if (deck.url) return deck.url;
  if (id) return `https://drive.google.com/file/d/${id}/view`;
  return deck.previewUrl || "";
}

export function getDeckPreviewUrl(deck: BrandPresentation) {
  const id = deck.id || extractGoogleFileId(deck.previewUrl) || extractGoogleFileId(deck.url);
  const isNativeSlides = deck.mimeType === "application/vnd.google-apps.presentation";
  if (!isNativeSlides && deck.previewUrl?.includes("drive.google.com/file")) return deck.previewUrl;
  if (isNativeSlides && id) return `https://docs.google.com/presentation/d/${id}/preview`;
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return deck.previewUrl || "";
}
