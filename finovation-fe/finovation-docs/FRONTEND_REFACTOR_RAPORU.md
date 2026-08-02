# Finovation Frontend Refactor Raporu

**Tarih:** 2 Ağustos 2026  
**Kapsam:** `finovation-fe` ve frontend'in Docker geliştirme ayarı  
**Backend durumu:** Backend kaynak kodunda değişiklik yapılmadı.

## 1. Amaç ve sonuç

Bu çalışma frontend'in mevcut işlevlerini koruyarak bakım maliyetini azaltmak,
gözlenen kullanıcı yönetimi ve oturum hatalarını gidermek, kodu anlaşılır modül
sınırlarına taşımak ve değişikliklerin otomatik kontrollerle doğrulanmasını
sağlamak için yapıldı.

Çalışma sonunda:

- Kaynak kod `app`, `features` ve `shared` sorumluluklarına ayrıldı.
- Oturum açma, token yenileme ve çıkış yarış durumları güvenli hale getirildi.
- Backend yanıtları kritik endpointlerde çalışma zamanında doğrulanmaya başladı.
- Kullanıcı oluşturma, düzenleme, listeleme, filtreleme ve silme akışlarındaki
  belirlenen hatalar düzeltildi.
- Tekrarlanan modal, profil alanı, parola alanı ve doğrulama kodları ortaklaştırıldı.
- Erişilebilir dialog, yükleme, hata ve tekrar deneme durumları eklendi.
- ESLint, TypeScript typecheck, Vitest, coverage ve üretim build kontrolleri tek
  kalite komutunda birleştirildi.
- 15 test dosyasında 38 otomatik test bulunuyor. Toplam satır coverage değeri
  `%68.00` seviyesine çıkarıldı ve coverage gerilemesini önlemek için alt
  eşikler yükseltildi.

## 2. Yeni mimari ve paket sınırları

```text
src/
├── app/
│   ├── App.tsx
│   └── router/
├── features/
│   ├── auth/
│   │   ├── api, components, context, lib, model, pages, styles
│   ├── dashboard/
│   │   └── pages
│   └── users/
│       ├── api, components, hooks, lib, model, pages, styles
├── shared/
│   ├── api, auth, lib, model, styles, ui
└── test/
```

### Sorumluluklar

- `app`: Uygulamanın ayağa kalkması, route tablosu ve route korumaları.
- `features/auth`: Login, `/me`, logout, şifre yenileme ve oturum state'i.
- `features/users`: Kullanıcı/şirket listesi, filtreler, mutasyonlar ve bunlara
  ait arayüz parçaları.
- `shared/api`: Feature bağımsız HTTP istemcisi, endpoint ayarları ve standart
  API hata modeli.
- `shared/auth`: Token saklama ve oturum süresi olayları.
- `shared/model`: Auth ve users feature'larının ortak rol/durum sözleşmeleri.
- `shared/ui`: Birden fazla ekranda kullanılabilen temel arayüz bileşenleri.
- `shared/lib`: Bir feature'a ait olmayan saf iş kuralları ve yardımcılar.

Eski `component`, `pages`, `service`, `type`, `util`, `context`, `config` ve
`css` klasörleri kaldırıldı. Tasarım referansları çalıştırılan kaynak kodun
dışına, `finovation-docs/reference` altına taşındı.

Bu düzenin temel kuralı şudur: Bir kod yalnızca tek bir iş özelliği tarafından
kullanılıyorsa ilgili feature içinde kalır; farklı feature'lar tarafından
kullanılıyorsa `shared` katmanına alınır. Böylece `shared` klasörü rastgele
yardımcı kod deposuna dönüşmez.

## 3. Oturum ve token yönetimi

### Login akışı

1. Login formu alanları frontend tarafında doğrular.
2. `AuthProvider.signIn`, login endpointinden access ve refresh tokenları alır.
3. Tokenlar `sessionStorage` içine yazılır.
4. Hemen ardından `/me` çağrısı yapılarak kullanıcının kimliği, rolü, şirketi ve
   yetenek bilgileri alınır.
5. Hem login hem `/me` başarılı olduğunda kullanıcı giriş yapmış kabul edilir.
6. `/me` başarısız olursa yarım kalmış oturumun tokenları temizlenir. Kullanıcı
   yanlışlıkla dashboard'a yönlendirilmez.

Bu karar, yalnızca token alınmasını başarılı login sayan eski davranışın
oluşturduğu “token var ama kullanıcı bağlamı yok” durumunu engeller.

### Korumalı istek ve refresh akışı

1. Ortak HTTP istemcisi korumalı isteğe `Authorization: Bearer <accessToken>`
   başlığını ekler.
