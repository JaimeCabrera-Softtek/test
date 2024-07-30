import * as functions from "firebase-functions";
import * as jwt from "jsonwebtoken";
import { COLLECTION_USUARIOS } from "./constants";
import { firestore } from "../firebase";
import { User } from "../interfaces/user";
// import { auth, firestore } from "../firebase"
// import { User } from '../interfaces/user';

/**
 * Verificar la validez de un auth token que viene en la llamada a una función onCall
 * @param context el contexto de la llamada a una función onCall
 * @param expected roles de usuario que tienen acceso al recurso
 * @return objeto TokenVerificationResult
 */
export const verifyToken = async (
  context: functions.https.CallableContext,
  expected: string[], // ['finanzas', 'tester', 'proveedor', 'service']
): Promise<TokenVerificationResult> => {
  console.log("verifying token");
  if (context.auth) {
    /**
         * Trae el token en el header de Authorization
         * este token debe de ser el automático que React le adjunta cuando se usa con httpsCallable del firebase sdk de cliente
         */
    const requestToken = context.auth.token;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (requestToken.exp && requestToken.exp > nowInSeconds) {
      //Es un token de web??
      // console.log('uid', requestToken.uid);
      const uDoc = await firestore.collection(COLLECTION_USUARIOS).doc(context.auth.uid).get();
      if (uDoc.exists) {
        const uData = uDoc.data()!;
        if ((uData.roles as string[]).some(x => expected.includes(x))) {
          console.log('user roles', uData.roles);
          console.log('expected roles', expected);
          return {
            ...TOKEN_OK,
            user: uData as User
          };
        }
      } else {
        throw 'User does not exist';
      }
    } else {
      return TOKEN_EXPIRED;
    }
  } else {
    /**
     * Buscar el token en el header que acordamos
     * x-ibn-token
     */
    const token = context.rawRequest.header("x-ibn-token");
    if (token) {
      console.log("x-ibn-token", token);
      try {
        /**
         * Este secret debe de coincidir con la "private_key" que usa la service account de firebase de función de Python que firma los custom tokens
         */
        const secret = process.env.PRIVATE_KEY;
        const decoded = jwt.verify(token, secret ?? "");
        console.log("decoded", JSON.stringify(decoded));
        const uid = (decoded as any).uid;

        const uDoc = await firestore.collection(COLLECTION_USUARIOS).doc(uid).get();
        if (uDoc.exists) {
          const uData = uDoc.data()! as User;
          if ((uData.roles as string[]).some(x => expected.includes(x))) {
            return {
              ...TOKEN_OK,
              user: uData as User
            };
          }
        } else {
          throw 'User does not exist';
        }
      } catch (e) {
        console.log("catch", JSON.stringify(e));
        return TOKEN_UNAUTHORIZED;
      }
    } else {
      return TOKEN_MISSING;
    }
  }
  return TOKEN_UNAUTHORIZED;
};

export interface TokenVerificationResult {
  success: boolean
  msg: string
  user?: User
}

const TOKEN_MISSING: TokenVerificationResult = {
  success: false,
  msg: "Token missing",
};

const TOKEN_UNAUTHORIZED: TokenVerificationResult = {
  success: false,
  msg: "Unauthorized",
};

const TOKEN_EXPIRED: TokenVerificationResult = {
  success: false,
  msg: "Token expired",
};

const TOKEN_OK: TokenVerificationResult = {
  success: true,
  msg: "OK",
};
