# Python ML Servisi API V1 Uygulama Planı

## 0. Bağlayıcı kapsam ve varsayımlar

Bu plan yalnız mevcut dondurulmuş model snapshot'ını Java ile geliştirilen KDS sistemine HTTP/JSON üzerinden sunmak içindir.

Bağlayıcı çalışma durumu:

```text
snapshot_id     = FROZEN_2025-05-29_V3
system_date     = 2025-05-29
forecast_origin = 2025-05-28
model_bundle    = EQUITY_FORECAST_BUNDLE_V3
policy_config   = PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS
```

Bu ilk kapsamda:

- Java piyasa verisi, feature veya tarih göndermez.
- Python servisi yeni feature veya tahmin üretmez; hazır V3 tahmin/risk/TPP artifact'larını kullanır.
- CREATE iki, OPTIMIZE üç alternatifi birlikte döndürür.
- Aynı snapshot ve aynı request her zaman aynı sonucu üretir.
- Eğitim datası servis paketine eklenmez.
- Gerçek SHAP üretilmez; mevcut reason code ve sayısal kanıtlar kullanılır.
- Veri tabanı, Docker, dış ağ güvenliği ve yeni piyasa snapshot endpoint'leri ilk altı bölümün dışındadır.

Servis kökü mevcut klasör olacaktır:

```text
C:\Users\ertun\Desktop\ml_model_data_2\ml_fund_engine_deployment_bundle
```

---

## 1. Runtime bundle'ı read-only ve startup-safe hale getirme

### Amaç

Python servisi trafik almadan önce modelin ihtiyaç duyduğu bütün artifact'ları bir defa yüklemeli ve doğrulamalıdır. Request sırasında model, parquet veya config dosyaları yeniden okunmamalıdır.

### Kullanılacak mevcut dosyalar

```text
configs/project.json
configs/objectives.json
artifacts/forecast_bundle_v3/manifest.json
artifacts/forecast_bundle_v3/equity_forecasts.parquet
artifacts/risk/manifest.json
artifacts/risk/universe58_beta.parquet
artifacts/risk/covariance.parquet
artifacts/tpp/manifest.json
artifacts/tpp/tpp_scenarios.parquet
data/source/instrument_master.parquet
```

Model metin dosyaları pakette korunur ancak dondurulmuş CREATE/OPTIMIZE sırasında doğrudan çalıştırılmaz; hazır `equity_forecasts.parquet` kullanılır.

### Yapılacaklar

1. API uygulaması başlarken `EngineBundles.load(root)` tam bir kez çağrılır.
2. Yüklenen bundle uygulama ömrü boyunca immutable kabul edilir.
3. Aşağıdaki startup kontrolleri uygulanır:
   - Forecast schema `EQUITY_FORECAST_BUNDLE_V3` olmalı.
   - Manifest sistem tarihi `configs/project.json` ile aynı olmalı.
   - Forecast tablosu 174 satır olmalı: 58 hisse × 3 horizon.
   - Her horizonda tam 58 benzersiz hisse bulunmalı.
   - Her satırda `q10 <= q50 <= q90` olmalı.
   - V3 q50 differentiation gate geçmeli.
   - Beta evreni tam 58 hisse olmalı.
   - Kovaryans matrisi 58 × 58 olmalı.
   - TPP tablosunda yalnızca ve tam olarak 3/6/12 ay bulunmalı.
   - Instrument master tam 58 core equity içermeli.
4. Kontroller bitmeden readiness `false` kalır.
5. Eksik veya bozuk artifact durumunda servis başlamış olsa bile karar endpoint'leri trafik kabul etmez.
6. Request sırasında hiçbir runtime artifact'ına yazılmaz.

### Üretilecek uygulama bileşenleri

```text
api/runtime.py
api/lifecycle.py
api/settings.py
```

### Testler

- Geçerli bundle yükleme testi
- Eksik forecast dosyası testi
- Yanlış sistem tarihi testi
- Eksik hisse testi
- Bozuk kovaryans şekli testi
- Bundle'ın request'ler arasında tekrar yüklenmediği testi

### Tamamlanma ölçütü

```text
RUNTIME_BUNDLE_LOAD = PASS
READ_ONLY_RUNTIME = PASS
READY_ONLY_AFTER_VALIDATION = PASS
```

