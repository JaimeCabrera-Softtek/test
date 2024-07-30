# getUserStatus

## Descripción

Se usa en la app web, para saber si se puede ofrecer 'habilitar' o 'deshabilitar' usuario. Función tipo onCall.

## Endpoint

/Users-getUserStatus

## Request Body

```json
{
  "data": {
    "email": "mdm.test@fridaplatform.online"
  }
}
```

## Response

```json
{
  "data": {
    "disabled": false,
    "email": "mdm.test@fridaplatform.online"
  },
  "error": false,
  "msg": "Status obtenido: false"
}
```
