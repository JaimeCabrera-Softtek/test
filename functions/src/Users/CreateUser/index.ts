import * as functions from "firebase-functions";
import { auth, firestore } from "../../firebase";
import { analytics } from "../../z_helpers/analytics";
import { CloudRes } from "../../interfaces/CloudRes";

/**
 * Función llamada por el portal IBN
 *
 * Los admins pueden crear usuarios, se crean en auth y en Firestore
 * La escritura en Firestore lanzará un trigger que asignará custom claims
 */
export const createUser = functions.https.onCall(async (data, context) => {
    const arrival = new Date().getTime();

    console.log("token", context.auth?.token, "isGestionUsers", context.auth?.token.isGestionUsers)
    // solo los admins y tester pueden crear un usuario
    if (
        context.auth?.token.isGestionUsers ||
        context.auth?.token.isAdmin ||
        context.auth?.token.isMDM ||
        context.auth?.token.isTester

    ) {
        try {
            console.log("entra a create user", data.user, data.pwd)
            const userData = data.user;
            const pwd = data.pwd;

            // Crear al usuario en auth
            const authUser = await auth.createUser({
                displayName: userData.display_name,
                email: userData.email,
                password: pwd,
            });
            console.log("after create user", authUser.uid)
            // Crear al usuario en Firestore
            await firestore
                .collection("users")
                .doc(authUser.uid)
                .create({ ...userData, uid: authUser.uid });

            const res: CloudRes = {
                data: {
                    uid: authUser.uid,
                },
                error: false,
                msg: "Usuario creado con éxito.",
            };

            await analytics(
                { userData: data.user },
                arrival,
                "Users-createUser",
                res,
                "GestionUsuarios",
                "firestore_trigger"
            );

            // Responder que el usuario se creó
            return res;
        } catch (err) {
            const res: CloudRes = {
                data: err,
                error: true,
                msg: "Ocurrió un error al crear usuario.",
            };

            await analytics(
                { userData: data.user },
                arrival,
                "Users-createUser",
                res,
                "GestionUsuarios",
                "firestore_trigger"
            );

            return res;
        }
    } else {
        // no se cuentan con los permisos necesarios
        return {
            error: true,
            msg: "Unauthorized",
            data: null,
        };
    }
});
