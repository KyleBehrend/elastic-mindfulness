// ── Canvas capture store ──────────────────────────────────────────────
// Holds the last captured canvas data URL so ShareOverlay can access it
// after ElasticCanvas unmounts during the phase transition.
let lastCaptureUrl: string | null = null;

export function setLastCapture(dataUrl: string) {
  lastCaptureUrl = dataUrl;
}

export function getLastCapture(): string | null {
  return lastCaptureUrl;
}

// ── Export canvas as PNG blob ─────────────────────────────────────────
// Requires preserveDrawingBuffer: true on the WebGL context.
export async function exportCanvas(
  canvasElement: HTMLCanvasElement
): Promise<Blob> {
  const dataUrl = canvasElement.toDataURL("image/png");
  setLastCapture(dataUrl);

  const response = await fetch(dataUrl);
  return response.blob();
}

// ── Export with branding (1200×630 OG-sized) ──────────────────────────
export async function exportCanvasWithBranding(blob: Blob): Promise<Blob> {
  const OG_WIDTH = 1200;
  const OG_HEIGHT = 630;

  const img = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = OG_WIDTH;
  canvas.height = OG_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Fill black background first
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  // Center-crop the source image to fill OG dimensions
  const srcAspect = img.width / img.height;
  const dstAspect = OG_WIDTH / OG_HEIGHT;

  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (srcAspect > dstAspect) {
    sw = img.height * dstAspect;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dstAspect;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OG_WIDTH, OG_HEIGHT);

  // Dark vignette around edges
  const vignette = ctx.createRadialGradient(
    OG_WIDTH / 2,
    OG_HEIGHT / 2,
    OG_WIDTH * 0.25,
    OG_WIDTH / 2,
    OG_HEIGHT / 2,
    OG_WIDTH * 0.7
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  // Branding text — small, subtle, bottom-right
  ctx.font = '14px "DM Sans", sans-serif';
  ctx.fillStyle = "rgba(245, 240, 235, 0.5)";
  ctx.textAlign = "right";
  ctx.fillText("elasticmindfulness.com", OG_WIDTH - 24, OG_HEIGHT - 20);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/png");
  });
}
