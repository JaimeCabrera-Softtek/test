# onWriteUser

## Descripción

Trigger de Firestore que se lanza cuando hay alguna modificación en un documento de la colección `users`.

Lo que hace es

1. Invalidar todos los tokens existentes para ese usuario.
2. Recalcular los Custom Claims para ese usuario.
3. Actualizar correo en el usuario auth, si este se cambió en el doc.

Eso significa que los usuarios verán invalidada las sesiones existentes en las apps que tengan abiertas. Y cuando vuelvan a iniciar sesión, tendrán las claims actualizadas con los permisos que hayan sido concedidos.
