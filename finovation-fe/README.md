# Finovation Login

React, TypeScript, Vite ve merkezi CSS yapısıyla hazırlanmış giriş ekranı.

## IntelliJ IDEA ile çalıştırma

1. IntelliJ IDEA'da **File > Open** menüsünden bu klasörü açın.
2. IntelliJ terminalini açın.
3. Bağımlılıkları kurun:

   ```bash
   npm install
   ```

4. Geliştirme sunucusunu başlatın:

   ```bash
   npm run dev
   ```

5. Terminalde gösterilen `http://localhost:5173` adresini tarayıcıda açın.

## Komutlar

- `npm run dev`: Geliştirme sunucusunu başlatır.
- `npm run build`: Üretim derlemesi oluşturur.
- `npm run preview`: Üretim derlemesini yerel olarak gösterir.

## Java backend bağlantısı

Backend bilgileri belli olduğunda `.env.example` dosyasını `.env` adıyla kopyalayın:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_LOGIN_PATH=/api/auth/login
```

Giriş formu aşağıdaki isteği gönderir:

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "kullanici",
  "password": "sifre"
}
```

- Backend adresi ve endpoint: `src/config/api.ts`
- HTTP isteği ve hata yönetimi: `src/features/auth/api/authService.ts`
- İstek/cevap tipleri: `src/features/auth/model/auth.types.ts`
- Giriş ekranı ve form davranışı: `src/pages/login/LoginPage.tsx`

Backend farklı alan isimleri veya farklı bir cevap döndürürse yalnızca
`features/auth` altındaki servis ve tip eşlemelerinin güncellenmesi yeterlidir.

## Kaynak kod organizasyonu

- `src/app`: Uygulamanın kök component'i ve ileride eklenecek router/provider yapıları.
- `src/pages`: URL veya ekran seviyesindeki component'ler ve yalnızca o sayfaya ait CSS Modules.
- `src/features`: Login gibi iş özelliklerinin API, model ve ilerideki özel component/hook kodları.
- `src/shared/ui`: Birden fazla sayfada kullanılabilecek ortak UI component'leri.
- `src/shared/layout`: Ortak sayfa yerleşimi parçaları.
- `src/shared/icons`: Tekrar kullanılabilir SVG icon component'leri.
- `src/config`: Uygulama genelindeki çalışma zamanı ayarları.
- `src/index.css`: Yalnızca global tema değişkenleri, reset ve temel element kuralları.

Component stilleri aynı klasördeki `*.module.css` dosyalarında tutulur. CSS Modules
sınıf isimlerini build sırasında izole ettiği için yeni sayfaların stilleri mevcut
sayfalarla çakışmaz.
