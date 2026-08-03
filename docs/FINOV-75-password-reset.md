# FINOV-75 — E-posta OTP ile Şifre Yenileme

## Amaç

Kullanıcıların giriş yapmadan, hesaplarında kayıtlı e-posta adresini doğrulayarak şifrelerini güvenli biçimde yenileyebilmesi sağlandı.

Geliştirilen akış:

1. Kullanıcı e-posta adresini girer.
2. Hesap bulunursa e-posta adresine 6 haneli, tek kullanımlık OTP gönderilir.
3. Kullanıcı OTP'yi doğrular.
4. Backend kısa ömürlü ve tek kullanımlık bir password reset token üretir.
5. Kullanıcı yeni şifresini iki kez girer.
6. Şifre parola politikasına uygun ve iki alan eşitse BCrypt ile güncellenir.
7. Başarı ekranından login sayfasına dönülür.

## API

Password reset endpointleri kimlik doğrulaması gerektirmeden kullanılabilir. Bu endpointlerin yetkisi yalnızca ilgili akışla sınırlıdır.

### OTP isteme

```http
POST /api/v1/auth/password-reset/request
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

Başarılı cevap:

```http
204 No Content
```

### OTP doğrulama

```http
POST /api/v1/auth/password-reset/verify
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Başarılı cevap:

```http
200 OK
```

```json
{
  "resetToken": "short-lived-single-use-token"
}
```

### Şifre güncelleme

```http
POST /api/v1/auth/password-reset/reset
Content-Type: application/json
```

```json
{
  "resetToken": "short-lived-single-use-token",
  "newPassword": "NewPassword123!",
  "newPasswordConfirm": "NewPassword123!"
}
```

Başarılı cevap:

```http
204 No Content
```

Başarı mesajları frontend tarafından gösterilir. Backend hata durumlarında mevcut global exception formatıyla HTTP durumunu, hata kodunu ve hata mesajını döndürür.

## Backend Bileşenleri

```text
auth/
├── config/
│   └── PasswordResetProperties
├── controller/
│   ├── AuthController
│   └── docs/AuthControllerDocs
├── dto/
│   ├── PasswordResetStartRequest
│   ├── PasswordResetVerifyRequest
│   ├── PasswordResetVerifyResponse
│   └── PasswordResetRequest
├── security/
│   └── PasswordResetTokenCodec
├── service/
│   ├── PasswordResetService
│   └── PasswordResetMailService
├── store/
│   └── PasswordResetStore
└── template/
    └── PasswordResetMailTemplate
```

### Sorumluluklar

- `PasswordResetService`: Akışı ve iş kurallarını yönetir; kullanıcı kontrolü, OTP üretimi/doğrulaması ve şifre güncellemesini gerçekleştirir.
- `PasswordResetStore`: OTP, deneme sayısı, yeniden gönderim bekleme süresi ve reset token kayıtlarını Redis üzerinde yönetir.
- `PasswordResetTokenCodec`: OTP kimliği ve reset token için HMAC-SHA256 hash üretir.
- `PasswordResetMailService`: Hazırlanan multipart e-postayı SMTP üzerinden gönderir.
- `PasswordResetMailTemplate`: OTP ve süre değerlerini düz metin/HTML şablonlarına yerleştirir.
- `PasswordResetProperties`: Süre, deneme limiti, sender ve secret ayarlarını type-safe biçimde taşır ve doğrular.

E-posta içerikleri Java koduna gömülmemiştir:

```text
resources/templates/mail/password-reset-otp.html
resources/templates/mail/password-reset-otp.txt
```

## Redis Kullanımı

Geçici password reset verileri ilişkisel veritabanı yerine Redis'te tutulur.

```text
auth:password-reset:otp:<identity>
auth:password-reset:attempts:<identity>
auth:password-reset:cooldown:<identity>
auth:password-reset:token:<tokenHash>
```

Varsayılan kurallar:

- OTP geçerlilik süresi: 10 dakika
- Reset token geçerlilik süresi: 10 dakika
- Yeniden kod isteme bekleme süresi: 1 dakika
- En fazla hatalı OTP denemesi: 5

Yeni OTP oluşturulduğunda önceki OTP geçersiz hale gelir. Deneme limiti dolduğunda OTP silinir. Reset token `getAndDelete` ile tüketildiği için yalnızca bir kez kullanılabilir.

## Güvenlik

