# Dashboard Teknik Dokümantasyonu

## 1. Amaç ve kapsam

Dashboard, kullanıcının aşağıdaki dört ürün modülünü tek ekrandan takip etmesini sağlar:

- Fon Tasarımı
- Fon İzleme ve Performans
- Optimizasyon
- Stres Testi

Ekran, ayrıntılı modül sayfalarının yerine geçmez. Genel durum, sonuçlar ve sık kullanılan işlemler için bir başlangıç noktasıdır.

Dashboard route'u `/dashboard`, backend aggregation endpoint'i `GET /api/v1/dashboard/summary` adresidir. Her ikisi de kimliği doğrulanmış ve ürün erişimi bulunan kullanıcılara açıktır.

## 2. Genel mimari

```text
DashboardPage
  |
  +-- GET /api/v1/dashboard/summary
  |     +-- FundMonitoringService.listFunds
  |     +-- FundDraftService.listInProgressDrafts
  |     +-- OptimizationRequestService.listLogs/getResult
  |     +-- StressTestService.getHistory
  |
  +-- GET /api/v1/funds/{selectedFundId}/monitoring
        +-- Seçili fonun fiyat, getiri ve grafik verileri
```

Aggregation endpoint'i fon, taslak, optimizasyon ve stres testi özetlerini tek HTTP isteğinde döndürür. Fon performansı hesaplaması daha ağır ve fon seçimine bağlı olduğu için ayrı istek olarak tutulur.

Backend yeni bir domain mantığı üretmez; ilgili modüllerin mevcut servislerini orkestre eder.

## 3. Frontend

### 3.1. Component ağacı

```text
DashboardPage
├── DashboardHeader
├── DashboardSummaryCards
├── QuickActions
├── FundPerformanceOverview
│   └── PriceTrendChart (reuse)
├── StressTestOverview
├── RecentFunds
└── OptimizationOverview
```

### 3.2. Bölümler

#### KPI kartları

Dashboard üst bölümünde beş KPI bulunur:

1. Aktif fon sayısı
2. Devam eden taslak sayısı
3. Seçili fonun bir aylık getirisi
4. En son optimizasyon işleminin durumu veya sonucu
5. Son stres testinin portföy etkisi

Bir bölüm backend tarafında yüklenemezse kart `0` göstermez. Değer `—`, açıklama ise `Veri alınamadı` olarak sunulur.

#### Fon performansı

Kullanıcı aktif fonlar arasında seçim yapabilir. Seçili fon için:

- güncel pay fiyatı,
- günlük değişim,
- bir aylık getiri,
- bir aylık fiyat trendi

gösterilir. Grafik için mevcut `PriceTrendChart`, formatlama için fon izleme formatter'ları yeniden kullanılır.

#### Fonlar ve taslaklar

Aktif fonlar ve devam eden taslaklar ayrı listelerde, en fazla üçer satırla gösterilir. Panelde iki ayrı detay bağlantısı vardır:

- Aktif fonlar: `/fund-design/active`
- Taslaklar: `/fund-design/create`

#### Optimizasyon

KPI, log listesindeki gerçek anlamda en yeni işlemi gösterir. Daha eski tamamlanmış bir sonuç varken yeni bir optimizasyon çalışıyorsa KPI'da yeni işlemin durumu görünür.

Detay paneli, son görüntülenebilir sonucu kullanarak volatilite, maksimum düşüş ve Sharpe oranının mevcut/önerilen değerlerini karşılaştırır.

#### Stres testi

Son tamamlanmış stres testi için senaryo, portföy etkisi, veri tarihi ve test zamanı gösterilir. Etki pozitif, negatif veya nötr olarak renklendirilir.

`Düşük/Orta/Yüksek Risk` sınıflandırması yapılmaz. Domain katmanında onaylanmış risk eşikleri bulunmadığı için frontend tarafında keyfî eşik oluşturulmamıştır.

#### Hızlı işlemler

- Yeni Fon Tasarla: `/fund-design/new`
- Fonları İzle: `/fund-monitoring`
- Optimizasyon Başlat: `/optimization-requests/new`
- Stres Testi Çalıştır: `/stress-test`

### 3.3. State ve veri akışı

`useDashboard` hook'u özet verisini, seçili fonu, fon performansını, loading durumlarını ve bölüm hatalarını yönetir.

1. Sayfa açıldığında dashboard özeti istenir.
2. Mevcut seçim hâlâ geçerliyse korunur; değilse ilk aktif fon seçilir.
3. Seçili fon için monitoring isteği yapılır.
4. Fon değiştirildiğinde yalnızca monitoring verisi yeniden alınır.
5. `Verileri Yenile` aksiyonu hem özeti hem seçili fon performansını yeniler.
6. `AbortController`, sayfa kapanması veya seçim değişikliğinde eski isteklerin state'i güncellemesini engeller.

### 3.4. API doğrulama

Frontend, aggregation cevabını Zod ile doğrular. Modüllerin mevcut response şemaları yeniden kullanılır. Backend'in bildirdiği `unavailableSections` değerleri kullanıcıya uygun Türkçe hata mesajlarına frontend servis katmanında dönüştürülür.

### 3.5. Responsive davranış