2. İstek 401 dönerse refresh token ile yalnızca bir yenileme isteği başlatılır.
3. Aynı anda birden fazla istek 401 alırsa hepsi aynı refresh promise'ini
   bekler; birden fazla refresh çağrısı gönderilmez.
4. Başarılı refresh sonrası hem access hem refresh token yenisiyle değiştirilir
   ve ilk istek bir kez tekrar edilir.
5. Tekrarlanan istek de 401 dönerse veya refresh başarısız olursa tokenlar
   temizlenir ve oturum sona erme olayı yayınlanır.
6. Tüm isteklerde 20 saniyelik timeout ve çağıranın `AbortSignal` desteği vardır.

### Logout yarışı

Logout yerel oturumu hemen kapatır, tokenları temizler ve devam eden oturum
işlemlerini geçersiz kılar. Sunucu logout çağrısı arka planda en iyi çaba ile
yapılır. Logout sırasında tamamlanan eski bir refresh isteğinin tokenları
yeniden yazmasını engellemek için oturum sürüm numarası kullanılır.

### Route davranışı

- İlk `/me` kontrolü `isInitializing` ile login gönderiminden ayrı yönetilir.
- İlk oturum kontrolü tamamlanana kadar route içerikleri çizilmez; login
  gönderimi sırasında LoginPage mount edilmiş kalır ve hata state'i kaybolmaz.
- Başlangıç `/me` çağrısı ağ hatasıyla başarısız olursa hata ve “tekrar dene”
  sunulur; bu hata yanlışlıkla login yönlendirmesine çevrilmez.
- Panel erişimi olmayan kullanıcı `/users` sayfasına giremez.
- `GuestRoute`, giriş yapmış kullanıcının login ve şifre yenileme ekranlarına
  dönmesini engeller.

## 4. API sözleşmesi ve hata yönetimi

### Çalışma zamanı doğrulaması

TypeScript tipleri yalnızca build sırasında kontrol sağlar; sunucu beklenmeyen
bir JSON döndürdüğünde tarayıcıda kendiliğinden doğrulama yapmaz. Bu nedenle
login, `/me`, kullanıcı sayfası, kullanıcı detayı, şifre reset doğrulaması ve
şirket listesi yanıtlarına Zod şemaları eklendi.

Örneğin backend'in desteklediği `LOCKED` kullanıcı durumu frontend modeline ve
görsel durum etiketine eklendi. Bilinmeyen veya eksik alan içeren yanıt artık
ekranın daha sonra belirsiz biçimde bozulması yerine API sınırında hata verir.

### Standart hata modeli

`ApiRequestError` aşağıdaki bilgileri korur:

- HTTP status,
- backend hata kodu,
- kullanıcıya gösterilecek güvenli mesaj.

Bilinen backend hata kodları merkezi olarak Türkçe kullanıcı mesajlarına
çevrilir. Backend'in İngilizce teknik mesajları ve kod içermeyen alan mesajları
kullanıcıya doğrudan taşınmaz. Formlar kendi güvenli frontend doğrulamalarını
alanların altında, backend `GEN_400` hatasını ise genel Türkçe form mesajıyla
gösterir. Yetki hataları diğer mutasyon hatalarından ayrılır.

## 5. Kullanıcı yönetimi düzeltmeleri

### Listeleme ve sayfalama

- Liste isteği başarısızken boş tablo mesajının aynı anda görünmesi engellendi.
- Liste ve şirket hatalarına tekrar deneme aksiyonu eklendi.
- Silinen kullanıcı sayfadaki son kayıtsa bir önceki sayfaya dönülür.
- Backend toplam sayfa sayısı değiştiğinde geçersiz sayfa indeksi otomatik
  olarak son geçerli sayfaya çekilir.
- Yeni kullanıcı oluşturulduğunda ilk sayfaya dönülür; zaten ilk sayfadaysa
  liste yeniden yüklenir.
- `ACTIVE`, `INACTIVE` ve `LOCKED` durumları filtre ve gösterim katmanında aynı
  sözleşmeyi kullanır.

### Filtreleme

Rol, durum ve şirket için yazılmış özel listbox/event sistemi yerel `select`
bileşenlerine çevrildi. Bu değişiklik:

- klavye kullanımını ve ekran okuyucu uyumluluğunu tarayıcı standardına taşır,
- dışarı tıklama ve option klavye yönetimi tekrarını kaldırır,
- filtre payloadını değiştirmez,
- tarih aralığı filtresini mevcut davranışıyla korur.

### Kullanıcı oluşturma

