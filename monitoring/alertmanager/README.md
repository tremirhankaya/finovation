# Finovation Alertmanager

Ekip paylaşımına uygun kapsamlı Türkçe mimari ve operasyon dokümanı:
[`Finovation_Alertmanager_Entegrasyon_Dokumani.pdf`](../../output/pdf/Finovation_Alertmanager_Entegrasyon_Dokumani.pdf)

Prometheus evaluates the rules under `monitoring/prometheus/rules` and sends
firing alerts to Alertmanager. Alertmanager groups them and sends `critical`
and `warning` notifications to the Slack `#alerts` channel.

## Configure the Slack webhook

1. In the Finovation Slack workspace, create an Incoming Webhook for `#alerts`.
2. Copy `secrets/slack_webhook_url.example` to `secrets/slack_webhook_url`.
3. Replace the example value with the complete Incoming Webhook URL.

The real `slack_webhook_url` file is ignored by Git and is mounted into the
container as `/run/secrets/alertmanager_slack_webhook_url`.

## Start the monitoring services

```powershell
docker compose up -d alertmanager prometheus grafana
```

The Alertmanager UI is available only on the local machine at
`http://localhost:9093`.

## Validate configuration

```powershell
docker compose run --rm --no-deps --entrypoint /bin/promtool prometheus check config /etc/prometheus/prometheus.yml
docker compose run --rm --no-deps --entrypoint /bin/promtool prometheus test rules /etc/prometheus/tests/application.rules.test.yml
docker compose run --rm --no-deps --entrypoint /bin/amtool alertmanager check-config /etc/alertmanager/alertmanager.yml
```

Use a separate configuration or change `external_labels.environment` in
`monitoring/prometheus/prometheus.yml` before deploying outside the local
Docker Compose environment.
