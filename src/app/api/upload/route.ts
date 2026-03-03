import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { uploadFileViaSSH } from '@/lib/ssh';

// Allowed file extensions for GeoServer
const ALLOWED_EXTENSIONS = [
  '.tif', '.tiff', '.geotiff',  // GeoTIFF
  '.shp', '.shx', '.dbf', '.prj', '.cpg', '.qix',  // Shapefile
  '.ecw', '.jp2', '.png', '.jpg', '.jpeg',  // Raster formats
  '.geojson', '.json', '.gml', '.kml', '.kmz',  // Vector formats
  '.zip',  // Archives (often used for shapefiles)
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB max file size

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot !== -1 ? fileName.substring(lastDot).toLowerCase() : '';
}

function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts and dangerous characters
  return fileName
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, message: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Dosya bulunamadı' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: `Dosya boyutu çok büyük. Maksimum ${MAX_FILE_SIZE / 1024 / 1024}MB olmalı.` },
        { status: 400 }
      );
    }

    // Validate file extension
    const extension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { success: false, message: `Desteklenmeyen dosya türü. İzin verilen uzantılar: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Sanitize file name
    const sanitizedName = sanitizeFileName(file.name);
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload via SSH
    const result = await uploadFileViaSSH(sanitizedName, buffer);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        fileName: sanitizedName,
        filePath: result.filePath,
        size: file.size,
      });
    }

    return NextResponse.json(
      { success: false, message: result.message },
      { status: 500 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    return NextResponse.json(
      { success: false, message: `Yükleme hatası: ${errorMessage}` },
      { status: 500 }
    );
  }
}