- Şirket gerektiren bir rol seçildiğinde şirketler yüklenmeden veya şirket
  isteği hatalıyken oluşturma yapılamaz.
- Şirket hatası modal içinde tekrar denenebilir.
- Backend ile aynı kullanıcı adı/ad/soyad/e-posta uzunluk sınırları uygulanır.
- Frontend doğrulama hataları ilgili input altında gösterilir; backend'in ham
  alan mesajları kullanıcıya sızdırılmaz.
- Parolanın başındaki veya sonundaki karakterler artık `trim` ile sessizce
  değiştirilmez. Parola kullanıcı nasıl girdiyse öyle gönderilir.
- Form gerçek HTML `form`/`submit` davranışına geçirildi; Enter ile gönderim ve
  tarayıcı erişilebilirliği iyileşti.

### Kullanıcı düzenleme

- Kullanıcı kendisini düzenlerken rolü ve durumu değiştirilemez; backend
  politikasına uymayan seçenekler gösterilmez.
- Aktörün `assignableRoles` yetenek bilgisi sabit frontend rol listesi yerine
  kaynak olarak kullanılır.
- Kilitli kullanıcı mevcut durumu kaybetmeden gösterilir ve yetkili kullanıcı
  tarafından aktif/pasif duruma alınabilir.
- Süper admin, şirket gerektiren uygun rol için şirket seçebilir.
- Şirket listesi hazır değilse şirket gerektiren güncelleme gönderilmez.
- Profil ve parola alanlarında oluşturma ekranıyla aynı doğrulama kuralları
  kullanılır.

### Ortak bileşenler

- Oluşturma ve düzenleme modalındaki tamamen tekrarlanan iki CSS dosyası tek
  `UserFormModal.module.css` dosyasında birleştirildi.
- Ad, soyad ve e-posta alanları `UserProfileFields` altında ortaklaştırıldı.
- Parola ve parola tekrar alanları `PasswordPairFields` altında ortaklaştırıldı.
- Silme, hata, oluşturma ve düzenleme pencereleri ortak `Dialog` altyapısını
  kullanır.

## 6. Dialog ve erişilebilirlik

Ortak dialog aşağıdaki davranışları tek yerde sağlar:

- React portal ile sayfa katmanından bağımsız çizim,
- açıldığında ilk uygun elemana odaklanma,
- Tab/Shift+Tab odak tuzağı,
- kapanırken önceki odağı geri getirme,
- Escape ve overlay ile güvenli kapatma,
- kayıt/silme sürerken yanlışlıkla kapatmayı engelleme,
- dialog açıkken arka sayfa scroll'unu kilitleme,
- `aria-labelledby`, `aria-describedby`, `dialog` ve `alertdialog` rolleri.

Form alanlarına `aria-invalid`, dialog açıklamaları ve görünür focus stilleri
eklendi. Kullanışlılığı azaltabilen otomatik focus kullanımları kaldırıldı.

## 7. Geliştirme ve kalite altyapısı

### Eklenen komutlar

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:watch
npm run test:coverage
npm run build
npm run check
```

`npm run check` sırasıyla format, lint, typecheck, test ve build çalıştırır.
CI kurulurken aynı komut doğrudan kalite kapısı olarak kullanılabilir.

### Test edilen kritik davranışlar

- Backend hata kodu çevirisi ve ham teknik mesajların engellenmesi,
- kullanıcı formu zorunlu/uzunluk/e-posta doğrulaması,
- `LOCKED` API sözleşmesi ve bozuk sayfalama yanıtının reddedilmesi,
- Bearer başlığının eklenmesi,
- eş zamanlı 401 isteklerinde tek refresh çalışması,
- refresh sonrası ikinci 401'de oturumun temizlenmesi,
- login sonrası `/me` başarısında oturumun tamamlanması,
- login sonrası `/me` hatasında yarım tokenların temizlenmesi,
- yanlış login sırasında `AUTH_001` mesajının form üzerinde korunması,
- guest/protected route yönlendirmeleri,
- şifre yenileme `AUTH_006` ve `AUTH_007` hata akışları,
- kullanıcı ve şirket veri hook'larının başarı/tekrar deneme davranışları,
- şirketli ADMIN için desteklenmeyen SUPER_ADMIN geçişinin gizlenmesi,
- parolanın değiştirilmeden create payloadına taşınması,
- şirketler yüklenirken şirket zorunlu create işleminin engellenmesi,
- rol ve şirket filtrelerinin doğru payload üretmesi.

Coverage tüm `src` dosyaları üzerinden ölçülür. İlk eşikler kasıtlı olarak mevcut
başlangıç değerinin biraz altında tutuldu:

| Ölçüm | Mevcut | Minimum eşik |
|---|---:|---:|
| Statements | %66.28 | %60 |
| Branches | %60.27 | %55 |
| Functions | %62.09 | %55 |
| Lines | %68.00 | %60 |

Bu oran bitiş hedefi değildir; yeni işlerde ilgili feature testleri eklenerek
kademeli artırılmalıdır. Eşiklerin amacı ilk aşamada mevcut güvenceyi
geriletmemektir.

## 8. Yerel geliştirme ve Docker

Yerel Vite varsayılan proxy hedefi `http://localhost:8080` olarak düzeltildi.
Docker container içindeki `localhost` farklı anlam taşıdığı için compose
frontend servisi açıkça `VITE_DEV_PROXY_TARGET=http://backend:8080` kullanır.

