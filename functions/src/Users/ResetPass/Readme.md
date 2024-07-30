# resetPass

## Descripción

Un admin puede re-establecer las contraseñas de los usuarios desde el app web.

También está abierta para que un usuario (no admin) restablezca su propia contraseña. Función de tipo onCall.

## Enpoint

/Users-resetPass

## Request Body

```json
{
  "data": {
    "email": "user@fridaplatform.com",
    "newPass": "newPassword"
  }
}
```

## Response

```json
{
  "data": {
    "email": "user@fridaplatform.com"
  },
  "error": false,
  "msg": "Contraseña actualizada para el usuario"
}
```