- OTP üretiminde `SecureRandom` kullanılır.
- OTP ve reset token değerleri Redis'e açık biçimde yazılmaz; HMAC-SHA256 hashleri saklanır.
- OTP karşılaştırması `MessageDigest.isEqual` ile gerçekleştirilir.
- Password reset token JWT değildir; claim veya kullanıcı verisi taşımayan, 32 byte rastgele üretilmiş URL-safe bir değerdir.
- Reset token yalnızca şifre güncelleme endpointinde kullanılabilir; access token görevi görmez.
- Yeni şifre endpoint DTO'sunda mevcut parola politikasıyla doğrulanır; servis iki şifre alanının eşitliğini kontrol eder ve şifreyi BCrypt ile hashler.
- OTP, reset token, şifre ve e-posta adresi loglanmaz. Loglarda yalnızca gerekli kullanıcı kimliği ve işlem sonucu bulunur.
- SMTP parolası ve secret değerleri yalnızca lokal `.env`/deployment secret yönetimi üzerinden sağlanır; Git'e eklenmez.

Password reset hashleme secretı `PASSWORD_RESET_SECRET` ile verilebilir. Tanımlanmadığında mevcut yapı `JWT_SECRET` değerini fallback olarak kullanır. Ortam bazında ayrı bir secret tanımlanması önerilir.

## Hata Kodları

| Kod | HTTP | Açıklama |
|---|---:|---|
| `AUTH_006` | 404 | E-posta adresine ait hesap bulunamadı |
| `AUTH_007` | 400 | Doğrulama kodu hatalı |
| `AUTH_008` | 410 | Doğrulama kodunun süresi doldu |
| `AUTH_009` | 429 | Yeniden kod isteme süresi dolmadı |
| `AUTH_010` | 429 | Hatalı OTP deneme limiti aşıldı |
| `AUTH_011` | 400 | Reset token geçersiz, kullanılmış veya süresi dolmuş |
| `AUTH_012` | 400 | Yeni şifre alanları eşleşmiyor |
| `AUTH_013` | 503 | Doğrulama e-postası gönderilemedi |

Frontend bu hata kodlarını kullanıcıya uygun Türkçe mesajlara çevirir. Tanımlı olmayan bir hata için backend mesajı veya genel hata metni fallback olarak kullanılır.

## E-posta Gönderimi

SMTP gönderimi Spring Mail üzerinden yapılır. Gmail kullanımı için iki adımlı doğrulama açılmış bir test hesabı ve Google App Password gerekir.

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_SMTP_AUTH=true
MAIL_STARTTLS_ENABLED=true
MAIL_FROM=
```

Gerçek değerler `.env` dosyasında tutulmalıdır. `.env.example` yalnızca gerekli alanları gösterir.

OTP e-postası:

- Sade HTML tasarım kullanır.
- Finovation renk paletiyle uyumludur.
- Kodu ve geçerlilik süresini belirgin gösterir.
- HTML desteklemeyen istemciler için düz metin alternatifi içerir.

## Frontend

`/forgot-password` sayfası dört UI durumundan oluşur:

```text
email → otp → password → success
```

- E-posta ve OTP için istemci tarafı temel doğrulama bulunur.
- Yeni şifre iki kez alınır ve ortak parola politikasıyla doğrulanır.
- Reset token yalnızca React state içerisinde tutulur; localStorage veya sessionStorage'a yazılmaz.
- Token süresi dolduğunda akış başlangıç adımına döner.
- Başarılı şifre güncellemesinden sonra kullanıcı `Tamam` butonuyla login sayfasına yönlendirilir.
- Ekran mevcut login bileşenlerini ve renk paletini kullanır; mobil görünüm desteklenir.

## Veritabanı

Yeni tablo veya kolon eklenmemiştir. Güncelleme mevcut `users.password` alanında gerçekleştirilir. Geçici doğrulama verileri Redis'te tutulduğu için bu geliştirme kapsamında Flyway migration gerekmemiştir.

Başarılı şifre güncellemesinde:

- `password` BCrypt hash ile güncellenir.
- `password_change_required` değeri `false` yapılır.
- `updated_at` güncellenir.

## Doğrulama

- Password reset servis akışı için 11 unit test eklendi.
- Multipart düz metin/HTML e-posta üretimi için 1 unit test eklendi.
- Backend build doğrulandı.
- Frontend production build doğrulandı.
- Gmail SMTP üzerinden gerçek OTP gönderimi doğrulandı.
- Endpointler Swagger/OpenAPI dokümantasyonuna eklendi.
