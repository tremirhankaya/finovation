# OPTIMIZE mandatory/excluded doğrulama raporu

```text
VALIDATION_DATE = 2026-08-08
API_BASE = http://127.0.0.1:8002
SNAPSHOT_ID = FROZEN_2025-05-29_V3
POLICY_CONFIG_ID = PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS
```

## Uygulanan davranış

- `mandatory_assets` OPTIMIZE request'ine opsiyonel alan olarak eklendi.
- `excluded_assets` OPTIMIZE request'ine opsiyonel alan olarak eklendi.
- Mandatory mevcut hisse final portföyde korunur, fakat ayrıca locked değilse ağırlığı değişebilir.
- Mandatory yeni hisse final portföye eklenir ve addition bütçesini tüketir.
- Excluded mevcut hisse final portföyden çıkarılır ve removal bütçesini tüketir.
- Excluded mevcut olmayan hisse aday havuzuna alınmaz.
- Locked/excluded ve mandatory/excluded çakışmaları açık hata verir.
- Zorunlu üyelik değişiklikleri per-asset delta ve membership limitlerini sessizce aşamaz.
- Response şeması büyütülmedi; eski istemci alanları korunuyor.

## Geçerli gerçek HTTP senaryosu

Temel request: `examples/optimize_request.json`

Değiştirilen alanlar:

```json
{
  "request_id": "http-valid-membership-001",
  "mandatory_assets": ["NETAS.E", "TCELL.E"],
  "excluded_assets": ["AEFES.E", "FENER.E"],
  "max_weight_change_per_asset": 0.065,
  "max_additions": 2,
  "max_removals": 2
}
```

HTTP sonucu: `200 OK`

| Objective | Mandatory mevcut | Excluded yok | Eklenen | Çıkarılan | Hisse | Equity | TPP | Maks. hisse | Maks. sektör | >%5 toplam | Maks. delta | Locked ASELS |
|---|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| RETURN_FOCUSED | Evet | Evet | CIMSA.E, NETAS.E | AEFES.E, TTRAK.E | 17 | %87 | %13 | %10 | %10,0001 | %39,9999 | %6,5 | %6,5 |
| BALANCED_UTILITY | Evet | Evet | CIMSA.E, NETAS.E | AEFES.E | 18 | %87 | %13 | %9,5326 | %14,5326 | %39,9999 | %6,5 | %6,5 |
| ROBUST_RISK_CONTROLLED | Evet | Evet | CIMSA.E, NETAS.E | AEFES.E | 18 | %87 | %13 | %9,3440 | %16,2322 | %39,9999 | %6,5 | %6,5 |

Bütün alternatiflerde:

- weight toplamı `1.0`;
- NETAS.E ve TCELL.E `weights` içinde;
- AEFES.E ve FENER.E `weights` dışında;
- NETAS.E ve TCELL.E reason listesinde `MANDATORY_ASSET`;
- AEFES.E `removed_assets` içinde ve deltası `-0.065`;
- locked ASELS.E exact `0.065`;
- izahname sınırları geçerli.

## Hata ve geriye uyumluluk HTTP senaryoları

| Senaryo | HTTP | Error code / sonuç |
|---|---:|---|
| Mandatory ve excluded aynı TCELL.E | 422 | `MANDATORY_EXCLUDED_OVERLAP` |
| Locked ASELS.E aynı zamanda excluded | 422 | `LOCKED_EXCLUDED_OVERLAP` |
| Yeni mandatory NETAS.E, `max_additions=0` | 422 | `MAX_ADDITIONS_CONSTRAINT_CONFLICT` |
| Mevcut AEFES.E excluded, `max_removals=0` | 422 | `MAX_REMOVALS_CONSTRAINT_CONFLICT` |
| Mevcut AEFES.E `%6,5`, delta limiti `%3` | 422 | `MAX_WEIGHT_CHANGE_CONSTRAINT_CONFLICT` |
| Empty mandatory/excluded listeleri | 200 | 3 eski objective, geriye uyumlu |
| Mevcut hisselerden biri `%3` altı | 422 | `CURRENT_PORTFOLIO_POLICY_VIOLATION` |
| `%5`i aşan hisselerin toplamı tam `%40` | 422 | `CURRENT_PORTFOLIO_POLICY_VIOLATION` |

## Otomatik test kanıtı

Komut:

```powershell
$env:PYTHONPATH='src;.'
python -B -m pytest -p no:cacheprovider -q
```

Sonuç:

```text
39 passed
```

Testler CREATE regresyonunu, eski boş-listeli OPTIMIZE sonucunu, yeni membership kurallarını, hata kodlarını, OpenAPI alanlarını ve bütün izahname sınırlarını kapsar.
