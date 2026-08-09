# OPTIMIZE mandatory/excluded üyelik sözleşmesi

## Amaç

OPTIMIZE artık kullanıcıdan iki ayrı üyelik tercihi kabul eder:

- `mandatory_assets`: sonuç portföyünde mutlaka bulunacak hisseler.
- `excluded_assets`: sonuç portföyünde kesinlikle bulunmayacak hisseler.

Bu tercihler izahname kurallarının alternatifi değildir. Motor, üyelik isteğini mevcut portföy değişim sınırları ve bütün sabit izahname kurallarıyla aynı anda sağlayabiliyorsa sonuç üretir. Sağlayamıyorsa hiçbir sınırı sessizce gevşetmez ve açık hata döndürür.

## Locked ile mandatory farkı

| Alan | Sonuçta bulunur mu? | Ağırlığı değişebilir mi? | Mevcut portföyde bulunmak zorunda mı? |
|---|---:|---:|---:|
| `locked_assets` | Evet | Hayır, exact ağırlık korunur | Evet |
| `mandatory_assets` | Evet | Evet, diğer hard limitler içinde | Hayır |
| `excluded_assets` | Hayır | Son ağırlık tam sıfırdır | Hayır |

Bir hisse hem locked hem mandatory olabilir; locked semantiği daha güçlüdür. Bir hisse locked ve excluded olamaz.

## Üyelik bütçesi

- Mevcut portföyde olmayan mandatory hisse bir addition sayılır.
- Mevcut portföyde olan excluded hisse bir removal sayılır.
- Bu zorunlu işlemler önce `max_additions` ve `max_removals` bütçesinden düşülür.
- Kalan bütçe optimizer'ın kendi seçebileceği ek ekleme/çıkarma işlemleri için kullanılır.
- Zorunlu addition sayısı bütçeyi aşarsa `MAX_ADDITIONS_CONSTRAINT_CONFLICT` döner.
- Zorunlu removal sayısı bütçeyi aşarsa `MAX_REMOVALS_CONSTRAINT_CONFLICT` döner.

## Tek-varlık değişim sınırı

`max_weight_change_per_asset` bütün varlıklar için hard sınırdır:

- Yeni bir mandatory hisse en az izahname minimumu olan `%3` ağırlık almalıdır. Delta limiti `%3`ten küçükse eklenemez.
- Mevcut bir excluded hissenin sıfırlanması için delta limiti en az mevcut ağırlığı kadar olmalıdır.
- Örnek: mevcut ağırlık `%6,5`, delta limiti `%3` ise hisse excluded yapılamaz; motor limiti aşarak çıkarmaz.

## Uygulama sırası

1. Request alanları ve 58 hisse evreni doğrulanır.
2. Mandatory/excluded ve locked/excluded kesişimleri reddedilir.
3. Mevcut portföyün toplamı ve izahname uyumu doğrulanır; sessiz normalizasyon yapılmaz.
4. Zorunlu addition/removal sayısı ve delta fizibilitesi kontrol edilir.
5. Mandatory hisseler final aday kümesine sabitlenir; excluded hisseler aday kümesinden çıkarılır.
6. Kalan membership bütçesiyle objective bazlı deterministik adaylar oluşturulur.
7. Continuous ağırlık çözümü bütün izahname kısıtlarıyla çalıştırılır.
8. Sonuç tekrar üyelik, delta, locked ve izahname kontrollerinden geçirilir.

## Her sonuçta korunan izahname kuralları

- Hisse toplamı `%85–%95`.
- `CASH_TPP` `%5–%15` ve kullanıcının gönderdiği daha dar aralık içinde.
- Her seçili hisse `%3–%10`.
- Seçili hisse sayısı `16–30` ve request aralığı içinde.
- Her sektör toplamı en fazla `%30`.
- Ağırlığı tam `%5` olanlar dahil edilmeden, `%5`i aşan hisselerin toplamı kesin olarak `<%40`.
- Opsiyonel beta cap geldiyse Universe58 beta bu üst sınırı aşmaz.
- Locked ağırlık exact korunur.
- Addition/removal sayıları ve bütün mutlak weight delta değerleri request limitlerini aşmaz.

## Response doğrulama

Response şeması büyütülmemiştir. Mevcut alanlarla doğrulama yapılır:

- Mandatory hisse `weights` içinde bulunur ve `reason_codes` içinde `MANDATORY_ASSET` taşır.
- Excluded hisse `weights` içinde bulunmaz.
- Mevcut bir excluded hisse çıkarıldıysa `removed_assets` ve negatif `deltas` içinde görünür.
- Yeni mandatory hisse eklendiyse `added_assets` ve pozitif `deltas` içinde görünür.
- `locked_assets`, `sector_exposures`, `large_position_total_weight`, `stock_count`, `equity_weight`, `tpp_weight` ve `universe58_beta` diğer hard kontrolleri destekler.

## Hata matrisi

| Durum | HTTP | Kod |
|---|---:|---|
| Mandatory ve excluded kesişiyor | 422 | `MANDATORY_EXCLUDED_OVERLAP` |
| Locked ve excluded kesişiyor | 422 | `LOCKED_EXCLUDED_OVERLAP` |
| Zorunlu yeni hisseler addition limitini aşıyor | 422 | `MAX_ADDITIONS_CONSTRAINT_CONFLICT` |
| Zorunlu çıkarılacak hisseler removal limitini aşıyor | 422 | `MAX_REMOVALS_CONSTRAINT_CONFLICT` |
| Zorunlu ekleme/çıkarma delta limitine sığmıyor | 422 | `MAX_WEIGHT_CHANGE_CONSTRAINT_CONFLICT` |
| Üyelikler ve bütün hard kurallar birlikte çözülemiyor | 422 | `INFEASIBLE_OPTIMIZE` |

## Geriye uyumluluk

İki alan da opsiyoneldir. Alanların hiç gönderilmemesi veya boş liste gönderilmesi önceki OPTIMIZE davranışıyla aynıdır. Mevcut response JSON alanları değiştirilmemiştir.
