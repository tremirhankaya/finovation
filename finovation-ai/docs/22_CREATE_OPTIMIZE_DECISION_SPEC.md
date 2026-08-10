# CREATE + OPTIMIZE — Güncel Ürün, ML ve Optimizasyon Karar Belgesi

## 0. Belge durumu

```text
DOCUMENT_ID = 22_CREATE_OPTIMIZE_DECISION_SPEC
DOCUMENT_STATUS = CURRENT_DESIGN_AUTHORITY
IMPLEMENTATION_STATUS = DESIGN_APPROVED_IN_PART_IMPLEMENTATION_PENDING
SUPERSEDES = 21_OPTIMIZE_V2_DECISION_SPEC.md
SYSTEM_DATE = 2025-05-29
FORECAST_ORIGIN = 2025-05-28
UNIVERSE = 58_EQUITIES_PLUS_CASH_TPP
```

Bu belge sıfırdan fon oluşturma (`CREATE`) ile mevcut fonu yeniden düzenleme (`OPTIMIZE`) modüllerinin güncel ürün kararlarını, ML katmanını, matematiksel optimizasyon davranışını, API girdilerini, çıktıları, başarısızlık durumlarını ve açık kararları tek yerde toplar.

Bu belge:

- `21_OPTIMIZE_V2_DECISION_SPEC.md` belgesinin yerine geçer;
- gelecekte yapılacak CREATE/OPTIMIZE V2 uygulaması için bağlayıcı tasarım kaynağıdır;
- mevcut frozen demo uygulamasını kendiliğinden değiştirmez;
- eski artifact'ları veya eski model dosyalarını yeniden yazma yetkisi vermez;
- garanti edilmiş getiri veya global optimum iddiası oluşturmaz.

Çelişki halinde bu belgenin açıkça `LOCKED` olarak işaretlediği yeni kararlar, CREATE/OPTIMIZE V2 tasarımı bakımından eski planlardaki ilgili maddelerin yerine geçer.

## 1. Durum etiketleri

| Etiket | Anlamı |
|---|---|
| `LOCKED` | Kullanıcı tarafından açıkça kesinleştirilmiş karar |
| `PROPOSED` | Teknik öneri; uygulamadan önce doğrulama veya kullanıcı kararı gerekir |
| `OPEN` | Henüz kesinleştirilmemiş karar |
| `REMOVED` | Yeni tasarımdan açıkça çıkarılmış özellik |
| `INTERNAL` | Kullanıcı girdisi değildir; sistem içinde hesaplanır |
| `OUT_OF_SCOPE` | Bu tasarımın yapmayacağı iş |

## 2. Ürün özeti

Sistem iki ayrı fonksiyon sunar:

```text
CREATE
Sıfır portföyden başlayarak 58 hisse ve CASH_TPP içinden yeni fon oluşturur.

OPTIMIZE
Mevcut portföyden başlayarak izin verilen pozisyonları ve ağırlıkları yeniden düzenler.
```

İki modül:

- aynı hisse tahmin servisini;
- aynı TPP carry motorunu;
- aynı risk ve Universe58 beta motorunu;
- aynı sektör metadata'sını;
- aynı hard policy kurallarını;
- aynı açıklama/reason-code altyapısını

kullanır. Ayrı iki ML modeli eğitilmez; farklı olan optimizasyon problem şablonudur.

İzin verilen ürün tanımı:

```text
Olasılıksal tahmin, risk ölçümleri ve fon politika kısıtları altında çalışan karar destek sistemi.
```

Yasak iddialar:

```text
Garantili getiri sağlar.
En iyi portföyü kesin olarak bulur.
Gelecekte kesin kazandırır.
Global optimumu her koşulda bulur.
```

## 3. Yatırım evreni ve veri semantiği

### 3.1 Varlık evreni — `LOCKED`

```text
58 sabit BIST hissesi
+ 1 adet CASH_TPP
= 59 varlık
```

- Evren dışı hisse kabul edilmez.
- CREATE yalnız bu 58 hisseden seçim yapar.
- OPTIMIZE mevcut portföyde evren dışı varlık görürse sessizce silmez veya dönüştürmez.
- TPP, hisse gibi fiyatı tahmin edilen bir varlık değildir.

### 3.2 Hisse hedef semantiği — `LOCKED`

```text
TARGET = SOURCE_PRICE_RETURN
```

- Kaynak OHLC semantiği korunur.
- Equity total-return iddiası yapılmaz.
- Temettü veya kurumsal işlem düzeltmesi optimizer tarafından uygulanmaz.
- Hisse hacmi zorunlu predictor değildir.

