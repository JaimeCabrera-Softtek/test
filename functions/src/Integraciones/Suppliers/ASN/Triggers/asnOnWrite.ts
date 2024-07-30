// import axios from "axios";
import * as functions from "firebase-functions";
import { CloudRes } from "../../../../interfaces/CloudRes";
// import { getServiceToken } from "./helpers";
import { analytics } from "../../../../z_helpers/analytics";
import axios from "axios";
import { getServiceToken } from "./helpers";

/**
 * Es un API trigger que reacciona a la creación de un documento en la colección asn
 * Llama la API Verification Invoice
 */
export const ASN_onWrite = functions
  .runWith({
    maxInstances: 1000000,
    timeoutSeconds: 540,
    memory: "4GB",
  })
  .firestore.document("asn/{asnID}")
  .onWrite(async (change, context) => {
    let res: CloudRes = {
      data: null,
      error: false,
      msg: "",
    };

    try {
      if (change.after.exists && change.before.exists) {
        const newData = change.after.data();
        const oldData = change.before.data();

        // si hubo algun cambio en el documento
        if (oldData && newData) {
          // cambio el campo delivered de false a true
          if (
            (!oldData.delivered || oldData.delivered === false) &&
            newData.delivered === true
          ) {
            const url = process.env.VERIFICATION_INVOICE ?? "";
            const token = await getServiceToken();

            const body = {
              IdAsn: newData.doc_id,
            };
            const h = {
              "x-ibn-token": token,
            };

            await axios.post(url, body, {
              headers: h,
            });

            res.msg = "ok";
          } else {
            res.msg = "changes in 'delivered' field not found";
          }
        } else {
          res.msg = "old data or new data not found";
        }
      } else {
        res.msg = "old changes or new changes not found";
      }
    } catch (error) {
      res = { data: null, error: true, msg: (error as Error).message };
    }

    await analytics(
      {},
      new Date().getTime(),
      "Integraciones-S4-ASN_onWrite",
      res,
      "ASN",
      "firestore_trigger"
    );

    return res;
  });
