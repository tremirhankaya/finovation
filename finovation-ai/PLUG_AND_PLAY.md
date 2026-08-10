# Üç Endpointli ML Fund Engine Bundle

Bu klasör tek FastAPI sürecinde üç ana iş endpointini sunar:

1. `POST /api/v1/portfolios/create`
2. `POST /api/v1/portfolios/optimize`
3. `POST /api/v1/rl/inference`

Mevcut CREATE/OPTIMIZE motoru ve artifactleri kaynak bundle'dan aynen alınmıştır. RL eklentisi ayrı route, ayrı runtime ve ayrı artifact ağacı kullanır.

## İlk kurulum

Python sözleşmesi mevcut servisle aynı tutulmuştur: Python `3.11.x`.

```powershell
powershell -ExecutionPolicy Bypass -File .\setup_api.ps1
```

## Çalıştırma

```powershell
powershell -ExecutionPolicy Bypass -File .\start_api.ps1 -Port 8000
```

- Swagger: `http://127.0.0.1:8000/docs`
- OpenAPI: `http://127.0.0.1:8000/openapi.json`
- Liveness: `http://127.0.0.1:8000/health/live`
- Readiness: `http://127.0.0.1:8000/health/ready`

RL request örneği `examples/rl_inference_request.json`, Java açıklaması `contracts/RL_JAVA_INTEGRATION_GUIDE.md` altındadır.

## Paketlenen RL girdileri

- Dört PPO checkpointi ve model başına çözülmüş config
- `equity_prices.parquet`
- `fx_daily.parquet`
- `tpp_overnight_observed.parquet`
- `trading_calendar.parquet`
- `instrument_master.parquet`
- Model/veri SHA-256 sözleşmesi: `configs/rl_model_registry.json`

Bu dosyalar nedeniyle RL çağrısı sırasında Yahoo Finance, dosya yolu, tarih veya başka bir veri servisi gerekmez.
