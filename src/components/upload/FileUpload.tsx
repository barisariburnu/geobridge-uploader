'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  File, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileImage,
  FileArchive
} from 'lucide-react';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

const DEFAULT_ALLOWED_EXTENSIONS = [
  '.tif', '.tiff', '.geotiff',
  '.shp', '.shx', '.dbf', '.prj', '.cpg', '.qix',
  '.ecw', '.jp2', '.png', '.jpg', '.jpeg',
  '.geojson', '.json', '.gml', '.kml', '.kmz',
  '.zip'
];

const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 * 1024; // 50GB

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
  return <File className="h-5 w-5 text-slate-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>(DEFAULT_ALLOWED_EXTENSIONS);
  const [maxFileSizeBytes, setMaxFileSizeBytes] = useState<number>(DEFAULT_MAX_FILE_SIZE_BYTES);

  useEffect(() => {
    const loadUploadConfig = async () => {
      try {
        const response = await fetch('/api/upload');
        const data = await response.json();

        if (data?.success) {
          if (Array.isArray(data.allowedExtensions) && data.allowedExtensions.length > 0) {
            setAllowedExtensions(data.allowedExtensions);
          }

          if (typeof data.maxFileSizeBytes === 'number' && data.maxFileSizeBytes > 0) {
            setMaxFileSizeBytes(data.maxFileSizeBytes);
          }
        }
      } catch {
        // keep defaults
      }
    };

    void loadUploadConfig();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setMessage(null);
    const validFiles: File[] = [];

    for (const file of acceptedFiles) {
      const ext = getFileExtension(file.name);
      
      if (!allowedExtensions.includes(ext)) {
        setMessage({ 
          type: 'error', 
          text: `${file.name}: Unsupported file type`
        });
        continue;
      }

      if (file.size > maxFileSizeBytes) {
        setMessage({ 
          type: 'error', 
          text: `${file.name}: File is too large (max ${(maxFileSizeBytes / 1024 / 1024 / 1024).toFixed(2)}GB)`
        });
        continue;
      }

      validFiles.push(file);
    }

    setFiles(prev => [...prev, ...validFiles]);
  }, [allowedExtensions, maxFileSizeBytes]);

  const dropzoneAccept = {
    'application/octet-stream': allowedExtensions,
  } as const;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: dropzoneAccept,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setMessage(null);

    let successCount = 0;
    let errorCount = 0;
    let lastError = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          successCount++;
        } else {
          errorCount++;
          lastError = data.message;
        }
      } catch (err) {
        errorCount++;
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }

      setProgress(((i + 1) / files.length) * 100);
    }

    setUploading(false);

    if (errorCount === 0) {
      setMessage({ type: 'success', text: `${successCount} file(s) uploaded successfully` });
      setFiles([]);
      onUploadSuccess();
    } else if (successCount > 0) {
      setMessage({ 
        type: 'success', 
        text: `${successCount} file(s) uploaded, ${errorCount} failed: ${lastError}`
      });
      setFiles([]);
      onUploadSuccess();
    } else {
      setMessage({ type: 'error', text: `Upload failed: ${lastError}` });
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-emerald-500 bg-emerald-500/10' 
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/30'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragActive ? 'text-emerald-400' : 'text-slate-500'}`} />
        {isDragActive ? (
          <p className="text-emerald-400 font-medium">Drop files here...</p>
        ) : (
          <div>
            <p className="text-slate-300 font-medium mb-2">
              Drag and drop files here, or click to select
            </p>
            <p className="text-sm text-slate-500">
              Supported formats: {allowedExtensions.join(', ')}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Maximum file size: {(maxFileSizeBytes / 1024 / 1024 / 1024).toFixed(2)}GB
            </p>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <Alert className={message.type === 'success' 
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
          : 'bg-red-500/20 border-red-500/50 text-red-300'
        }>
          {message.type === 'success' 
            ? <CheckCircle2 className="h-4 w-4" />
            : <AlertCircle className="h-4 w-4" />
          }
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* File List */}
      {files.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(file.name)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="text-slate-400 hover:text-red-400 hover:bg-red-500/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2 bg-slate-700" />
          <p className="text-sm text-slate-400 text-center">
            Uploading... {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && !uploading && (
        <Button
          onClick={uploadFiles}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload {files.length} File(s)
        </Button>
      )}
    </div>
  );
}
