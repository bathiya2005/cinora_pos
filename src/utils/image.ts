/**
 * [FIX: ayu-logo-not-printing / large-logo-upload] Logo uploads were read
 * straight into a base64 data URL with FileReader and stored as-is, with no
 * size limit. A phone camera photo used as a "logo" can easily be several MB
 * — that:
 *   1) makes the browser's image decode take noticeably longer, which could
 *      lose the race against window.print() on a receipt-print click and
 *      print with a blank logo area, especially on slower POS terminals, and
 *   2) gets duplicated in full into every single bill created afterwards
 *      (bills snapshot their branding at billing time), which can bloat
 *      storage fast since Alona POS keeps its whole dataset in one document.
 *
 * This resizes/re-compresses any uploaded image client-side, before it ever
 * becomes a data URL, so what actually gets stored is small and decodes
 * quickly — a few tens of KB instead of several MB — regardless of what the
 * user uploads. Purely a client-side convenience: it doesn't touch or
 * migrate any logo that's already saved.
 */
export function resizeImageFile(file: File, maxDimension = 480, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback: canvas unsupported for some reason — use the original.
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // PNG/GIF (often logos with transparency) keep transparency via
        // PNG re-encode; everything else compresses as JPEG for size.
        const keepsAlpha = file.type === 'image/png' || file.type === 'image/gif';
        const dataUrl = keepsAlpha
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
