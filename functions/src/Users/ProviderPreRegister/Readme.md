#### Creación de usuarios

La API se usará para agregar usuarios de tipo proveedor y los integrantes de su organización.
Se entiende el proveedor como una organización donde existen diferentes usuarios

Esta API puede llamarse cuando se está registrando un proveedor en su solicitud pre-registro o cuando se agrega un usuario a la organización del proveedor.

Al mandar llamar esta API desde el proceso del pre-registro debe contener la siguiente estructura:

```json
{
  "doc_id": "Identificador del documento que le pertenece al proveedor (ID del doc en la colección de proveedores)",
  "contact_name": "El nombre que se asignará a ese usuario",
  "email": "E-mail del usuario al que se le creará la cuenta",
  "number": "Teléfono del usuario o en caso de no tener, del proveedor",
  "password": "Contraseña que se asignará al usuario",
  "isProvider": "pending" //(Como recién se hizo la solicitud aún no está aprobado como proveedor)
}
```

Cuando se manda llamar al API desde la creación de usuario para agregarlo a la organización del proveedor debe contener la siguiente estructura:

```json
    {
        "doc_id": "Identificador del documento que le pertenece al proveedor (ID del doc en la colección de proveedores)",
      "contact_name": "El nombre que se asignará a ese usuario",
      "email": "E-mail del usuario al que se le creará la cuenta",
      "number": "Teléfono del usuario o en caso de no tener, del proveedor",
      "password": "Contraseña que se asignará al usuario",
      "isProvider": "newUser", //pertenecerá a la organización entonces se indica
      "us": {...Usuario con la información básica, además de información de su organización},
    }
```

Al terminar de crear el usuario, se actualiza el documento del proveedor, agregando en la propiedad _organization_ un usuario más, la organización consiste en un arreglo de objectos que tienen la siguiente estructura:

```json
{
  "display_name": "Nombre del usuario creado",
  "email": "Correo del usuario creado",
  "uid": "UID del usuario creado"
}
```

Al finalizar el proceso se hace el envío de un correo para el proveedor informándole sobre su registro en la plataforma, incluye su nombre y correo, ambos capturados durante el registro y un código de 5 dígitos que el usuario puede introducir al finalizar el proceso y hace un loggin en automático a la plataforma. El código no será pedido en algún otro momento, sólo se pide para confirmar su correo y entrar a la web app.
