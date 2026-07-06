/**
 * Client-side high-efficiency image compressor.
 * Compresses raw high-resolution phone photos of fuel sheets/slips down to an optimized
 * JPEG format with a max boundary of 1000px, maintaining excellent legibility while
 * reducing file size from ~5MB-10MB to ~50KB-150KB.
 */
export function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const image = new Image();
      image.onload = () => {
        // Calculate new dimensions preserving aspect ratio
        let width = image.width;
        let height = image.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      image.onerror = (err) => {
        reject(new Error("Failed to load image for compression: " + String(err)));
      };
      image.src = readerEvent.target?.result as string;
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}
