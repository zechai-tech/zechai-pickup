'use client';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB hard reject
const MAX_DIMENSION_PX = 1000;
const WEBP_QUALITY = 0.8;

export interface CompressedImageResult {
  file: File;
  previewUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

/**
 * Compresses and resizes an admin-uploaded image in the browser before upload:
 * - Rejects files > 5 MB or non-image MIME types
 * - Resizes longest edge to max 1000px (never upscales)
 * - Encodes to WebP at quality 0.80 (strips EXIF metadata automatically)
 */
export async function compressAdminImage(rawFile: File): Promise<CompressedImageResult> {
  if (!rawFile.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP).');
  }

  if (rawFile.size > MAX_UPLOAD_BYTES) {
    const sizeMb = (rawFile.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Image is ${sizeMb} MB. Maximum allowed file size is 5 MB.`);
  }

  const bitmap = await loadBitmap(rawFile);
  const srcWidth = bitmap.width;
  const srcHeight = bitmap.height;

  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  if ('close' in bitmap && typeof bitmap.close === 'function') {
    bitmap.close();
  }

  const webpBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode WebP image.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      WEBP_QUALITY
    );
  });

  const baseName = rawFile.name.replace(/\.[^.]+$/, '') || 'menu-item';
  const cleanSlug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'menu-item';

  const compressedFile = new File([webpBlob], `${cleanSlug}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(compressedFile);

  return {
    file: compressedFile,
    previewUrl,
    originalBytes: rawFile.size,
    compressedBytes: compressedFile.size,
    width: targetWidth,
    height: targetHeight,
  };
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Could not decode selected image.'));
    };
    img.src = objUrl;
  });
}