---

## 2. FastAPI servis katmanı

### Amaç

Mevcut `PortfolioEngine` davranışını değiştirmeden ince bir HTTP adaptörü oluşturmak.

### Endpoint'ler

```text
POST /api/v1/portfolios/create
POST /api/v1/portfolios/optimize
GET  /api/v1/forecasts?horizon=3M|6M|12M
GET  /api/v1/metadata
GET  /health/live
GET  /health/ready
```

### Endpoint davranışları

#### `/health/live`

- Python işlemi cevap verebiliyorsa `200` döner.
- Model bundle hazır olmasa bile process canlıysa bu endpoint başarılı olabilir.

#### `/health/ready`

- Bütün artifact doğrulamaları geçtiyse `200` döner.
- Bundle yüklenememişse `503` döner.

#### `/api/v1/metadata`

Şunları döndürür:

- API sürümü
- Snapshot ID
- Sistem tarihi ve forecast origin
- Model bundle ve policy config ID
- Desteklenen horizon'lar
- 58 hisse listesi
- Hard politika limitleri
- CREATE/OPTIMIZE alternatif türleri

#### `/api/v1/forecasts`

- Tek horizon için 58 hisse tahminini döndürür.
- `simple_q10`, `simple_q50`, `simple_q90`, rank ve model artifact kimliklerini içerir.
- Portföy üretmez.

#### CREATE ve OPTIMIZE

- API yalnız request doğrulama, motor çağrısı ve response serileştirmesi yapar.
- Portföy matematiği `PortfolioEngine` içinde kalır.
- Endpoint aynı body ile deterministik sonuç üretir.
- Hesaplama CPU-bound olduğu için handler senkron tanımlanır; event loop içinde ağır hesap çalıştırılmaz.

### Önerilen klasörler

```text
api/
  __init__.py
  main.py
  lifecycle.py
  runtime.py
  settings.py
  routes/
    health.py
    metadata.py
    forecasts.py
    portfolios.py
```

### Testler

- Uygulamanın geçerli bundle ile açılması
- Altı endpoint'in route tablosunda bulunması
- Health live/ready ayrımı
- CREATE çağrısının mevcut Python motoruyla aynı sonucu üretmesi
- OPTIMIZE çağrısının mevcut Python motoruyla aynı sonucu üretmesi
- Aynı request'in iki çağrıda byte-semantik olarak aynı iş sonucunu üretmesi

### Tamamlanma ölçütü

```text
HTTP_ADAPTER = PASS
ENGINE_BEHAVIOR_UNCHANGED = PASS
HEALTH_AND_METADATA = PASS
```

---

## 3. Katı request şemaları ve iş doğrulaması

### Amaç

Java'nın göndereceği JSON sözleşmesini kesinleştirmek; bilinmeyen alanları, geçersiz ağırlıkları ve uygulanamaz istekleri sessizce düzeltmeden reddetmek.

Pydantic modellerinde bilinmeyen alanlar yasaklanacaktır:

```text
extra = forbid
```

NaN, Infinity, negatif ağırlık ve locale virgüllü sayı kabul edilmeyecektir.

### CREATE request

Zorunlu:

```text
horizon
min_stock_count
max_stock_count
tpp_min_weight
tpp_max_weight
```

Opsiyonel:

```text
request_id
mandatory_assets
excluded_assets
max_universe58_beta
```

Kurallar:

- Horizon yalnız `3M`, `6M`, `12M`.
- Hisse sayısı aralığı sistemin 16–30 sınırında kalmalı.
- TPP aralığı sistemin %5–%15 sınırında kalmalı.
- Mandatory ve excluded kesişemez.
- Yalnız exact 58 ticker kabul edilir.
- Mandatory sayısı `max_stock_count` değerini aşamaz.
- Beta cap varsa pozitif olmalı.
- `as_of_date`, model feature'ı, fiyat veya portföy değeri kabul edilmez.

### OPTIMIZE request

Zorunlu:

```text
horizon
current_portfolio
locked_assets
min_stock_count
max_stock_count
tpp_min_weight
tpp_max_weight
max_weight_change_per_asset
max_additions
max_removals
```

Opsiyonel:

```text
request_id
mandatory_assets
excluded_assets
max_universe58_beta
```

Kurallar:

