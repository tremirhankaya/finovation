# RL API Delivery Manifest

- Bundle contract: Python 3.11, FastAPI 0.141.1
- Existing business endpoints preserved: CREATE and OPTIMIZE
- Added endpoint: `POST /api/v1/rl/inference`
- Packaged PPO runtime: Stable-Baselines3 2.9.0, Torch 2.13.0 CPU
- Packaged policies: 4
- Fixed scenarios: 2
- Packaged RL input parquet files: 5
- External TPP code: `CASH_TPP`
- Internal PPO TPP code: `TPP_ON`
- Warm-up: 20 return sessions / 21 close observations, internal only
- Daily success response: day number, execution date, RL NAV, passive NAV, 17 legal weights
- Individual trade list: intentionally omitted
- Internet/Yahoo dependency at inference: none
- Artifact integrity: SHA-256 validation at RL runtime startup
- Regression result: 46 tests passed
- Live smoke result: health READY; CREATE 2 alternatives; OPTIMIZE 3 alternatives; RL S1 32 days

The Python 3.12 training checkpoints contain serialized learning-rate and clip-range closures. The Python 3.11 inference loader replaces only those unused training schedules with constants. Network parameters, observation/action spaces and deterministic policy outputs remain unchanged.
