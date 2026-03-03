'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  File, 
  FileImage, 
  FileArchive, 
  Trash2, 
  RefreshCw, 
  Loader2,
  FolderOpen,
  AlertCircle
} from 'lucide-react';

interface FileInfo {
  name: string;
  size: number;
  modifiedDate: string;
  isDirectory: boolean;
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot !== -1 ? fileName.substring(lastDot).toLowerCase() : '';
}

function getFileIcon(fileName: string) {
  const ext = getFileExtension(fileName);
  if (['.tif', '.tiff', '.geotiff', '.ecw', '.jp2', '.png', '.jpg', '.jpeg'].includes(ext)) {
    return <FileImage className="h-5 w-5 text-emerald-400" />;
  }
  if (['.zip', '.gz', '.tar'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-amber-400" />;
  }
  if (['.shp', '.shx', '.dbf', '.prj'].includes(ext)) {
    return <File className="h-5 w-5 text-blue-400" />;
  }
  return <File className="h-5 w-5 text-slate-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function FileList() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchFiles = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/files');
      const data = await response.json();

      if (data.success) {
        setFiles(data.files);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dosyalar yüklenemedi');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchFiles(false);
  }, []);

  const deleteFile = async (fileName: string) => {
    if (!confirm(`"${fileName}" dosyasını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setDeleting(fileName);

    try {
      const response = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });

      const data = await response.json();

      if (data.success) {
        setFiles(prev => prev.filter(f => f.name !== fileName));
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Silme hatası');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-400">Dosyalar yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-emerald-400" />
          Yüklenen Dosyalar ({files.length})
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchFiles}
          className="text-slate-400 hover:text-white hover:bg-slate-700"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="bg-red-500/20 border-red-500/50 text-red-300 mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {files.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Henüz dosya yüklenmedi</p>
            <p className="text-sm text-slate-600 mt-1">
              GeoTIFF veya Shapefile yükleyerek başlayın
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(file.name)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.size)} • {file.modifiedDate}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteFile(file.name)}
                  disabled={deleting === file.name}
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/20"
                >
                  {deleting === file.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
