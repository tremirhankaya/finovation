# Java KDS — Python ML Servisi API V1 Entegrasyon Rehberi

## 1. Kapsam

Bu API yalnız aşağıdaki dondurulmuş snapshot ile çalışır:

```text
snapshot_id     = FROZEN_2025-05-29_V3
system_date     = 2025-05-29
forecast_origin = 2025-05-28
model_bundle    = EQUITY_FORECAST_BUNDLE_V3
policy_config   = PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS
```

Java tarafı fiyat, feature, tarih veya model dosyası göndermez. Yalnız kullanıcı tercihlerini ve OPTIMIZE için mevcut portföyü gönderir.

## 2. Base URL ve endpoint'ler

Ortam tarafından sağlanacak örnek base URL:

```text
http://ml-fund-engine:8000
```

Endpoint'ler:

```text
GET  /health/live
GET  /health/ready
GET  /api/v1/metadata
GET  /api/v1/forecasts?horizon=3M|6M|12M
POST /api/v1/portfolios/create
POST /api/v1/portfolios/optimize
GET  /openapi.json
GET  /docs
```

## 3. Header'lar

İsteklerde:

```text
Content-Type: application/json
Accept: application/json
X-Request-Id: <benzersiz-istek-id>
X-Expected-Model-Snapshot: FROZEN_2025-05-29_V3
```

`X-Expected-Model-Snapshot` opsiyoneldir ancak entegrasyonda gönderilmesi önerilir. Aktif snapshot farklıysa API `409 SNAPSHOT_MISMATCH` döndürür.

Body içindeki `request_id` ile `X-Request-Id` birlikte gönderilirse aynı olmalıdır. Farklıysa API `409 REQUEST_ID_MISMATCH` döndürür.

Response header'ları:

```text
X-API-Version
X-Model-Snapshot
X-Model-Bundle
X-Policy-Config
X-Request-Id
```

## 4. Decimal ve yüzde semantiği

API ağırlıkları 0–1 decimal olarak alır ve döndürür:

```text
0.03 = %3
0.075 = %7,5
0.10 = %10
```

JSON sayılarında nokta kullanılır. Java tarafında hesap ve kalıcı kayıt için `BigDecimal` kullanılması önerilir. UI gösterimi için yüzdeye çevrilen ve yuvarlanan değerler daha sonraki hesaplarda ham ağırlığın yerine kullanılmamalıdır.

Python servisi portföy toplamını sessizce normalize etmez. OPTIMIZE `current_portfolio` toplamı tolerans içinde tam `1.0` olmalıdır.

## 5. CREATE

Tam request:

```text
contracts/examples/create-request.json
```

Tam response:

```text
contracts/examples/create-response.json
```

Zorunlu alanlar:

```text
horizon
min_stock_count
max_stock_count
tpp_min_weight
tpp_max_weight
```

Opsiyonel alanlar:

```text
request_id
mandatory_assets
excluded_assets
max_universe58_beta
```

CREATE iki alternatif döndürür:

```text
RETURN_FOCUSED
ROBUST_RISK_CONTROLLED
```

## 6. OPTIMIZE

Tam request:

```text
contracts/examples/optimize-request.json
```

Tam response:

```text
contracts/examples/optimize-response.json
```

Önemli alanlar:

- `current_portfolio`: `CASH_TPP` dahil mevcut tam portföy.
- `locked_assets`: mevcut ağırlığı kesin korunacak varlıklar.
- `mandatory_assets`: sonuçta bulunması zorunlu hisseler. Mevcut hissede ağırlık değişebilir; yeni hisse `max_additions` bütçesini tüketir.
- `excluded_assets`: sonuçta bulunması yasak hisseler. Mevcut hisseyi çıkarmak `max_removals` ve `max_weight_change_per_asset` sınırlarına tabidir.
- `max_weight_change_per_asset`: tek varlık için en yüksek mutlak ağırlık değişimi.
- `max_additions`: eklenebilecek en fazla yeni hisse.
- `max_removals`: çıkarılabilecek en fazla mevcut hisse.
- `max_universe58_beta`: opsiyonel portföy beta hard cap.

