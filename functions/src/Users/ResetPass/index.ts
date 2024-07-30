import * as functions from "firebase-functions";
import { findUser } from "../DisableUser/findUser";
import { auth } from "../../firebase";
import { CloudRes } from "../../interfaces/CloudRes";
import { analytics } from "../../z_helpers/analytics";

/**
 * Cambia la contraseña de un usuario.
 * Los admins pueden cambiar la contraseña de otros usuarios, un usuario normal solo puede cambiar la suya.
 *
 * El body esperado es:
 * {
 *  email: string;
 *  newPass: string;
 * }
 */
export const resetPass = functions.https.onCall(async (data, context) => {
  const timestamp_arrival = new Date().getTime();
  const { email, newPass } = data;

  let obj: CloudRes = {
    data: null,
    error: false,
    msg: "",
  };

  if (
    email !== undefined &&
    email !== "" &&
    newPass !== undefined &&
    newPass !== ""
  ) {
    obj = {
      data: { email },
      error: true,
      msg: "No se tienen permisos necesarios para realizar esta acción.",
    };

    try {
      const userToReset = await findUser(email);
      if (
        context.auth?.token.isAdmin ||
        context.auth?.token.isMDM ||
        context.auth?.token.isTester ||
        context.auth?.token.isGestionUsers ||
        context.auth?.token.isCxP ||
        context.auth?.token.isInsumos
      ) {
        // Un admin puede resetear la de cualquiera
        if (userToReset) {
          // OK, el admin puede cambiar contraseñas
          await auth.updateUser(userToReset.uid, {
            password: newPass,
          });

          obj = {
            data: { email },
            error: false,
            msg: "Contraseña actualizada para el usuario",
          };
        } else {
          // Usuario no encontrado
          obj = {
            data: { email },
            error: true,
            msg: "Usuario no encontrado",
          };
        }
      } else {
        if (userToReset) {
          // Verificar, es él mismo?
          if (userToReset.uid === context.auth?.uid) {
            // OK, es el mismo usuario
            // Solo puede resetear su contraseña
            await auth.updateUser(userToReset.uid, {
              password: newPass,
            });

            obj = {
              data: { email },
              error: false,
              msg: "Contraseña actualizada para el usuario",
            };
          }
          // else {
          // Si no es él mismo verificar si es proveedor
          // if (context.auth?.token.isProveedor) {
          //   // Si es proveedor, verificar que sea el admin (primer user de la organización)
          //   const userProv = (
          //     await firestore.collection("users").doc(context.auth.uid).get()
          //   ).data();
          //   if (userProv) {
          //     const providerDoc = (
          //       await firestore
          //         .collection("proveedores")
          //         .doc(userProv.docProviderOrg ?? "")
          //         .get()
          //     ).data();
          //     if (providerDoc) {
          //       const firstC = providerDoc.organization[0].uid;
          //       if (firstC === context.auth.uid) {
          //         await auth.updateUser(userToReset.uid, {
          //           password: newPass,
          //         });

          //         obj = {
          //           data: { email },
          //           error: false,
          //           msg: "Contraseña actualizada para el usuario",
          //         };
          //       }
          //     }
          //   }
          // }
          // }
        }
      }
    } catch (err) {
      obj = {
        data: err,
        error: true,
        msg: `Ocurrió un error al actualizar la contraseña ${(err as Error).message
          }`,
      };
    }
  } else {
    obj = {
      data: null,
      error: true,
      msg: "Bad Request. Los campos email y newPass son requeridos.",
    };
  }

  await analytics(
    { email },
    timestamp_arrival,
    "Users-resetPass",
    obj,
    "GestionUsuarios",
    "api"
  );

  return obj;
});
