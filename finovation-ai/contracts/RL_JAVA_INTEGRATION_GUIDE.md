# RL Inference Java Entegrasyonu

Bu bundle mevcut CREATE ve OPTIMIZE endpointlerini değiştirmeden üçüncü bir iş endpointi ekler:

`POST /api/v1/rl/inference`

İstemci yalnızca model adı, sabit senaryo adı, başlangıç NAV değeri ve 17 varlığın başlangıç ağırlıklarını gönderir. Checkpointler, konfigürasyonlar, 20 seanslık warm-up için gerekli OHLC/FX/TPP/takvim verileri ve izahname kuralları bundle içinde yer alır.

## Desteklenen model adları

- `PPO_MARKET_BASELINE`
- `PPO_STRESS_CONTEXT`
- `PPO_ASSET_IMPACT`
- `PPO_ADAPTIVE_RECOVERY`

## Desteklenen senaryolar

- `SCENARIO_1_2025_03_17`: 2025-03-17 ile 2025-05-05, 32 işlem günü
- `SCENARIO_2_2025_08_26`: 2025-08-26 ile 2025-10-17, 39 işlem günü

İstemci tarih veya veri dosyası göndermez. Warm-up model tarafından içeride kullanılır ve response içindeki günlere dahil edilmez.

## Request

Tam örnek: `contracts/examples/rl-inference-request.json`

`initial_weights` tam olarak 16 hisse ile `CASH_TPP` anahtarını içermeli, toplamı `1.0` olmalı ve izahname kurallarına uymalıdır. Servis iç tarafta `CASH_TPP` değerini modelin `TPP_ON` sembolüne dönüştürür.

## Response

Tam örnek: `contracts/examples/rl-inference-response.json`

Her `days` elemanı aşağıdakileri döner:

- `day_number`: warm-up hariç senaryo işlem günü sırası
- `date`: model kararının uygulandığı gerçek işlem tarihi
- `total_new_nav`: komisyon dahil RL portföyü gün sonu NAV değeri
- `passive_nav`: aynı başlangıç portföyünü hiç değiştirmeyen pasif fonun NAV değeri
- `weights`: RL portföyünün gün sonu izahnameye uygun 16 hisse + TPP ağırlıkları

Tek tek işlemler response'a eklenmez. Komisyon model NAV hesabına dahildir ve yalnızca `total_commission` olarak özetlenir.

## Hata davranışı

- `422`: JSON, varlık kümesi, toplam ağırlık veya izahname doğrulaması başarısız
- `503`: gömülü RL model/veri paketi yüklenemedi
- `500`: beklenmeyen servis hatası

Başarılı RL response body içinde `request_id` veya `status` bulunmaz. Çağıran sistem kendi korelasyon kimliğini yönetebilir. Mevcut servisin standart hata zarfı geriye uyumluluk için `request_id` ve `status: ERROR` alanlarını kullanmaya devam eder. İstenirse mevcut API altyapısındaki `X-Request-Id` header'ı taşınır.