### 3.3 TPP semantiği — `LOCKED`

- Ana kaynak düzeltilmiş tek-günlük TPP verisidir.
- Esas oran `weighted_average` alanıdır.
- TPP, ayrı carry/senaryo motorunda horizon getirisine çevrilir.
- Bir günden uzun TPP vade eğrisi kullanılmaz.
- TPP, 58 hisseyle ranker sıralamasına sokulmaz.

### 3.4 Sektör semantiği — `LOCKED`

Her kaynak sektör için:

```text
sektördeki seçili hisselerin toplam ağırlığı <= 0.30
```

- Limit bütün sektörlere ayrı ayrı uygulanır.
- Özel `AVIATION` grubu yoktur.
- THYAO, PGSUS ve TAVHL yalnızca örnek olarak verilmişti; ayrıca tanımlanmış bir havacılık hard kısıtı uygulanmayacaktır.
- Sektör kaynağı `instrument_master.parquet` içindeki kaynak metadata'dır.
- Sektör bilgisi model predictor'ı değil, portföy politika/yoğunlaşma kontrolüdür.
- Kaynak sektör manuel tahminle değiştirilmez.

## 4. Tarih ve point-in-time sözleşmesi

### 4.1 Sunum tarihi — `LOCKED`

```text
SYSTEM_DATE = 2025-05-29
```

29 Mayıs 2025 Perşembe ve BIST işlem günüdür. Aynı gün kapanış verisi gün içinde bilinemez.

Bu nedenle:

```text
FORECAST_ORIGIN = 2025-05-28
FEATURE_AVAILABLE_FROM = 2025-05-29 09:00 Europe/Istanbul
```

29 Mayıs kapanışını kullanan feature satırı ancak 30 Mayıs 2025 sabahı kullanılabilir. CREATE veya OPTIMIZE isteği 29 Mayıs sistem tarihinde çalıştırılırken 29 Mayıs kapanışına bakamaz.

### 4.2 Horizonlar — `LOCKED`

```text
3M
6M
12M
```

Bir yıldan uzun vade ürün kapsamına alınmaz. 9M mevcut araştırma artifact'larında bulunabilse bile ürün girdisi değildir.

28 Mayıs 2025 origin için yaklaşık hedef tarihleri:

```text
3M  -> 2025-08-28
6M  -> 2025-11-28
12M -> 2026-05-28
```

Mevcut equity geçmişi 2025 sonuna kadar olduğu için 3M ve 6M sunumda ex-post karşılaştırılabilir. 12M tahmini aynı sunum origin'i için tam gerçekleşmiş sonuç olarak gösterilemez; geçmiş out-of-sample 12M kanıtı ayrı sunulur.

### 4.3 Leakage yasağı — `LOCKED`

- Eğitimde yalnız `label_target_date <= 2025-05-29` satırları kullanılabilir.
- Feature üretimi yalnız o feature'ın `available_from` zamanında bilinen veriyi kullanır.
- 29 Mayıs sonrasındaki sonuçlar model seçimi, kalibrasyon, optimizer katsayısı veya constraint ayarı için kullanılamaz.
- Performans görüldükten sonra katsayı değiştirilmez.

## 5. Değiştirilemeyen hard kurallar

```text
0.85 <= equity_total <= 0.95
0.05 <= CASH_TPP <= 0.15
0.03 <= selected_equity_weight <= 0.10
16 <= selected_equity_count <= 30
sum(selected_equity_weight where weight > 0.05) < 0.40
every_source_sector_weight <= 0.30
sum(all_weights) = 1.00
```

Ek kurallar:

- Seçilmemiş hissenin ağırlığı tam sıfırdır.
- Seçilmiş her hisse en az `%3` ağırlık taşır.
- Hiçbir hisse `%10`u aşamaz.
- Ağırlığı tam `%5` olan hisse yüksek-ağırlık kovasına girmez; yalnız `%5`i aşan hisseler toplanır ve bu toplam kesin olarak `%40`ın altında kalır.
- Hisse ağırlıkları sürekli ondalık değerlerdir. `%3,27` ve `%7,84` geçerlidir; tam yüzdeye yuvarlama zorunluluğu yoktur. `%2,78` ise yeni `%3` tabanı nedeniyle geçersizdir.
- Kullanıcı sistem sınırlarını gevşetemez.
- Yuvarlanmış çıktı da bütün hard kuralları geçmelidir.
- Çözüm yoksa kısıtlar gevşetilmez; `INFEASIBLE` döndürülür.

