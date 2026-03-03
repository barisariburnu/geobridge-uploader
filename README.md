# GeoServer File Uploader

GeoServer Docker sunucusundaki hedef klasöre web arayüzü üzerinden dosya yüklemek için geliştirilmiş Next.js uygulaması.

## Özellikler

- Web tabanlı giriş (kullanıcı adı/şifre)
- Session tabanlı yetkilendirme ([`iron-session`](package.json:60))
- Sürükle-bırak ile çoklu dosya yükleme
- Sunucu tarafında dosya uzantısı ve boyut doğrulama
- SSH/SFTP ile hedef dizine **doğrudan** yükleme
- Yüklenen dosyaları listeleme ve silme
- `.env` üzerinden tüm bağlantı/yetki ayarları

## Mimari (Güncel)

1. Kullanıcı web arayüzüne giriş yapar.
2. Dosya [`/api/upload`](src/app/api/upload/route.ts) endpoint’ine gönderilir.
3. Sunucu, SSH ile bağlanır. Önce dosyayı doğrudan `TARGET_PATH` altına SFTP ile yazmayı dener.
4. İzin hatası olursa dosya `TEMP_UPLOAD_PATH` altına yüklenir ve `sudo` ile hedef dizine taşınır.
5. Listeleme/silme işlemleri [`/api/files`](src/app/api/files/route.ts) ile yönetilir.

## Gereksinimler

- Node.js 18+
- Bun veya npm
- Hedef Linux sunucuda SSH erişimi
- SSH erişimi olan kullanıcı (gerekirse sudo yetkisi)

## Kurulum

```bash
bun install
```

veya

```bash
npm install
```

## Ortam Değişkenleri

Proje kökünde [`.env`](.env) dosyası kullanılır.

Örnek dosya: [`.env.example`](.env.example)

```env
# SSH
SSH_HOST=10.5.5.25
SSH_PORT=22
SSH_USERNAME=bariburnu
SSH_PASSWORD=...
SSH_PRIVATE_KEY=

# Remote target
TARGET_PATH=~/workspace/geoserver-docker/geoserver_data/uploads

# Web auth
AUTH_USERNAME=admin
AUTH_PASSWORD=...

# Session secret (32+)
SESSION_SECRET=...
```

## Geliştirme Komutları

[`package.json`](package.json)

```bash
bun run dev
bun run lint
bun run build
bun run start
```

Eşdeğer npm komutları:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## SSH Kimlik Doğrulama ve İzin Notu

[`src/lib/ssh.ts`](src/lib/ssh.ts) içinde bağlantı katmanı aşağıdakileri destekler:

- Password auth
- Private key auth
- Keyboard-interactive auth fallback
- `SSH_PRIVATE_KEY` için hem inline key hem dosya yolu desteği
- Hedef klasörde izin yoksa sudo fallback akışı

Yeni opsiyonel değişkenler:

- `SUDO_ENABLED=true|false`
- `SUDO_PASSWORD=...` (boş bırakılırsa `SSH_PASSWORD` kullanılır)
- `TEMP_UPLOAD_PATH=/tmp`

Upload/list/delete işlemlerinde önce normal izinlerle işlem denenir; `permission denied` durumunda `SUDO_ENABLED=true` ise sudo komutuna fallback yapılır.

## API Endpointleri

- Giriş: [`POST /api/auth/login`](src/app/api/auth/login/route.ts)
- Çıkış: [`POST /api/auth/logout`](src/app/api/auth/logout/route.ts)
- Session kontrolü: [`GET /api/auth/session`](src/app/api/auth/session/route.ts)
- Dosya yükleme: [`POST /api/upload`](src/app/api/upload/route.ts)
- Dosya listeleme: [`GET /api/files`](src/app/api/files/route.ts)
- Dosya silme: [`DELETE /api/files`](src/app/api/files/route.ts)

## Güvenlik Notları

- Üretimde güçlü bir `AUTH_PASSWORD` kullanın.
- `SESSION_SECRET` en az 32 karakter olmalı.
- Mümkünse SSH key auth kullanın (`SSH_PRIVATE_KEY`).
- `TARGET_PATH` yalnızca gerekli klasörü işaret etmelidir.

## Sorun Giderme

### `All configured authentication methods failed`

- [`.env`](.env) içinde `SSH_HOST`, `SSH_PORT`, `SSH_USERNAME`, `SSH_PASSWORD` değerlerini kontrol edin.
- `SSH_PRIVATE_KEY` kullanıyorsanız:
  - Inline key ise `\n` kaçışlarının doğru olduğundan emin olun.
  - Dosya yolu veriyorsanız sunucuyu çalıştıran makinede dosya gerçekten mevcut olmalı.
- Hedef sunucuda `PasswordAuthentication` kapalıysa parola ile bağlanamazsınız; private key kullanın.
- SSH kullanıcı adının doğru kullanıcı olduğundan emin olun (eski örnekte `10.5.5.26` / yeni `.env` değerinde `10.5.5.25` farkı varsa düzeltin).

### Upload başarısız

- SSH bilgilerini kontrol edin (`SSH_HOST`, `SSH_USERNAME`, `SSH_PASSWORD`)
- `TARGET_PATH` dizininde doğrudan yazma yoksa `SUDO_ENABLED=true` olmalı
- `SUDO_PASSWORD` doğru olmalı (boşsa `SSH_PASSWORD` kullanılır)
- `TEMP_UPLOAD_PATH` (ör. `/tmp`) SSH kullanıcısı tarafından yazılabilir olmalı
- Hedef dizin yoksa uygulama önce normal `mkdir -p`, gerekirse sudo ile oluşturmayı dener

## Proje Yapısı

```text
geoserver-file-uploader/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── files/
│   │   │   └── upload/
│   │   └── page.tsx
│   ├── components/
│   └── lib/
│       ├── session.ts
│       └── ssh.ts
├── .env.example
├── .gitignore
└── package.json
```
