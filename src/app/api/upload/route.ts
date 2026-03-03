import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { uploadFileViaSSH } from '@/lib/ssh';
import { getUploadConfig } from '@/lib/upload-config';

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

export async function GET() {
  const config = getUploadConfig();

  return NextResponse.json({
    success: true,
    allowedExtensions: config.allowedExtensions,
    maxFileSizeBytes: config.maxFileSizeBytes,
    maxFileSizeGb: config.maxFileSizeGb,
  });
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

    const uploadConfig = getUploadConfig();

    // Validate file size
    if (file.size > uploadConfig.maxFileSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          message: `File is too large. Maximum allowed size is ${uploadConfig.maxFileSizeGb}GB.`,
        },
        { status: 400 }
      );
    }

    // Validate file extension
    const extension = getFileExtension(file.name);
    if (!uploadConfig.allowedExtensions.includes(extension)) {
      return NextResponse.json(
        {
          success: false,
          message: `Unsupported file type. Allowed extensions: ${uploadConfig.allowedExtensions.join(', ')}`,
        },
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, message: `Upload error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