`mandatory_assets` ve `excluded_assets` opsiyoneldir; gelmezse boş liste kabul edilir. Semantik kurallar:

- Aynı hisse iki listede birden bulunamaz.
- `locked_assets` içindeki bir hisse `excluded_assets` içinde olamaz.
- `locked_assets` tam ağırlığı korur; `mandatory_assets` yalnız üyeliği korur.
- Mevcut olmayan mandatory hisse bir ekleme, mevcut excluded hisse bir çıkarma sayılır.
- Bu zorunlu değişiklikler caller'ın gönderdiği ekleme, çıkarma ve tek-varlık değişim limitlerini aşarsa servis açık `422` hatası döndürür; limiti sessizce gevşetmez.
- Kullanıcı üyelik tercihleri bütün sabit izahname kurallarıyla birlikte çözülür. Geçerli ortak çözüm yoksa `INFEASIBLE_OPTIMIZE` döner.

OPTIMIZE üç alternatif döndürür:

```text
RETURN_FOCUSED
BALANCED_UTILITY
ROBUST_RISK_CONTROLLED
```

## 7. Sabit politika kuralları

Bu alanlar request ile değiştirilemez:

```text
Equity toplamı                    %85–%95
CASH_TPP                         %5–%15
Tek seçili hisse                 %3–%10
Seçili hisse sayısı              16–30
Her sektör toplamı               en fazla %30
Ağırlığı %5'i aşan hisseler      toplam kesin olarak <%40
```

Aktif sınırlar `/api/v1/metadata` response'unda da bulunur.

## 8. Response işleme

Java aşağıdaki alanları iş kaydıyla birlikte saklamalıdır:

```text
request_id
snapshot_id
system_date
forecast_origin
model_bundle_id
policy_config_id
mode
alternatives
processing_time_ms
```

`reason_codes` stabil makine kodlarıdır. `reason_texts` kontrollü Türkçe karşılıklarıdır. Bunlar SHAP veya ekonomik nedensellik olarak yorumlanmamalıdır.

`solution_class` değeri motorun deterministik heuristic/local-search kullandığını ve global optimum garantisi vermediğini açıklar.

## 9. Hata işleme

Tam hata örneği:

```text
contracts/examples/error-response.json
```

HTTP statüleri:

```text
200  başarılı
400  bozuk JSON
409  snapshot çakışması
422  validation, politika veya feasibility hatası
500  beklenmeyen servis hatası
503  runtime bundle hazır değil
```

Java karar verirken `error.message` metnini ayrıştırmamalıdır. Kontrol `error.code` üzerinden yapılmalıdır.

Retry başlangıç politikası:

- `400`, `409` ve `422` otomatik retry edilmez.
- `500` tekrar eden bir iç hata olarak kaydedilir; kör retry yapılmaz.
- `503` sınırlı backoff ile yeniden denenebilir.
- Ağ timeout'unda aynı `request_id` ve aynı body kullanılmalıdır.

İlk test ortamında read timeout `60 saniye` seçilebilir; kesin production değeri CREATE/OPTIMIZE p95 yük testi sonrasında belirlenmelidir.

## 10. Entegrasyon kabul akışı

1. `GET /health/live` → `200`
2. `GET /health/ready` → `200`
3. `GET /api/v1/metadata` → beklenen snapshot ve 58 hisse
4. CREATE örneği → iki alternatif
5. OPTIMIZE örneği → üç alternatif
6. Bilinmeyen alan → `422 UNKNOWN_REQUEST_FIELD`
7. Yanlış snapshot header'ı → `409 SNAPSHOT_MISMATCH`
8. Aynı request → aynı iş sonucu
9. Java ve Python loglarında `request_id` eşleşmesi
10. OPTIMIZE mandatory hisse sonuçta mevcut, excluded hisse sonuçta yok
11. Mandatory/excluded, locked/excluded ve değişim bütçesi çakışmaları → açık `422` hata kodu

Makine tarafından okunabilir bağlayıcı sözleşme:

```text
contracts/openapi-v1.json
```
