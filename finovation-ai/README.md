# ML Fund Engine V3 dosya paketi

Bu klasör, `2025-05-29` sistem tarihine ve `2025-05-28` forecast origin tarihine dondurulmuş mevcut model/CREATE/OPTIMIZE çalışmasının taşınabilir servis paketidir.

Python HTTP API V1 artık bu klasör içinde `api/` altında bulunur. API mevcut model/optimizer matematiğini değiştirmeden dondurulmuş snapshot'ı HTTP/JSON üzerinden sunar.

Yerel çalıştırma:

```powershell
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

OpenAPI: `http://127.0.0.1:8000/openapi.json`

İnteraktif dokümantasyon: `http://127.0.0.1:8000/docs`

Java teslim rehberi: `contracts/JAVA_INTEGRATION_GUIDE.md`

## Pakette bulunanlar

- `artifacts/forecast_bundle_v3/`: aktif 3, 6 ve 12 aylık LightGBM model dosyaları, V3 manifesti ve 58 hisse için dondurulmuş tahmin tablosu.
- `artifacts/risk/`: 58 hisseye ait Universe58 beta ve Ledoit-Wolf kovaryans tabloları.
- `artifacts/tpp/`: 1 günlük TPP oranından üretilmiş 3/6/12 aylık carry senaryoları.
- `configs/`: sistem tarihi, model seçimi ve portföy/izahname kuralları.
- `data/source/instrument_master.parquet`: 58 hisseyi ve kaynak sektör metadata'sını tanımlayan master tablo.
- `data/source/predictors.json`: feature sözleşmesi.
- `data/processed/inference_features.parquet`: 2025-05-28 forecast origin için 58 hisselik model girdi snapshot'ı.
- `src/fund_ml/`: mevcut Python model, tahmin ve CREATE/OPTIMIZE kaynak kodunun kopyası.
- `examples/` ve `outputs/examples/`: örnek istekler ile daha önce üretilmiş örnek çıktılar.
- `reports/`: V3 model değerlendirme özeti, veri/PIT manifesti ve artifact hash kayıtları.

## Veriler hangi dosyalardan geldi?

| Bileşen | Çalışmada kullanılan kaynak | Bu paketteki karşılığı |
|---|---|---|
| Hisse OHLC | `C:\Users\ertun\Desktop\ml_model_data_2\00_data_factory_v2\data\canonical\equity_prices.parquet` | Ham OHLC kopyalanmadı; bundan türetilen model ve tahmin artifact'ları yer alıyor. |
| 2017-07 strict hisse kaynağı | `C:\Users\ertun\Desktop\ml_model_data_2\_ml_fund_engine_v3_forecast_lab\data\source\equity_prices.parquet` | Eğitim datası olarak kopyalanmadı. Bu dosya, canonical OHLC'nin `2017-07-01` alt sınırı uygulanmış sürümüdür. |
| Eğitim label'ları | `C:\Users\ertun\Desktop\ml_model_data_2\_ml_fund_engine_v3_forecast_lab\data\source\labels_source_price_return.parquet` | Kopyalanmadı; yeniden eğitim için gerekir. |
| 1 günlük TPP | `C:\Users\ertun\Desktop\ml_model_data_2\_ml_fund_engine_v3_forecast_lab\data\source\tpp_day1.csv` | Ham CSV kopyalanmadı; çalışma anındaki carry sonucu `artifacts/tpp/` altında bulunuyor. |
| Hisse/sektör master | `C:\Users\ertun\Desktop\ml_model_data_2\00_data_factory_v2\data\canonical\instrument_master.parquet` | `data/source/instrument_master.parquet` |
| Feature sözleşmesi | `...\_ml_fund_engine_v3_forecast_lab\data\source\predictors.json` | `data/source/predictors.json` |
| Model girdi snapshot'ı | `...\_ml_fund_engine_v3_forecast_lab\data\processed\inference_features.parquet` | `data/processed/inference_features.parquet` |

Canonical `instrument_master.parquet` ile paketteki kopya byte-level aynı SHA-256 değerine sahiptir. Strict source raporuna göre canonical equity dosyasının SHA-256 değeri `43a6ce05...b6b82b`, strict filtrelenmiş çalışma kopyasının değeri `0f90c040...74bdbf`'dir. Ayrıntılar `reports/strict_source_summary.json` ve `reports/strict_source_report.md` içindedir.

## Eğitim datası neden pakette yok?

Mevcut, dondurulmuş CREATE/OPTIMIZE akışını çalıştırmak için geçmiş eğitim tabloları gerekmez; motor hazır `equity_forecasts.parquet`, risk, TPP ve sektör artifact'larını okur. Ham OHLC, label ve horizon eğitim tabloları yalnız modeli yeniden eğitmek veya yeni bir tarih için feature/tahmin üretmek gerektiğinde gerekir.

## SHAP durumu

Mevcut proje içinde üretilmiş gerçek bir SHAP değer dosyası bulunmamaktadır. LightGBM model metinlerinde standart feature-importance bilgisi vardır; bu SHAP değildir. CREATE/OPTIMIZE çıktılarındaki `reason_codes` ve `reason_texts` de SHAP değildir. Bu nedenle bu pakete SHAP adı altında yapay veya yanlış bir dosya eklenmemiştir.
