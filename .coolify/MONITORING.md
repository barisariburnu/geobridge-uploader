# Production hata izleme

Resmi `@sentry/node` 11.14.0 paketi Bun kilidinde sabitlenmiştir. Next.js
`onRequestError` kaçan sunucu hatalarını, API ve operasyon sınırları yakalanıp
cevaba çevrilen beklenmeyen hataları bildirir. Kimlik/validasyon retleri ve
`/api/health` sessizdir. Tarayıcı SDK'sı, DSN relay veya serbest olay endpoint'i yoktur.

Runtime `SENTRY_DSN` isteğe bağlıdır; boş veya geçersiz DSN izlemeyi kapatır.
`SENTRY_ENVIRONMENT=production` kullanılır; olay ortamı kodda production ile
sınırlıdır. `SENTRY_RELEASE=geobridge-uploader@<40 küçük hex Git SHA>` image içine yazılır;
runtime'da değiştirilmemelidir. Auth, DB şeması, giriş scripti ve kalıcı mount'lar
aynıdır. İzleme arızası API sonucunu değiştirmez.

Ham exception SDK'ya verilmez. Kapalı hata kodları sabit bileşen ve repo içi
konumlara eşlenir. `beforeSend` olayı sıfırdan kurar; transport ayrıca SDK'nın
sonradan eklediği veri, attachment ve trace header'larını çıkarır. Request, URL,
user, header/cookie, body, SQL, SSH, dosya/içerik/yol, locals, kaynak satırı,
context ve breadcrumb gönderilmez. Aynı exception nesnesi bir kez bildirilir.
Tracing, profiling, replay, session ve log entegrasyonları yüklenmez.

Coolify native source commit seçeneği açık olmalıdır. Boş `SOURCE_COMMIT`
override kaldırılır; custom build command `.coolify/build.sh` olur. Script yalnız
`SOURCE_COMMIT` alanını `/artifacts/build-time.env` içinden okur; source/eval yoktur.
Env değişkeni ve yerel Git fallback desteklenir. 40 hex doğrulaması Docker'dan
öncedir. Geç Docker ARG `MONITORING_SOURCE_REVISION` release ve OCI revision üretir.
Compose image etiketi `latest` sabittir; tüm mevcut volume ve host mount'ları korunur.

## Sentetik kontrol

Gerçek production image/container içinde entrypoint'i çağırmadan çalıştırın:

```sh
node scripts/monitoring-check.mjs
```

CLI yalnız `SYNTHETIC_CHECK` sabit olayını gönderir. Uygulama, DB, Prisma, SSH,
yükleme veya bildirim modüllerini import etmez. Çıktı event ID ve SDK flush
sonucudur; `delivery_verified=false` alıcının kaydını ayrıca doğrulamayı gerektirir.
DSN/uygun release yoksa exit 2, flush başarısızsa exit 3. Default transport'un
Sentry SDK User-Agent'i korunur. Gerçek gönderim yetkili operatör işidir.

## Yerel kanıt

`node --test tests/*.test.mjs` gerçek SDK/canary, kapalı/bozuk transport, aynı hata
tekilleştirme, gerçek route'un inert DB/SSH ile yakalanan hata ve auth ret yolları,
Next hook, build-time parser ve metadata sözleşmesini ölçer. Testlerde DB/SSH ağı
ve migration/db push çağrılmaz. `bun run lint` ve Docker build ayrıca çalıştırılır.

`tests/runtime-image-canary.mjs` gerçek image içinde loopback HTTP alıcısı açıp
kontrol CLI'sini child process ile çağırır. Docker `--network none --read-only`,
uygulama entrypoint'i yerine Bun/Node ve yalnız bu test dosyasına read-only mount
ile çalıştırılır. Event-only zarf, production/release, SDK UA ve tam bir olay
assert edilir. Üretim servisleri veya persistent volume'lar kullanılmaz.

Uygulama ve kontrol CLI'si aynı CommonJS SDK grafiğini yükler. Next standalone
izlemesi CJS bağımlılıklarını taşıdığından bu seçim eksik ESM dependency riskini
önler; Node20 ve gerçek Bun runner image'larında sentetik HTTP ile doğrulanmıştır.
