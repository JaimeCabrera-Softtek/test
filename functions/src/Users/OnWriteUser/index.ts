import * as functions from "firebase-functions";
import { auth } from "../../firebase";
import { analytics } from "../../z_helpers/analytics";
import { CloudRes } from "../../interfaces/CloudRes";

/**
 * Esta función se ejecuta al crear, editar o eliminar un documento en la colección users.
 *
 * Su funcionalidad es encargarse de que las customClaims y el email de los usuarios estén actualizad@s.
 * Cuando sus permisos cambien, se cerrarán todas las sesiones del usuario cambiado.
 */
export const onWriteUser = functions.firestore
  .document("users/{userID}")
  .onWrite(async (change, context) => {
    const timestamp_arrival = new Date().getTime();

    const uid = context.params.userID;
    await auth.revokeRefreshTokens(uid);

    if (change.after.exists) {
      const oldUser: any = change.before.data();
      const newUser: any = change.after.data();

      if (newUser !== undefined) {
        // ** ACTUALIZAR EMAIL
        // ya había data antes del cambio
        if (oldUser !== undefined) {
          // evaluamos si hubo un cambio en el campo de email
          if (oldUser.email !== newUser.email) {
            // actualizar el email en el user de firebase
            await auth.updateUser(uid, { email: newUser.email });
          }
        }

        // ** ACTUALIZAR CUSTOM CLAIMS
        // los roles contemplados hasta ahora son admin, compras, mdm, proveedor, tester
        const isAdmin = newUser.roles.includes("admin");
        const isAdminNoCore = newUser.roles.includes("adminnocore");
        const isGestionUsers = newUser.roles.includes("gestionusers");
        const isCxP = newUser.roles.includes("cpp");
        const isInsumos = newUser.roles.includes("insumos");
        const isCompras = newUser.roles.includes("compras");
        const isMDM = newUser.roles.includes("mdm");
        const isProveedor = newUser.roles.includes("proveedor");
        const isTester = newUser.roles.includes("tester");
        const isSupply = newUser.roles.includes("supply");
        const isFinanzas = newUser.roles.includes("finanzas");
        const providerID = newUser.docProviderOrg ?? "";
        const providerID_SAP = newUser.SAP_idProvider ?? "";

        const claims = {
          isAdmin,
          isAdminNoCore,
          isGestionUsers,
          isCxP,
          isInsumos,
          isCompras,
          isMDM,
          isProveedor,
          isTester,
          isSupply,
          isFinanzas,
          providerID,
          providerID_SAP,
        };

        await auth.setCustomUserClaims(uid, claims);

        const obj: CloudRes = {
          data: { userID: uid },
          error: false,
          msg: "Custom claims (permisos) actualizados para el usuario.",
        };

        await analytics(
          { userID: uid },
          timestamp_arrival,
          "Users-onWriteUser",
          obj,
          "GestionUsuarios",
          "firestore_trigger"
        );
      }
    } else {
      // !Se borró
    }

    return "ok";
  });
