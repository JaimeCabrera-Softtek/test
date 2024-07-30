# disableUser

## Descripción

Se usa dentro de la app React. Un admin puede deshabilitar cuentas de usuario. Función tipo onCall.

## Enpoint

Users-disableUser

## Request Body

```json
{
  "data": {
    "disable": true,
    "email": "mdm.test@fridaplatform.online"
  }
}
```

## Response

```json
{
  "data": {
    "disable": true,
    "email": "mdm.test@fridaplatform.online"
  },
  "error": false,
  "msg": "Cambio en el estado activo del usuario ejecutado correctamente."
}
```
