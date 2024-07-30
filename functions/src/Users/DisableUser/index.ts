import * as functions from "firebase-functions";
import { auth, firestore } from "../../firebase";
import { analytics } from "../../z_helpers/analytics";
import { findUser } from "./findUser";
import { CloudRes } from "../../interfaces/CloudRes";

/**
 * Esta función habilita o deshabilita un usuario, y actualiza el campo disabled del documento del usuario.
 *
 * El body que recibe es
 * {
 *  email: string;
 *  disable: boolean;
 * }
 *
 */
export const disableUser = functions.https.onCall(async (data, context) => {
  const timestamp_arrival = new Date().getTime();
  let obj: CloudRes = {
    data: null,
    error: false,
    msg: "",
  };

  // solo los admins y tester pueden deshabilitar un usuario
  if (
    context.auth?.token.isAdmin ||
    context.auth?.token.isTester ||
    context.auth?.token.isGestionUsers ||
    context.auth?.token.isCxP ||
    context.auth?.token.isInsumos
  ) {
    return (await processDisable(data, timestamp_arrival))
  } else {
    obj = {
      error: true,
      msg: "No se tienen permisos necesarios para realizar esta acción.",
      data,
    };
    // No es admin, solo los admins pueden deshabilitar
    // Si no es admin verificar si es Proveedor
    // if (context.auth?.token.isProveedor) {
    //   console.log("Entra a proveedor");
    //   // Si es proveedor, verificar que sea el primer usuario en la organización
    //   const userProv = (
    //     await firestore.collection("users").doc(context.auth.uid).get()
    //   ).data();
    //   if (userProv) {
    //     console.log("Se encuentra el user prov", userProv);
    //     const providerDoc = (
    //       await firestore
    //         .collection("proveedores")
    //         .doc(userProv.docProviderOrg ?? "")
    //         .get()
    //     ).data();
    //     if (providerDoc) {
    //       const firstC = providerDoc.organization[0].uid;
    //       if (firstC === context.auth.uid) {
    //         // Si es el admin de la organización, permitir el cambio
    //         obj = await processDisable(data, timestamp_arrival);
    //       }
    //     }
    //   }
    // }
  }

  await analytics(
    data,
    timestamp_arrival,
    "Users-disableUser",
    obj,
    "GestionUsuarios",
    "api"
  );

  return obj;
});

const processDisable = async (data: any, timestamp_arrival: number) => {
  let obj: CloudRes = {
    data: null,
    error: false,
    msg: "",
  };

  const userToUpdate = await findUser(data.email);
  if (userToUpdate !== undefined) {
    try {
      // ? habilitar o deshabilitar
      const deshabilitar = data.disable;

      await auth.updateUser(userToUpdate.uid, {
        disabled: deshabilitar,
      });

      firestore.doc(`users/${userToUpdate.uid}`).update({
        isActive: !deshabilitar,
      });

      obj = {
        error: false,
        data,
        msg: `Cambio en el estado del usuario ejecutado correctamente. El usuario se ${deshabilitar ? "desactivo" : "activo"}`,
      };
    } catch (err) {
      obj = {
        error: true,
        data,
        msg: `Ocurrió un error al deshabilitar/habilitar al usuario ${(err as Error).message
          }`,
      };
    }
  } else {
    // Usuario no encontrado
    obj = {
      error: true,
      data,
      msg: "Usuario no encontrado",
    };
  }

  return obj;
};
