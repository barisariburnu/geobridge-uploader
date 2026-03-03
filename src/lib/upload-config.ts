const DEFAULT_ALLOWED_EXTENSIONS = [
  '.tif',
  '.tiff',
  '.geotiff',
  '.shp',
  '.shx',
  '.dbf',
  '.prj',
  '.cpg',
  '.qix',
  '.ecw',
  '.jp2',
  '.png',
  '.jpg',
  '.jpeg',
  '.geojson',
  '.json',
  '.gml',
  '.kml',
  '.kmz',
  '.zip',
];

const DEFAULT_MAX_FILE_SIZE_GB = 50;

function normalizeExtension(ext: string): string | null {
  const cleaned = ext.trim().toLowerCase();
  if (!cleaned) return null;
  if (cleaned === '.') return null;
  return cleaned.startsWith('.') ? cleaned : `.${cleaned}`;
}

export function getAllowedExtensions(): string[] {
  const raw = process.env.UPLOAD_ALLOWED_EXTENSIONS;
  if (!raw) return DEFAULT_ALLOWED_EXTENSIONS;

  const parsed = raw
    .split(',')
    .map((item) => normalizeExtension(item))
    .filter((item): item is string => Boolean(item));

  if (parsed.length === 0) return DEFAULT_ALLOWED_EXTENSIONS;

  return Array.from(new Set(parsed));
}

export function getMaxFileSizeBytes(): number {
  const rawGb = process.env.UPLOAD_MAX_FILE_SIZE_GB;
  if (!rawGb) return DEFAULT_MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;

  const parsedGb = Number(rawGb);
  if (!Number.isFinite(parsedGb) || parsedGb <= 0) {
    return DEFAULT_MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;
  }

  return Math.floor(parsedGb * 1024 * 1024 * 1024);
}

export function getUploadConfig() {
  const allowedExtensions = getAllowedExtensions();
  const maxFileSizeBytes = getMaxFileSizeBytes();

  return {
    allowedExtensions,
    maxFileSizeBytes,
    maxFileSizeGb: Number((maxFileSizeBytes / 1024 / 1024 / 1024).toFixed(2)),
  };
}
