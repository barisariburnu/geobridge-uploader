import { reportError } from '@/lib/monitoring.cjs'
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listUploadedFiles, deleteFileFromServer } from '@/lib/ssh';

export async function GET() {
  try {
    // Check authentication
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, message: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const files = await listUploadedFiles();
    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    reportError('OP_APP_API_FILES_ROUTE_TS_1', error);
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, message: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: 'Geçersiz istek' }, { status: 400 });
    }
    const { fileName } = body;

    if (!fileName) {
      return NextResponse.json(
        { success: false, message: 'Dosya adı gerekli' },
        { status: 400 }
      );
    }

    // Sanitize file name
    const sanitizedName = fileName.replace(/\.\./g, '').replace(/[<>:"|?*\x00-\x1f]/g, '');

    const result = await deleteFileFromServer(sanitizedName);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }

    reportError('SSH_DELETE_FAILURE')
    return NextResponse.json(
      { success: false, message: result.message },
      { status: 500 }
    );
  } catch (error) {
    reportError('OP_APP_API_FILES_ROUTE_TS_2', error);
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
