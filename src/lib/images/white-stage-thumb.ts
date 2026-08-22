/** Composite a 3D capture onto a white square and lift near-black stage pixels. */
export function flattenCaptureToWhite(
  img: HTMLImageElement,
  size = 160,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / Math.max(1, img.width), size / Math.max(1, img.height));
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 28 && g < 28 && b < 28) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.84);
}

export function flattenCaptureUrlToWhite(src: string, size = 160): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(flattenCaptureToWhite(img, size));
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