### 5.1 Tasarımdan çıkarılan kurallar — `REMOVED`

```text
preferred_tpp_weight
top5_weight_cap
max_downside_risk kullanıcı girdisi
tracking_error
XU100 hedefi veya XU100 geçme olasılığı
özel AVIATION grubu
max_turnover
```

`max_turnover` OPTIMIZE girdisi veya hard constraint değildir. Gerçekleşen portföy değişimi istenirse yalnız tanısal `realized_turnover` metriği olarak raporlanabilir; çözümü sınırlandırmaz.

## 6. Kullanıcı girdileri

### 6.1 CREATE zorunlu girdileri — `LOCKED`

```text
request_id
horizon
min_stock_count
max_stock_count
tpp_min_weight
tpp_max_weight
```

Doğrulama:

```text
horizon in {3M, 6M, 12M}
16 <= min_stock_count <= max_stock_count <= 30
0.05 <= tpp_min_weight <= tpp_max_weight <= 0.15
```

Kullanıcıdan portföy büyüklüğü alınmaz. Yüzdesel ağırlıkların TL tutarına çevrilmesi backend veya arayüz sorumluluğudur.

### 6.2 CREATE opsiyonel girdileri — `LOCKED`

```text
mandatory_assets
excluded_assets
max_universe58_beta
```

Boş değer davranışı:

| Alan | Gelmezse |
|---|---|
| `mandatory_assets` | Hiçbir hisse zorunlu değildir. |
| `excluded_assets` | Model uygunluk kapısını geçen 58 hissenin tamamı aday olabilir. |
| `max_universe58_beta` | Beta hesaplanır ve raporlanır; hard beta üst sınırı uygulanmaz. |

Kurallar:

- Mandatory ve excluded kesişemez.
- Mandatory sayısı `max_stock_count` değerini aşamaz.
- Mandatory bir hisse model/feature uygunluk kapısından geçmiyorsa sessizce eklenmez; açık hata döner.
- Excluded hisseler optimizer aday havuzuna girmez.

### 6.3 OPTIMIZE zorunlu girdileri — `LOCKED`

