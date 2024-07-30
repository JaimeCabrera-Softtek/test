import * as functions from "firebase-functions";
import { auth } from "../../firebase";
import { analytics } from "../../z_helpers/analytics";
import { CloudRes } from "../../interfaces/CloudRes";

/**
 * Retorna el status del usuario (disabled)
 */
export const getUserStatus = functions.https.onCall(async (data, context) => {
  const timestamp_arrival = new Date().getTime();
  let obj: CloudRes = {
    data: null,
    error: false,
    msg: "",
  };

  if (
    context.auth?.token.isAdmin ||
    context.auth?.token.isTester ||
    context.auth?.token.isGestionUsers ||
    context.auth?.token.isCxP ||
    context.auth?.token.isInsumos
  ) {
    return (await process(data, timestamp_arrival))
  } else {
    obj = {
      error: true,
      msg: "No se tienen permisos necesarios para realizar esta acción.",
      data,
    };

    //* Verificar si es un proveedor
    // if (context.auth?.token.isProveedor) {
    //   // Si es proveedor, verificar que sea el primer usuario de la org (admin)
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
    //         obj = await process(data, timestamp_arrival);
    //       }
    //     }
    //   }
    // }
  }

  await analytics(
    data,
    timestamp_arrival,
    "Users-getUserStatus",
    obj,
    "GestionUsuarios",
    "api"
  );

  return obj;
});

const process = async (data: any, timestamp_arrival: number) => {
  let obj: CloudRes = {
    data: null,
    error: false,
    msg: "",
  };

  try {
    const email = data.email;
    const user = await auth.getUserByEmail(email);

    obj = {
      data: { email, disabled: user.disabled },
      error: false,
      msg: `Status obtenido: ${user.disabled}`,
    };
  } catch (err) {
    obj = {
      error: true,
      data: { email: data.email },
      msg: `Ocurrió un error al obtener el status del usuario ${(err as Error).message
        }`,
    };
  }
  return obj;
};
