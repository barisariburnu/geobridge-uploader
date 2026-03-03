'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/upload/FileUpload';
import { FileList } from '@/components/upload/FileList';
import { LogOut, Upload, Server, RefreshCw } from 'lucide-react';

interface DashboardProps {
  username?: string;
  onLogout: () => void;
}

export function Dashboard({ username, onLogout }: DashboardProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <Server className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">GeoServer Dosya Yükleyici</h1>
                <p className="text-xs text-slate-400">SSH/SCP ile uzak sunucuya dosya yükleme</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                Hoş geldiniz, <span className="text-emerald-400 font-medium">{username}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="bg-slate-700/50 text-slate-300 hover:bg-red-500/20 hover:text-red-400 border border-transparent hover:border-red-500/50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Çıkış
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Upload Section */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-emerald-400" />
                Dosya Yükle
              </CardTitle>
              <CardDescription className="text-slate-400">
                GeoTIFF, Shapefile ve diğer GeoServer uyumlu dosyaları yükleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload onUploadSuccess={handleUploadSuccess} />
            </CardContent>
          </Card>

          {/* File List Section */}
          <div key={refreshKey}>
            <FileList />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 mt-8 md:grid-cols-3">
          <Card className="bg-slate-800/30 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Server className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">Hedef Sunucu</p>
                  <p className="text-xs text-slate-500">GeoServer Docker</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Upload className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">Aktarım Yöntemi</p>
                  <p className="text-xs text-slate-500">SSH/SCP ile güvenli yükleme</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <RefreshCw className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">Otomatik Güncelleme</p>
                  <p className="text-xs text-slate-500">Dosya listesi otomatik yenilenir</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
