# createUser

## Descripción

Un admin puede crear usuarios nuevos (email/password) desde la app reacti.

Esta función crea la cuenta del usuario nuevo en Firebase Auth y escribe su respectivo documento en Firestore. Esa escritura lanza el trigger de [onWriteUser](./../OnWriteUser/Readme.md).

## Endpoint

/Users-createUser

## Request Body

```json
{
  "data": {
    "userData": {
      "display_name": "ADMIN no core",
      "email": "admin.nocore@softtek.com",
      "isActive": true,
      "roles": ["adminnocore"],
      "uid": ""
    }
  }
}
```

## Response

```json
{
  "data": {
    "uid": "Iqo4jFFUqVZnYdVuMnSANtpusam1"
  },
  "error": false,
  "msg": "Usuario creado con éxito."
}
```
