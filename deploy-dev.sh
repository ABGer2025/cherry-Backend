#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="cherry-backend"
PROJECT_ID="cherry-mvp"
REGION="europe-west2"
CURSOR_SECRET_NAME="USER_PRODUCTS_CURSOR_KEY"

ENV_VARS="NODE_ENV=production,FIREBASE_PROJECT_ID=${PROJECT_ID},SENDCLOUD_MODE=live,SENDCLOUD_LABEL_MODE=test,EMAIL_MODE=live"
SECRETS="FIREBASE_API_KEY=FIREBASE_API_KEY:latest,\
STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,\
STRIPE_PUBLISHABLE_KEY=STRIPE_PUBLISHABLE_KEY:latest,\
SENDCLOUD_PUBLIC_KEY=SENDCLOUD_PUBLIC_KEY:latest,\
SENDCLOUD_SECRET_KEY=SENDCLOUD_SECRET_KEY:latest,\
SENDCLOUD_API_URL=SENDCLOUD_API_URL:latest,\
SENDCLOUD_SERVICE_POINTS_API_URL=SENDCLOUD_SERVICE_POINTS_API_URL:latest,\
SENDCLOUD_ENFORCED_CARRIER=SENDCLOUD_ENFORCED_CARRIER:latest,\
RESEND_API_KEY=RESEND_API_KEY:latest,\
RESEND_FROM_EMAIL=RESEND_FROM_EMAIL:latest,\
USER_PRODUCTS_CURSOR_KEY=${CURSOR_SECRET_NAME}:latest"

echo "Deploying ${SERVICE_NAME} to project ${PROJECT_ID} (${REGION})..."
gcloud config set project "${PROJECT_ID}" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"

if ! gcloud secrets describe "${CURSOR_SECRET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Creating ${CURSOR_SECRET_NAME} secret..."
  openssl rand -base64 32 | gcloud secrets create "${CURSOR_SECRET_NAME}" \
    --project "${PROJECT_ID}" \
    --replication-policy=automatic \
    --data-file=- >/dev/null
fi

gcloud secrets add-iam-policy-binding "${CURSOR_SECRET_NAME}" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role "roles/secretmanager.secretAccessor" >/dev/null

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars "${ENV_VARS}" \
  --set-secrets "${SECRETS}"

echo "Deployment finished."