- `current_portfolio` içinde `CASH_TPP` bulunmalı.
- Portföy toplamı tolerans içinde tam `1.0` olmalı; sessiz normalize edilmemeli.
- Mevcut portföy ilk sürümde hard policy ile uyumlu olmalı.
- Locked varlık current portfolio içinde bulunmalı.
- Locked ağırlık current portfolio ağırlığıyla tam eşleşmeli.
- Değişim limiti pozitif olmalı.
- Addition/removal limitleri negatif olamaz.
- Mandatory ve excluded kesişemez.
- Locked ve excluded kesişemez.
- Mevcut olmayan mandatory hisseler `max_additions`, mevcut excluded hisseler `max_removals` limitini tüketir.
- Excluded mevcut hissenin çıkarılması ve mandatory yeni hissenin eklenmesi per-asset değişim sınırına uymalıdır.
- Bütün ağırlıklar 0–1 decimal semantiğinde olmalı.

### İki katmanlı doğrulama

1. API/Pydantic: JSON tipi ve basit cross-field kuralları.
2. Domain engine: evren, politika, feasibility ve optimizer sonucu.

API katmanı domain doğrulamasını kopyalayıp farklılaştırmamalıdır. Domain motoru son otorite olmaya devam eder.

### Üretilecek dosyalar

```text
api/schemas/common.py
api/schemas/create.py
api/schemas/optimize.py
api/schemas/forecast.py
```

### Test matrisi

- Geçerli CREATE
- Geçerli OPTIMIZE
- Bilinmeyen alan
- Geçersiz horizon
- Eksik zorunlu alan
- Mandatory/excluded çakışması
- Bilinmeyen ticker
- Portföy toplamı 1 değil
- Locked ağırlık uyuşmazlığı
- Geçersiz TPP aralığı
- Geçersiz hisse sayısı
- Negatif/NaN/Infinity ağırlık
- Feasible olmayan request

### Tamamlanma ölçütü

```text
STRICT_JSON_CONTRACT = PASS
NO_SILENT_NORMALIZATION = PASS
DOMAIN_ENGINE_FINAL_AUTHORITY = PASS
```

---

## 4. Response ve standart hata sözleşmesi

### Amaç

Java tarafının metin ayrıştırmadan sonucu ve hatayı güvenilir şekilde işlemesini sağlamak.

### Başarılı response üst alanları

Her iş response'unda bulunacak:

```text
request_id
api_version
mode
snapshot_id
system_date
forecast_origin
model_bundle_id
policy_config_id
processing_time_ms
alternatives
```

Her alternatifte korunacak temel alanlar:

```text
objective_id
horizon
weights
stock_count
equity_weight
tpp_weight
expected_model_utility_log
horizon_volatility
universe58_beta
sector_exposures
large_position_assets
large_position_total_weight
objective_value
reason_codes
reason_texts
solution_class
```

OPTIMIZE alternatiflerine ayrıca:

```text
deltas
added_assets
removed_assets
locked_assets
realized_turnover_diagnostic
```

### Sayı ve ağırlık semantiği

- API 0–1 decimal ağırlık döndürür.
- UI yüzdesi Java tarafında gösterim amaçlı hesaplanır.
- API sonucu içinde `NaN` veya `Infinity` bulunamaz.
- Hesap için ham ağırlık saklanır; ekranda yuvarlanmış değer geri beslenmez.
- Python response üretirken ağırlıkları sessizce yeniden normalize etmez.

### Gerekçe semantiği

- `reason_codes` makine tarafından okunacak stabil kodlardır.
- `reason_texts` bu kodların kontrollü Türkçe karşılıklarıdır.
- Bu alanlar SHAP veya ekonomik nedensellik olarak adlandırılmaz.
- Response'taki utility, volatility, beta, sector exposure ve değişim değerleri sayısal kanıt olarak korunur.

### Hata zarfı

```json
{
  "request_id": "optimize-001",
  "status": "ERROR",
  "error": {
    "code": "PORTFOLIO_SUM_INVALID",
    "message": "Current portfolio weights must sum to 1.0.",
    "details": {
      "received_sum": 0.97,
      "expected_sum": 1.0
    }
  },
  "snapshot_id": "FROZEN_2025-05-29_V3"
}
```

### HTTP statüleri

