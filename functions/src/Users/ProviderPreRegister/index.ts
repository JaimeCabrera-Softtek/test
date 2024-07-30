import * as functions from "firebase-functions";
import { auth, firestore } from "../../firebase";
// import { CallbackFunction, VerifyIntegrationRequest } from "../../z_helpers/IntegrationsWrapper";
// import { CloudRes } from "../../interfaces/CloudRes";
import { FieldValue } from "firebase-admin/firestore";
import SendEmailToUser from "../../EmailNotifications/ProviderAfterRegister";

/**
 * Función llamada por el portal IBN
 *
 * Los admins pueden crear usuarios, se crean en auth y en Firestore
 * La escritura en Firestore lanzará un trigger que asignará custom claims
 */

export const providerPreRegister = functions.https.onCall(
  async (data, context) => {
    /**
     * doc_id: docID,
      contact_name: nameProvider,
      email: email,
      number: phone,
      password: pwd,
      isProvider: "pending",
     */
    if (
      true
    ) {
      try {

        let randm = Math.random();
        let code = randm.toString().split(".")[1].substring(0, 5);
        const docSnap = await firestore
          .collection('proveedores')
          .doc(data.doc_id).get();
        const docData = docSnap.data();
        console.log("Do work")

        console.log("docData", docData, data.doc_id);
        if (docData) {

          var userData = {
            display_name: data.contact_name,
            cp: docData.data.cp.value,
            email: data.email,
            RFC: docData.identificacion.rfc.value,
            number: data.number,
            isActive: true,
          };

          console.log("To create user auth")
          //Crear al usuario en auth
          const authUser = await auth.createUser({
            displayName: data.contact_name,
            email: data.email,
            password: data.password
          });

          console.log("To create user fs")
          const rolToSet = docData.providerType === "core" ? "proveedor" : "proveedornocore";
          console.log("rol to set", rolToSet);
          //Crear al usuario en Firestore
          if (data.isProvider !== "newUser") {
            await firestore
              .collection("users")
              .doc(authUser.uid)
              .create({
                ...userData, uid: authUser.uid, isProvider: data.isProvider, roles: [
                  rolToSet
                ],
                providerType: docData.providerType,
                docProviderOrg: data.doc_id,
              });
          }
          else {
            // Si trae isProvider === "newUser"
            // Tiene que traer el usuario y es porque va a agregar uno a la organización
            if (data.us !== undefined) {
              await firestore
                .collection("users")
                .doc(authUser.uid)
                .create({ ...data.us, uid: authUser.uid, docProviderOrg: data.doc_id, isActive: true, isProvider: "active" });
            } else {
              // Si no... se agrega sin rol
              await firestore
                .collection("users")
                .doc(authUser.uid)
                .create({ ...userData, uid: authUser.uid, docProviderOrg: data.doc_id, });
            }

          }


          // Update organization on proveedores
          console.log("To update proveedores")
          await firestore
            .collection("proveedores")
            .doc(data.doc_id)
            .update({
              organization: FieldValue.arrayUnion({
                display_name: userData.display_name,
                email: userData.email,
                uid: authUser.uid
              })
            })

          await SendEmailToUser(userData.email, data.password, userData.display_name, code)

          console.log("code", code)
          //Responder que el usuario se creó
          return {
            error: false,
            msg: "User created",
            data: {
              email: userData.email,
              pwd: data.password,
              code: code,
            }
          };
        }
        else {
          console.log("Error, no hay docData")
          return {
            error: true,
            msg: "No se encontro el documento",
            data: data
          }
        }
      } catch (err) {
        // ocurrió un error
        console.log("error", err)
        return {
          error: true,
          msg: (err as Error).message,
          data: data
        };
      }
    } else {
      // no se cuentan con los permisos necesarios
      return {
        error: true,
        msg: "Unauthorized",
        data: data
      };
    }
  }
)

