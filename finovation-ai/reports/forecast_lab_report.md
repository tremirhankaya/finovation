# Forecast Improvement Lab V3

## Sonuç

| horizon   | champion                                 | features   |   predictors |   dev_pinball |   holdout_pinball |   holdout_coverage80 |   holdout_q50_unique_median |   late_pinball | all_gates   |
|:----------|:-----------------------------------------|:-----------|-------------:|--------------:|------------------:|---------------------:|----------------------------:|---------------:|:------------|
| 3M        | ROLLING_BAGGED_HUBER_Q50                 | FULL       |           49 |      0.068714 |          0.058065 |             0.826105 |                   20.500000 |       0.063830 | True        |
| 6M        | EMPIRICAL_INTERVAL_TWO_STAGE_ROLLING_Q50 | FULL       |           59 |      0.099034 |          0.076372 |             0.851064 |                   47.000000 |       0.096803 | True        |
| 12M       | EMPIRICAL_INTERVAL_TWO_STAGE_ROLLING_Q50 | FULL       |           49 |      0.143055 |          0.121109 |             0.756724 |                   47.000000 |     nan        | True        |

## Bağlayıcı düzeltmeler

- Common holdout hiçbir modelde early stopping veya iterasyon seçimi için kullanılmadı.
- İterasyonlar yalnız development fold'larından donduruldu.
- q50 sert kapısı ranker'dan bağımsızdır; q50 başarısızsa horizon paketlenmez.
- q10/q90 proper-score bozulması ayrıca sınırlandı.
- Quantile sorting, clipping veya projection uygulanmadı.

## Denenen aileler

Fixed-ES quantile, ayrı Huber q50, short-history, rolling bagging, Universe58+residual iki aşama ve development-weighted LightGBM/CatBoost ensemble.