```text
200  başarılı
400  bozuk JSON
409  snapshot/request kimliği çakışması
422  validation veya infeasible business request
500  beklenmeyen iç hata
503  runtime bundle hazır değil
```

### Stabil hata kodları

```text
MALFORMED_JSON
UNKNOWN_REQUEST_FIELD
MISSING_REQUIRED_FIELD
INVALID_HORIZON
UNKNOWN_ASSET
MANDATORY_EXCLUDED_OVERLAP
LOCKED_EXCLUDED_OVERLAP
MAX_ADDITIONS_CONSTRAINT_CONFLICT
MAX_REMOVALS_CONSTRAINT_CONFLICT
MAX_WEIGHT_CHANGE_CONSTRAINT_CONFLICT
STOCK_COUNT_OUT_OF_RANGE
TPP_RANGE_OUT_OF_RANGE
PORTFOLIO_SUM_INVALID
CURRENT_PORTFOLIO_POLICY_VIOLATION
LOCKED_WEIGHT_MISMATCH
MODEL_HORIZON_NOT_ELIGIBLE
INFEASIBLE_CREATE
INFEASIBLE_OPTIMIZE
SNAPSHOT_MISMATCH
RUNTIME_NOT_READY
INTERNAL_ERROR
```

### UTF-8

- Request ve response `application/json; charset=utf-8` kullanır.
- Türkçe reason text değerleri entegrasyon testinde kontrol edilir.
- Java tarafına mojibake içeren response verilmemesi golden test ile doğrulanır.

### Tamamlanma ölçütü

```text
STABLE_SUCCESS_SCHEMA = PASS
STABLE_ERROR_SCHEMA = PASS
UTF8_TURKISH = PASS
NO_NAN_OR_INFINITY = PASS
```

---

## 5. Snapshot, model ve policy sürüm kilidi

### Amaç

Her sonucun hangi veri, model ve izahname kurallarıyla üretildiğini tartışmasız şekilde kaydetmek.

### Sürüm alanları

```text
api_version      = v1
snapshot_id      = FROZEN_2025-05-29_V3
model_bundle_id  = EQUITY_FORECAST_BUNDLE_V3
policy_config_id = PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS
system_date      = 2025-05-29
forecast_origin  = 2025-05-28
```

`snapshot_id`, manifest ve config değerlerinden startup sırasında doğrulanır. Birbirleriyle uyuşmayan dosyalarla servis ready durumuna geçmez.

### Response header'ları

JSON body'ye ek olarak önerilen header'lar:

```text
X-API-Version: v1
X-Model-Snapshot: FROZEN_2025-05-29_V3
X-Model-Bundle: EQUITY_FORECAST_BUNDLE_V3
X-Policy-Config: PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS
X-Request-Id: <request_id>
```

### Beklenen snapshot kontrolü

Java isterse şu request header'ını gönderebilir:

```text
X-Expected-Model-Snapshot: FROZEN_2025-05-29_V3
```

- Header yoksa aktif tek snapshot kullanılır.
- Header aktif snapshot ile aynıysa request çalışır.
- Farklıysa `409 SNAPSHOT_MISMATCH` döner.

Bu kontrol body şemasını kirletmeden Java'nın yanlış model sürümüne istek atmasını engeller.

### Artifact güncelleme politikası

- Aktif bundle dosyaları yerinde değiştirilmez.
- Yeni sürüm gelecekte yeni snapshot klasörü olarak yayınlanır.
- Eski snapshot audit ve rollback için korunur.
- Bir request başladığında kullandığı snapshot request sonuna kadar değişmez.
- İlk sürümde yalnız tek aktif snapshot vardır.

### İdempotency

- `request_id` Java tarafından benzersiz üretilir.
- Aynı request ID ve aynı body deterministik olarak aynı iş sonucunu üretir.
- Aynı request ID farklı body ile kullanılırsa ileride idempotency store eklenerek `409` döndürülebilir.
- İlk altı bölümde kalıcı idempotency veritabanı kurulmaz; Java iş kaydının ana sahibidir.

### Testler

- Metadata ve response sürümlerinin eşleşmesi
- Doğru expected snapshot header'ı
- Yanlış expected snapshot header'ı
- Manifest/config tarih uyuşmazlığı
- Aynı request'in stabil sonucu

### Tamamlanma ölçütü