```text
request_id
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

`current_portfolio`, CASH_TPP dahil mevcut ağırlıkları taşır. `locked_assets`, ağırlığı tam korunacak hisseleri ve mevcut ağırlıklarını taşır.

### 6.4 OPTIMIZE opsiyonel girdileri — `LOCKED`

```text
mandatory_assets
excluded_assets
max_universe58_beta
```

`mandatory_assets` ve `excluded_assets` gelmezse boş küme kabul edilir. Beta sınırı gelmezse beta yalnız hesaplanıp raporlanır.

### 6.5 OPTIMIZE değişim semantiği — `LOCKED`

- Kilitli hissenin üyeliği ve ağırlığı değişmez.
- Kilitli pozisyon diğer ağırlıklar çözülürken toplam, sektör ve beta hesaplarına dahil edilir.
- Kilitli pozisyon hard kuralları çözümü imkânsız yapıyorsa `INFEASIBLE_LOCK_CONFLICT` döner.
- Kilitli olmayan bir hissenin mutlak ağırlık değişimi `max_weight_change_per_asset` değerini aşamaz.
- En fazla `max_additions` yeni hisse eklenebilir.
- En fazla `max_removals` mevcut hisse çıkarılabilir.
- Mandatory mevcut hisse sonuçta kalır fakat ayrıca locked değilse ağırlığı değişebilir.
- Mandatory yeni hisse sonuçta eklenir ve `max_additions` bütçesini tüketir.
- Excluded mevcut hisse sonuçtan çıkarılır ve `max_removals` bütçesini tüketir.
- Excluded mevcut hissenin sıfıra indirilmesi `max_weight_change_per_asset` sınırına tabidir.
- Mandatory/excluded kesişimi ve locked/excluded kesişimi açık hatadır.
- Kullanıcı üyelik isteği herhangi bir izahname veya değişim sınırını sessizce gevşetmez.
- Toplam turnover üst sınırı yoktur.
- Mevcut portföy sessizce normalize edilmez.

## 7. CREATE ve OPTIMIZE arasındaki kesin fark

### 7.1 CREATE

```text
Başlangıç portföyü yoktur.
58 hisseden seçim ve ağırlıklandırma sıfırdan yapılır.
Mevcut pozisyon, kilit, ekleme veya çıkarma maliyeti yoktur.
```

### 7.2 OPTIMIZE

```text
Başlangıçta current_portfolio vardır.
Kilitli ağırlıklar tam korunur.
Diğer pozisyonlar per-asset değişim sınırıyla düzenlenir.
Ekleme ve çıkarma sayısı sınırlıdır.
Mevcut ve önerilen ağırlık farkları raporlanır.
```

OPTIMIZE tarafında bütün kilitler, per-asset değişim sınırları ve ekleme/çıkarma sınırları kaldırılırsa problem CREATE'e yaklaşır. Bu nedenle iki modu ayıran temel unsurlar mevcut portföy ve değişim kontrolüdür.

## 8. ML tahmin katmanı

### 8.1 İncelenen aday paket

```text
C:\Users\ertun\Desktop\ml_best_models\05_lightgbm_2019_07_rolling_bagging_raw_challenger
```

Paket:

- 64 predictor kullanır;
- `SOURCE_PRICE_RETURN` log getirisini hedefler;
- 3/6/9/12 ay modelleri içerir;
- q05/q10/q25/q50/q75/q90/q95 üretir;
- row bagging kullanan LightGBM quantile modellerinden oluşur.

Ürün tarafında yalnız:

```text
3M:  q10, q50, q90
6M:  q10, q50, q90
12M: q10, q50, q90
```

gerekir. q05/q25/q75/q95 ürün kontratına alınmaz.

### 8.2 Mevcut paketin kullanım durumu

```text
RESEARCH_CHALLENGER = GO
DIRECT_2025-05-29_FINAL_REFIT_USE = NO_GO
```

Nedenler:

1. Mevcut final-refit modeller Mayıs 2025 sonrasında olgunlaşan etiketleri görmüştür.
2. 3M q50 modeli bazı kritik tarihlerde bütün hisselere aynı veya neredeyse aynı tahmini verir.
3. 6M sabit testte cross-sectional sıralama gücü zayıf/negatiftir.
4. 12M mevcut pakette en güçlü sıralama adaydır fakat cutoff-safe yeniden refit gerektirir.
5. Tam yedi quantile'da crossing yüksektir; ürün yalnız core q10/q50/q90 kullanmalıdır.

### 8.3 Cutoff-safe yeniden refit — `REQUIRED`

Her horizon için:

```text
training_start_date >= 2019-07-01
label_target_date <= 2025-05-29
forecast_origin = 2025-05-28
```

koşullarıyla yeni artifact üretilir. Eski `final_refit` dosyaları sunum tahmini için kopyalanmaz.

### 8.4 Quantile crossing politikası — `LOCKED`

```text
q10 <= q50 <= q90
```

- Core crossing varsa ilgili hisse-vade tahmini uygun değildir.
- Crossing sessizce sıralanıp düzeltilmez.
- `predict_raw.py` ile açıklama katmanı aynı politikayı kullanmalıdır.
- SHAP açıklaması gösterilen gerçek ham q50 modeline ait olmalıdır.

### 8.5 Model uygunluk kapısı — `INTERNAL`

Kullanıcı model güven eşiği seçmez. Sistem her horizon artifact'ını şu kapılardan geçirir:

- PIT ve label maturity kontrolü;
- 58 hisse feature uygunluğu;
- q10/q50/q90 crossing kontrolü;
- quantile calibration ve coverage;
- tarih bazlı cross-sectional sıralama korelasyonu;
- üst-alt hisse grubu gerçekleşen getiri farkı;
- naive baseline karşılaştırması;
- fold/regime istikrarı;
- deterministik tekrar üretim;
- feature schema ve model schema uyumu.

Bir horizon geçmezse o horizon sessizce risk-only veya sabit tahmin moduna çevrilmez. İstek açık `MODEL_HORIZON_NOT_ELIGIBLE` hatası alır veya ürün seçeneklerinden horizon kaldırılır.

## 9. Ranker kararı

### 9.1 Amaç — `PROPOSED / GATE_REQUIRED`

Quantile model mutlak getiri dağılımını tahmin eder. Portföy seçimi ayrıca aynı tarihteki 58 hissenin göreli sıralamasına ihtiyaç duyabilir.

Önerilen ek model:

```text
3M LightGBM Ranker
6M LightGBM Ranker
12M LightGBM Ranker
objective = lambdarank
group = as_of_date
```

Ranker çıktısı getiri yüzdesi değildir. Yalnız göreli seçim skoru ve percentile üretir.

### 9.2 Eğitim etiketi

Her tarih ve horizon için 58 hissenin gelecekte gerçekleşen `SOURCE_PRICE_RETURN` değerleri sıralanır. Hisseler göreli getiri dilimlerine ayrılarak relevance etiketi oluşturulur.

Ranker şu soruyu öğrenir:

```text
O tarihte bilinen feature'lara göre hangi hisseler aynı evrendeki diğer hisselerden daha üst sırada kalabilir?
```

### 9.3 Kullanım koşulu

Ranker yalnız aşağıdaki testleri geçerse CREATE/OPTIMIZE aday seçimine bağlanır:

- tarih bazlı IC pozitif ve istikrarlı;
- top-k eksi bottom-k gerçekleşen getiri farkı pozitif;
- naive momentum sıralamasından daha iyi veya tamamlayıcı;
- farklı yıllarda aynı yönde davranış;
- cutoff-safe eğitim;
- mandatory/eligible ticker semantiğiyle uyum.

Geçemezse sisteme eklenmez. Ranker kullanımı henüz otomatik olarak `LOCKED` değildir.

### 9.4 Ranker bağlanırsa çıktı

```json
{
  "instrument_id": "MGROS.E",
  "horizon": "6M",
  "q10": -0.07,
  "q50": 0.21,
  "q90": 0.55,
  "rank_score": 2.84,
  "rank_percentile": 0.94,
  "universe58_beta": 0.73,
  "model_eligible": true
}
```

Quantile model beklenen dağılımı, ranker göreli seçimi, risk motoru ise portföy etkisini temsil eder.

## 10. TPP carry motoru

TPP, LightGBM'in hisse tahminlerinde makro predictor olarak bulunabilir; ancak CASH_TPP yatırım getirisini ayrı motor üretir.

Akış:

```text
tek-günlük weighted_average oranı
-> kaynak day-count ve faiz semantiği
-> günlük carry
-> 3M/6M/12M birikimli senaryo
-> optimizer için CASH_TPP utility
```

Kullanıcı yalnız TPP aralığı verir. Örneğin:

```text
0.07 <= CASH_TPP <= 0.14
```

`preferred_tpp_weight` yoktur. Optimizer TPP ağırlığını verilen aralık içinde:

- equity tahminleri;
- TPP carry;
- portföy riski;
- Universe58 beta sınırı;
- diğer hard kurallar

altında serbestçe belirler.

## 11. Universe58 beta motoru

XU100 kullanılmaz. Referans:

```text
UNIVERSE58 = 58 hissenin eşit ağırlıklı ortak getiri serisi
```

Hisse betası:

```text
beta_i = Cov(r_i, r_universe58) / Var(r_universe58)
```

Portföy betası:

```text
portfolio_beta = sum(equity_weight_i * beta_i)
CASH_TPP beta = 0
```

`max_universe58_beta` gönderilirse hard üst sınırdır. Gönderilmezse beta yalnız raporlanır. Beta getiri tahmini veya kayıp garantisi değildir; 58 hisselik ortak harekete duyarlılığı ölçer.

## 12. Risk ve utility katmanı

Kullanıcı `max_downside_risk` parametresi vermez. Buna rağmen sistem risk hesaplamayı bırakmaz.

İç risk motoru:

- cutoff-safe günlük getiriler;
- kovaryans/shrinkage covariance;
- volatilite;
- hisse bazlı risk contribution;
- Universe58 beta;
- quantile belirsizlik genişliği

üretir.

Optimizer objective katsayıları kullanıcıya gizli rastgele değerler değildir. Versiyonlanmış config içinde sabitlenir ve performans görüldükten sonra değiştirilmez.

Ranker bağlanmadıysa equity utility quantile tahminleri ve risk ölçümlerinden oluşur. Ranker bağlandıysa relative rank katkısı ayrıca açık katsayıyla eklenir. Rank skoru doğrudan getiri yüzdesi gibi yorumlanmaz.

## 13. CREATE çözüm akışı

1. Request schema ve horizon kontrolü.
2. Sistem tarihinden doğru PIT feature origin seçimi.
3. Model horizon eligibility kontrolü.
4. Mandatory ve excluded doğrulaması.
5. 58 hisse için q10/q50/q90 inference.
6. Onaylanırsa ranker inference.
7. TPP carry hesaplaması.
8. Kovaryans ve Universe58 beta hesaplaması.
9. Hard constraint preflight.
10. Hisse seçimi ve continuous ağırlık çözümü.
11. Deterministik local improvement/swap.
12. Yuvarlanmış ağırlıkların yeniden validasyonu.
13. Reason-code ve lineage çıktısı.

CREATE, mevcut portföye bakmaz ve sıfırdan seçim yapar.

## 14. OPTIMIZE çözüm akışı

1. Current portfolio schema ve sum-to-one kontrolü.
2. Universe dışı varlık ve mevcut policy ihlali kontrolü.
3. Kilitli pozisyonların exact ağırlık doğrulaması.
4. Mandatory/excluded ve locked/excluded çakışma kontrolü.
5. Zorunlu ekleme/çıkarma işlemlerinin membership ve delta bütçesi preflight'ı.
6. Horizon/model eligibility kontrolü.
7. Mevcut ve aday hisseler için forecast/rank/risk hesaplaması.
8. Zorunlu üyelikler sabitlenerek kalan ekleme ve çıkarma limitleriyle aday üyelik oluşturulması.
9. Per-asset ağırlık değişim sınırıyla continuous çözüm.
10. Hard constraint validasyonu.
11. Mevcut/önerilen/delta tablosu.
12. Mandatory/addition/removal/locked reason-code üretimi.
13. Tanısal realized turnover hesabı; hard sınır değildir.

Mevcut portföy geçersizse sessiz normalize yapılmaz. Gerekirse ayrı ve açık bir `REPAIR` modu gelecekte tasarlanabilir; mevcut kontratın parçası değildir.

## 15. Alternatif portföy çıktıları

### 15.1 CREATE — `PROPOSED`

İki farklı, geçerli ve açık objective kimliğine sahip alternatif önerilir:

```text
RETURN_FOCUSED
ROBUST_RISK_CONTROLLED
```

İki çözüm yalnız kozmetik olarak farklılaştırılmaz. Objective katsayıları ve sonuç gerekçesi açıkça raporlanır.

### 15.2 OPTIMIZE — `PROPOSED`

Üç farklı çözüm ailesi değerlendirilebilir:

```text
RETURN_FOCUSED
BALANCED_UTILITY
ROBUST_RISK_CONTROLLED
```

XU100 odaklı alternatif yoktur. Kullanıcıdan muhafazakâr/dengeli/agresif gibi belirsiz profil sorulmaz. Alternatifler backend objective tanımlarıdır.

Kesin alternatif sayısı ve objective katsayıları uygulama öncesi freeze edilmelidir.

## 16. Örnek CREATE isteği

```json
{
  "request_id": "create-20250529-001",
  "horizon": "6M",
  "min_stock_count": 16,
  "max_stock_count": 20,
  "tpp_min_weight": 0.07,
  "tpp_max_weight": 0.14,
  "mandatory_assets": ["ASELS.E"],
  "excluded_assets": ["FENER.E", "GSRAY.E"],
  "max_universe58_beta": 0.95
}
```

## 17. Örnek OPTIMIZE isteği

```json
{
  "request_id": "optimize-20250529-001",
  "horizon": "6M",
  "current_portfolio": {
    "AKBNK.E": 0.08,
    "THYAO.E": 0.09,
    "ASELS.E": 0.07,
    "CASH_TPP": 0.08
  },
  "locked_assets": {
    "THYAO.E": 0.09,
    "ASELS.E": 0.07
  },
  "mandatory_assets": ["TCELL.E"],
  "excluded_assets": ["GSRAY.E"],
  "min_stock_count": 16,
  "max_stock_count": 20,
  "tpp_min_weight": 0.07,
  "tpp_max_weight": 0.12,
  "max_weight_change_per_asset": 0.03,
  "max_additions": 4,
  "max_removals": 3,
  "max_universe58_beta": 0.95
}
```

Örnekte kısaltılmış `current_portfolio` yalnız sözleşme gösterimidir; gerçek istek bütün mevcut pozisyonları ve toplam `%100` ağırlığı içermelidir.

## 18. Ortak çıktı sözleşmesi

```text
request_id
mode
system_date
forecast_origin
horizon
solution_status
solution_method
global_optimum_claim
model_artifact_id
ranker_artifact_id_if_used
tpp_config_id
risk_config_id
objective_config_id
weights
selected_equity_count
equity_total
tpp_weight
sector_exposures
large_position_assets
large_position_total_weight
universe58_beta
forecast_summary
risk_summary
constraint_checks
reason_codes
warnings
artifact_lineage
```

OPTIMIZE ek çıktıları:

```text
current_weights
optimized_weights
weight_deltas
locked_positions
added_assets
removed_assets
increased_assets
decreased_assets
unchanged_assets
realized_turnover_diagnostic
```

Çözüm heuristic ise:

```text
solution_method = DETERMINISTIC_HEURISTIC
global_optimum_claim = false
```

## 19. Açıklama ve reason-code katmanı

ML modeli doğrudan serbest metin yazmaz. Önce sayısal kanıt ve reason-code üretir.

Hisse forecast reason-code örnekleri:

```text
HIGH_RELATIVE_RANK
POSITIVE_MEDIAN_FORECAST
WIDE_FORECAST_INTERVAL
LOW_UNIVERSE58_BETA
HIGH_IDIOSYNCRATIC_RISK
MODEL_INELIGIBLE
```

Optimizer reason-code örnekleri:

```text
ADDED_FOR_FORECAST_UTILITY
INCREASED_WITHIN_CHANGE_CAP
REDUCED_FOR_SECTOR_CAP
REDUCED_FOR_BETA_CAP
LOCKED_BY_MANAGER
EXCLUDED_BY_MANAGER
TPP_SELECTED_WITHIN_USER_RANGE
REMOVED_LOW_RELATIVE_UTILITY
```

SHAP açıklaması model atfıdır; ekonomik nedensellik veya getiri garantisi değildir. LLM yalnız kontrollü reason-code ve sayısal alanları doğal dile dönüştürür; yeni finansal gerekçe uyduramaz.

## 20. Başarısızlık ve infeasibility kodları

```text
INVALID_REQUEST_SCHEMA
INVALID_HORIZON
INVALID_STOCK_COUNT_RANGE
INVALID_TPP_RANGE
TICKER_NOT_IN_UNIVERSE
MANDATORY_EXCLUDED_CONFLICT
MANDATORY_COUNT_EXCEEDS_MAX
MANDATORY_ASSET_MODEL_INELIGIBLE
MODEL_HORIZON_NOT_ELIGIBLE
FEATURE_SNAPSHOT_NOT_AVAILABLE
QUANTILE_CROSSING_REJECTED
CURRENT_PORTFOLIO_INVALID
LOCKED_ASSET_NOT_IN_PORTFOLIO
INFEASIBLE_LOCK_CONFLICT
INFEASIBLE_SECTOR_CAP
INFEASIBLE_LARGE_POSITION_CAP
INFEASIBLE_BETA_CAP
INFEASIBLE_SELECTION
INFEASIBLE_WEIGHT_CHANGE_CAP
INFEASIBLE_ADDITION_REMOVAL_LIMIT
ROUNDED_SOLUTION_INVALID
SOLVER_FAILED
```

Hata halinde:

- constraint gevşetilmez;
- mandatory hisse sessizce atılmaz;
- TPP aralığı sessizce değiştirilmez;
- stock count aralığı değiştirilmez;
- model uygun değilken başka horizon tahmini kullanılmaz;
- başarısız çözüm başarılı gibi gösterilmez.

## 21. Determinizm ve randomizasyon

```text
Aynı input + aynı artifact/config kimlikleri = aynı sonuç
```

- Rastgele jitter kullanılmaz.
- Tie-break sırası configte açıktır.
- Solver seed/thread davranışı sabitlenir.
- Aynı isteğin tekrarında farklı portföy üretmek ürün özelliği değildir.
- Alternatif portföy isteniyorsa farklı ve açık objective kimlikleri kullanılır; gizli randomizasyon kullanılmaz.

## 22. Rounding

1. İç çözüm yüksek hassasiyetle saklanır.
2. Gösterim ağırlıkları belirlenen decimal hassasiyete yuvarlanır.
3. Sum-to-one farkı deterministik largest-remainder yöntemiyle düzeltilir.
4. Yuvarlanmış portföy bütün hard kısıtlardan tekrar geçer.
5. Geçmiyorsa daha yüksek gösterim hassasiyeti kullanılır veya hata dönülür.

## 23. Minimum test matrisi

### 23.1 PIT ve model

- Sistem tarihi 29 Mayısken origin 28 Mayıs olmalı.
- 29 Mayıs kapanışı kullanılamamalı.
- Eğitim etiketlerinin target tarihi cutoff'u aşmamalı.
- 58 hisse feature-eligible olmalı.
- q10 <= q50 <= q90 sağlanmalı.
- Crossing satırı sessiz projection görmemeli.
- Model horizon eligibility gate çalışmalı.
- Ranker eklenirse OOF IC ve top-bottom spread kapısı geçmeli.

### 23.2 CREATE

- Stock count 16, 20 ve 30 sınırları.
- TPP `%5` ve `%15` sınırları.
- Kullanıcı TPP alt-aralığı.
- Mandatory/excluded.
- Mandatory/excluded çakışması.
- Her sektör `%30` kontrolü.
- Tek hisse `%3–10` kontrolü ve ondalık ağırlık desteği.
- `%5`i aşan hisselerin toplamının kesin `<%40` kontrolü; tam `%5` ağırlığın toplama alınmaması.
- Beta sınırı var/yok.
- Deterministik tekrar.

### 23.3 OPTIMIZE

- Exact locked ağırlık.
- Per-asset değişim sınırı.
- Addition/removal sınırı.
- Mandatory mevcut/yeni hisse davranışı.
- Excluded mevcut/yeni hisse davranışı.
- Mandatory/excluded ve locked/excluded çakışması.
- Zorunlu üyelik değişikliklerinin addition/removal ve per-asset delta bütçesini tüketmesi.
- Turnover hard cap bulunmadığının testi.
- Mevcut portföy invalid.
- Kilit yüzünden infeasible.
- Sektör ve beta yüzünden infeasible.
- Mevcut/önerilen/delta tutarlılığı.

### 23.4 Ortak

- Sum-to-one.
- Equity `%85–95`.
- TPP `%5–15` ve kullanıcı alt-aralığı.
- Hisse `%3–10`; ondalık ağırlıklar korunur.
- Stock count `16–30`.
- `%5`i aşan hisselerin toplamı kesin `<%40`.
- Her sektör maksimum `%30`.
- Yuvarlanmış çözüm validasyonu.
- No silent relaxation.
- Açık solution method ve lineage.

## 24. Uygulama sırası

1. Bu belgeye göre API ve policy kontratlarını güncelle.
2. 29 Mayıs PIT snapshot ve 28 Mayıs feature origin'ini doğrula.
3. LightGBM q10/q50/q90 modellerini cutoff-safe yeniden refit et.
4. Horizon bazında kalibrasyon ve cross-sectional seçim kapılarını çalıştır.
5. Ranker deneyini ayrı OOF protokolüyle çalıştır; geçmezse bağlama.
6. TPP carry ve Universe58 beta motorlarını dondur.
7. CREATE solver şablonunu uygula.
8. OPTIMIZE solver şablonunu `max_turnover` olmadan uygula.
9. Reason-code ve açıklama katmanını bağla.
10. PIT, constraint, determinism ve infeasibility testlerini çalıştır.
11. Sunum case'ini ancak bütün model ve optimizer ayarları freeze edildikten sonra aç.

## 25. Açık kararlar

Aşağıdakiler uygulamadan önce ayrıca freeze edilmelidir:

1. Ranker kullanılacak mı, yoksa quantile modeller sıralama kapısını tek başına geçecek mi?
2. CREATE kesin olarak iki alternatif mi üretecek?
3. OPTIMIZE kesin olarak üç alternatif mi üretecek?
4. Alternatif objective katsayıları ne olacak?
5. `max_universe58_beta` için kullanıcı aralığı ve gösterim dili ne olacak?
6. `max_weight_change_per_asset` için kabul edilen aralık ne olacak?
7. `max_additions` ve `max_removals` üst sınırları ne olacak?
8. `DECIDED`: Deterministik continuous active-set heuristic kullanılacak; mixed-integer/global optimum iddiası kurulmayacak.
9. Model eligibility eşikleri hangi OOF sonuçlarıyla dondurulacak?

Bu açık kararlar çözülmeden üretim/demoya yönelik yeni optimizer artifact'ı `FINAL` olarak etiketlenmez.

## 26. Bağlayıcı karar özeti

```text
CREATE ve OPTIMIZE aynı forecast/risk/TPP servislerini kullanır.
CREATE sıfırdan portföy seçer.
OPTIMIZE mevcut portföyden başlar ve kilit/değişim limitlerini uygular.
Max turnover yoktur.
XU100 ve tracking error yoktur.
Preferred TPP yoktur.
Top-5 cap yoktur.
Kullanıcı downside hard limiti yoktur.
Özel aviation grubu yoktur.
Her kaynak sektör maksimum %30'dur.
Tek hisse %3–10, hisse sayısı 16–30, hisse toplamı %85–95, TPP %5–15'tir.
Ağırlığı %5'i aşan hisselerin toplamı kesin olarak %40'ın altındadır; tam %5 bu toplama dahil değildir.
Hisse ağırlıkları tam yüzdeye zorlanmaz; sürekli ondalık değerler korunur.
Kullanıcı TPP alt-aralığı verebilir.
Sistem tarihi 2025-05-29, kullanılabilir origin 2025-05-28'dir.
Mevcut LightGBM final-refit modeli doğrudan kullanılamaz; cutoff-safe refit gerekir.
Ranker faydalı bir adaydır fakat OOF gate geçmeden bağlanmaz.
Constraintler sessizce gevşetilmez.
Başarılı heuristic sonuç global optimum diye sunulmaz.
```
