# Finovation Frontend

React, TypeScript ve Vite tabanlı Finovation web uygulaması.

## Gereksinimler

- Node.js 22.22 veya üzeri
- npm
- Yerelde çalıştırılacaksa `http://localhost:8080` adresinde çalışan backend

## Yerel geliştirme

Frontend klasöründe aşağıdaki komutları çalıştırın:

```bash
npm ci
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde açılır. `/api`
istekleri Vite proxy üzerinden `http://localhost:8080` adresine gönderilir.

Farklı bir backend adresi gerekiyorsa `.env.example` dosyasını `.env` adıyla
kopyalayıp `VITE_DEV_PROXY_TARGET` değerini değiştirin. `.env` dosyaları Git'e
gönderilmez.

## Docker ile geliştirme

Repository kökünde:

```bash
docker compose up --build frontend backend
```

Compose ortamında frontend proxy hedefi servis adı üzerinden
`http://backend:8080` olarak ayarlanır. Bu değer yerel terminal ayarından
bilinçli olarak farklıdır; container içindeki `localhost` frontend
container'ının kendisini ifade eder.

## Kalite komutları

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run check
```

`npm run check`; format, lint, TypeScript, test ve üretim build kontrollerini
tek akışta çalıştırır.

## Kaynak kod organizasyonu

```text
src/
├── app/                 # Uygulama kökü ve route korumaları
├── features/
│   ├── auth/            # Kimlik doğrulama ve şifre yenileme özelliği
│   ├── dashboard/       # Dashboard ekranı
│   └── users/           # Kullanıcı ve şirket yönetimi özelliği
├── shared/
│   ├── api/             # Ortak HTTP istemcisi ve API hata sözleşmesi
│   ├── auth/            # Token saklama ve oturum olayları
│   ├── lib/             # Özellikten bağımsız yardımcı kurallar
│   ├── model/           # Feature'lar arasında ortak domain tipleri
│   ├── styles/          # Global tema ve reset
│   └── ui/              # Tekrar kullanılabilir arayüz bileşenleri
└── test/                # Ortak test kurulumu
```

Bir özelliğe ait API, model, component, hook ve stiller aynı feature altında
tutulur. Uygulama genelinde tekrar kullanılan kodlar `shared` altında yer alır.
Yeni kod eklerken feature sınırlarını aşan doğrudan bağımlılıklar yerine bu
ayrım korunmalıdır.

## API çalışma modeli

- Tarayıcı istekleri `/api` taban yolunu kullanır.
- Access token korumalı isteklere `Bearer` başlığıyla eklenir.
- 401 yanıtında tek bir refresh isteği çalıştırılır ve başarılıysa ilk istek
  bir kez tekrarlanır.
- Backend yanıtları kritik endpointlerde Zod şemalarıyla çalışma zamanında
  doğrulanır.
- Backend hata kodları ortak API hata katmanında kullanıcıya uygun Türkçe
  mesajlara çevrilir. Backend'in ham teknik ve alan doğrulama mesajları
  kullanıcıya doğrudan gösterilmez.

Refactor ayrıntıları ve bilinen geliştirme alanları
`finovation-docs/FRONTEND_REFACTOR_RAPORU.md` dosyasında tutulur.