```text
SNAPSHOT_TRACEABILITY = PASS
MODEL_POLICY_VERSION_TRACEABILITY = PASS
SNAPSHOT_MISMATCH_PROTECTION = PASS
```

---

## 6. OpenAPI sözleşmesi ve Java ekibine teslim

### Amaç

Java ekibine sözlü tarif yerine makine tarafından okunabilen, örnekleri ve hata şemaları olan sabit bir API sözleşmesi vermek.

### Üretilecek sözleşme

FastAPI tarafından oluşturulan OpenAPI şeması sabit dosya olarak export edilir:

```text
contracts/openapi-v1.json
```

Runtime sırasında ayrıca:

```text
GET /openapi.json
GET /docs
```

sunulur. Üretim ortamında interaktif `/docs` kapatılabilir; `openapi-v1.json` entegrasyon sözleşmesi olarak kalır.

### OpenAPI içinde bulunması gerekenler

- Bütün endpoint'ler
- CREATE ve OPTIMIZE request şemaları
- Başarılı response şemaları
- Standart error envelope
- Enum horizon değerleri
- 0–1 decimal ağırlık açıklaması
- Request ve response örnekleri
- Her alanın zorunlu/opsiyonel durumu
- HTTP statüleri
- Snapshot header'ları
- Türkçe ve İngilizce teknik açıklamalar

### Java entegrasyon rehberi

```text
contracts/JAVA_INTEGRATION_GUIDE.md
```

İçerik:

1. Base URL ve endpoint listesi
2. Header'lar
3. CREATE tam request/response örneği
4. OPTIMIZE tam request/response örneği
5. Error örnekleri
6. Decimal ve yüzde semantiği
7. Timeout/retry için başlangıç önerileri
8. Request ID kullanımı
9. Snapshot doğrulaması
10. Java'nın saklaması gereken response alanları

### Contract örnekleri

```text
contracts/examples/create-request.json
contracts/examples/create-response.json
contracts/examples/optimize-request.json
contracts/examples/optimize-response.json
contracts/examples/error-response.json
```

Örnek response'lar canlı motor çağrısından üretilecek; elle uydurulmayacaktır.

### Contract testleri

- `openapi-v1.json` üretilebiliyor mu?
- OpenAPI içinde bütün endpoint'ler var mı?
- Örnek request şemaya uyuyor mu?
- Canlı response declared response modeline uyuyor mu?
- Bilinmeyen request alanı dokümana uygun reddediliyor mu?
- Türkçe JSON Java'nın standart UTF-8 parser'ıyla uyumlu mu?
- Golden CREATE/OPTIMIZE sonuçları mevcut motor çıktısıyla aynı mı?

### Java ekibiyle kabul testi

1. Java `/health/ready` çağırır.
2. Java `/metadata` ile snapshot ve kuralları okur.
3. Java örnek CREATE gönderir.
4. Python iki alternatif döndürür.
5. Java örnek OPTIMIZE gönderir.
6. Python üç alternatif döndürür.
7. Java 422 business error'ı doğru işler.
8. Java yanlış snapshot header'ında 409'u doğru işler.
9. Request ID Java kayıtları ile Python loglarında eşleşir.

### Tamamlanma ölçütü

```text
OPENAPI_V1_FROZEN = PASS
JAVA_GUIDE_COMPLETE = PASS
JAVA_CONTRACT_SMOKE_TEST = PASS
```

---

## Uygulama sırası ve genel bitiş kapısı

Sıra değiştirilmeyecektir:

```text
1. Runtime bundle lock
2. FastAPI adapter
3. Request schemas
4. Response/error schemas
5. Version and snapshot lock
6. OpenAPI and Java handoff
```

İlk altı bölümün genel bitiş kriteri:

```text
API_V1_FROZEN_SNAPSHOT_GATE = GO
```

Bu gate için:

- Model ve optimizer matematiği değişmemeli.
- Mevcut CREATE/OPTIMIZE golden sonuçları korunmalı.
- Servis yalnız doğrulanmış bundle ile ready olmalı.
- Request/response ve hata sözleşmeleri katı olmalı.
- Bütün sonuçlarda snapshot/model/policy sürümü bulunmalı.
- OpenAPI ve Java entegrasyon rehberi gerçek çalışan servisle uyumlu olmalı.