Frontend Dockerfile bağımlılıkları tekrarlanabilir şekilde lock dosyasından
kurmak için `npm install` yerine `npm ci` kullanır. `.env.example` ve README yeni
çalıştırma biçimine göre güncellendi. Coverage çıktısı Git dışında ve Vite file
watch kapsamı dışında bırakıldı. `AuthProvider` ile `useAuth` ayrı dosyalarda
tutularak geliştirme sırasındaki Fast Refresh invalidation uyarısı giderildi.

## 9. Bilinen sınırlar ve sonraki öneriler

### Zorunlu ilk parola değişikliği

`/me` yanıtındaki `passwordChangeRequired` frontend modelinde doğrulanıyor ancak
uygulamada bu kullanıcıyı zorunlu parola değiştirme ekranına yönlendiren akış
yoktur. Backend'de giriş yapmış kullanıcının parolasını değiştireceği ayrı bir
endpoint de bulunmadığından bu iş yalnız frontend değişikliğiyle tamamlanamaz.
Endpoint, hata sözleşmesi ve ürün akışı belirlendikten sonra ayrı geliştirme
olarak ele alınmalıdır.

### ADMIN → SUPER_ADMIN geçişi

Mevcut backend update servisi `companyId: null` değerini, hedef kullanıcının
eski şirketini koruma talebi gibi yorumlar. Bu nedenle şirketli bir ADMIN'i
şirketsiz SUPER_ADMIN rolüne aynı endpoint ile geçirmek mümkün değildir.
Frontend başarısız olacağı bilinen bu seçeneği sunmaz. Gelecekte backend;
“alan gönderilmedi” ile “şirketi null yap” durumlarını ayıran bir request modeli
veya özel rol/şirket atama endpointi sağlarsa seçenek güvenle açılabilir.

### Token saklama stratejisi

Mevcut uygulamayla uyumlu olarak tokenlar `sessionStorage` içinde tutulmaya
devam eder. Daha güçlü XSS risk azaltımı istenirse refresh tokenın
`HttpOnly + Secure + SameSite` cookie olarak yönetilmesi backend ve frontend
birlikte planlanmalıdır. Bu yalnız frontend refactor kapsamına alınmadı.

### Refresh sırasında hesap durumu

Backend refresh akışı kullanıcıyı tekrar yüklese de `UserDetails.isEnabled()`
sonucunu refresh metodunda açıkça kontrol etmiyor. Pasif/kilitli kullanıcıların
mevcut refresh tokenla yeni access token alamaması ürün güvenlik beklentisiyse
bu kontrol backend tarafında ayrıca doğrulanmalı ve test edilmelidir.

### Test kapsamının büyütülmesi

Sonraki öncelikler:

1. Şifre yenilemenin başarılı OTP ve parola değiştirme adımlarının testleri,
2. kullanıcı düzenleme rol-şirket matrisinin daha geniş parametrik testleri,
3. liste silme ve sayfa geri alma akışının sayfa testi,
4. gerçek backend ile sözleşme/entegrasyon testleri,
5. repository CI pipeline'ında `npm ci && npm run check` zorunluluğu.

## 10. Doğrulama sonucu

Çalışma sonunda aşağıdaki kontroller birlikte başarılı çalıştırıldı:

- format check,
- ESLint,
- TypeScript typecheck,
- 15 dosyada 38 Vitest testi,
- coverage ve minimum eşikler,
- Vite production build,
- `git diff --check`.

Üretilen production bundle yaklaşık olarak:

- JavaScript: `353.32 kB` (`106.90 kB` gzip),
- CSS: `27.55 kB` (`5.68 kB` gzip).

Bundle boyutu şu an kritik seviyede değildir. Yeni büyük bağımlılıklar veya
ekranlar eklendiğinde route bazlı lazy loading değerlendirilmelidir.
