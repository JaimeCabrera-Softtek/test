# Backup CRON

Este job de backup corre todos los días a las 00:00 `America/Monterrey`, y hace un export de Firestore por medio de `FirestoreAdminClient.exportDocuments`

## Requisitos Importantes (IAM)

El backup requiere permisos especiales para hacerse, se otorgan mediante IAM y las service accounts

`*****@appspot.gserviceaccount.com`
- Cloud Datastore Import Export Admin
- Storage Admin