- Geniş desktop: beş KPI, dört hızlı işlem ve iki kolonlu ana içerik.
- Orta ekran: KPI'lar üç kolona, hızlı işlemler iki kolona düşer.
- Tablet: performans ve stres testi panelleri tek kolona geçer.
- Mobil: tüm kartlar tek kolon olur; metrikler ve panel footer'lar dikey yerleşir.
- `prefers-reduced-motion` tercihinde hareket geçişleri kapatılır.

## 4. Backend

### 4.1. Endpoint

```http
GET /api/v1/dashboard/summary
Authorization: Bearer <access-token>
```

Controller, kullanıcı adını `AuthenticationPrincipal` üzerinden alır ve `DashboardService` katmanına iletir.

### 4.2. Response modeli

```json
{
  "funds": [],
  "drafts": [],
  "optimizationLogs": [],
  "latestOptimizationResult": null,
  "stressTests": [],
  "unavailableSections": []
}
```

`unavailableSections` aşağıdaki değerleri alabilir:

- `FUNDS`
- `DRAFTS`
- `OPTIMIZATION`
- `STRESS_TESTS`

Boş bir liste ilgili modülde veri bulunmadığı anlamına gelebilir. Bir modülün teknik nedenle yüklenemediği durumlarda ise liste boş döner ve modül adı `unavailableSections` içinde yer alır. Böylece frontend gerçek boş durum ile hata durumunu ayırabilir.

### 4.3. Servis orkestrasyonu

`DashboardService` aşağıdaki mevcut servisleri kullanır:

| Dashboard verisi | Kaynak servis | Davranış |
| --- | --- | --- |
| Aktif fonlar | `FundMonitoringService.listFunds` | Kullanıcının tamamlanmış fonları |
| Taslaklar | `FundDraftService.listInProgressDrafts` | Kullanıcının devam eden taslakları |
| Optimizasyon logları | `OptimizationRequestService.listLogs` | Oluşturma tarihine göre azalan loglar |
| Son kullanılabilir sonuç | `OptimizationRequestService.getResult` | İlk `resultAvailable` logunun sonucu |
| Stres testi geçmişi | `StressTestService.getHistory` | Tamamlanmış testler, yeniden eskiye |

Servis, modüllerin repository veya domain mantığını tekrar etmez.

### 4.4. Kısmi hata toleransı

Her modül ayrı yüklenir. Bir modül RuntimeException ile başarısız olursa:

1. Hata backend loguna yazılır.
2. O modül için güvenli boş değer döner.
3. Modül `unavailableSections` listesine eklenir.
4. Diğer modüller yüklenmeye devam eder.

Aggregation seviyesinde ortak transaction kullanılmaz. Her mevcut modül servisi kendi read-only transaction sınırını korur; bir servis hatası diğer servis çağrılarını rollback-only durumuna taşımaz.

## 5. Test kapsamı

### Frontend

- Dört modül özetinin birlikte render edilmesi
- KPI değerleri ve mevcut grafik component'inin kullanımı
- Quick Action ve fon/taslak route'ları
- Fon seçimi ve manuel yenileme
- Yeni bir optimizasyon devam ederken KPI'nın güncel durumu göstermesi
- Aggregation response şema doğrulaması
- `unavailableSections` hata eşlemesi
- Seçili fon monitoring servis delegasyonu

### Backend

- Dört modül verisinin tek response'ta birleştirilmesi
- En yeni kullanılabilir optimizasyon sonucunun yüklenmesi
- Kullanılabilir optimizasyon sonucu olmadığında `null` dönülmesi
- Bir modül hata verdiğinde kalan modüllerin dönmeye devam etmesi
- Hatalı modülün `unavailableSections` içinde bildirilmesi

## 6. Bilinen sınırlamalar ve sonraki adımlar

### Veri hacmi

Mevcut response fon, taslak, optimizasyon logu ve stres testi listelerini tam olarak döndürür. Kullanıcı başına veri hacmi büyürse dashboard'a özel kompakt sorgulara geçilmelidir:

- toplam kayıt sayıları,
- son 3–5 kayıt,
- son işlem/sonuç,
- sayfalama veya repository seviyesinde limit.

### Risk seviyesi

Stres testi için düşük/orta/yüksek risk eşikleri business tarafından tanımlanırsa bu değerler domain veya backend katmanında hesaplanmalıdır. Frontend yalnızca dönen seviyeyi görselleştirmelidir.

### Son aktiviteler

Projede dashboard'a uygun ortak bir aktivite modeli bulunmadığı için ayrı bir activity altyapısı oluşturulmamıştır. İhtiyaç netleşirse mevcut domain event veya audit log yapısı değerlendirilmelidir.

## 7. İlgili dosyalar

### Frontend

- `src/features/dashboard/pages/DashboardPage.tsx`
- `src/features/dashboard/hooks/useDashboard.ts`
- `src/features/dashboard/api/dashboardService.ts`
- `src/features/dashboard/model/dashboard.types.ts`
- `src/features/dashboard/components/*`
- `src/features/dashboard/styles/DashboardPage.module.css`

### Backend

- `dashboard/controller/DashboardController.java`
- `dashboard/controller/docs/DashboardControllerDocs.java`
- `dashboard/service/DashboardService.java`
- `dashboard/dto/DashboardSummaryResponse.java`
- `dashboard/service/DashboardServiceTest.java`
