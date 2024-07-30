import * as functions from "firebase-functions";
import {verifyToken} from "./verifyToken";
import {CloudRes, not_found, unauthorized} from "../interfaces/CloudRes";
import {firestore} from "../firebase";
import {User} from "../interfaces/user";

/**
 * Código reutilizable para validar las requests a funciones onCall
 * @param context contexto de la llamada onCall
 * @param allowed_roles Roles que tienen permiso a la función
 * @return CloudRes
 */
export const validateRequest = async (
  context: functions.https.CallableContext,
  allowed_roles: string[]
): Promise<CloudRes> => {
  // Trae auth?
  if (context.instanceIdToken && context.auth) {
    // Validación de token
    const tokenValid = await verifyToken(context, allowed_roles);
    if (tokenValid) {
      // Validación de roles del usuario
      const uid = context.auth.uid;
      const userDoc = await firestore.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const user = userDoc.data()! as User;
        // El usuario tiene algún rol que le dé permiso a esta sección?
        if (user.roles.some((r) => allowed_roles.includes(r))) {
          //* Tiene acceso por rol
          // TODO: Revisar schema
          return {
            error: false,
            msg: "OK",
            data: null,
          };
        } else {
          return unauthorized;
        }
      } else {
        return not_found;
      }
    } else {
      return unauthorized;
    }
  } else {
    return unauthorized;
  }
};
