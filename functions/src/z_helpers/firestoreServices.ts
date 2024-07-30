import { CatalogSheet, Transformation } from "@fridaplatform-stk/motor-reglas";
import { Brand, catalog } from "../interfaces/CargaCatalogo";
import { db_materiales, firestore } from "../firebase";
import { userData } from "../interfaces/SeleccionMateriales";
import { MATERIALES } from "./constants";
/**
 * Se obtiene un id random para agregar un documento a una colección
 * @param collec nombre de la colección donde se obtendrá el id
 * @return id del prox doc
 */
export const getDocRefId = (collec: string) => {
  const docRef = firestore.collection(collec).doc();
  return docRef.id;
};

/** Retrieve providers from Firestore by their SAP ID.
@param {string} SAP_id - The SAP ID to query for providers.
@returns array of providers that match the given SAP ID.
@throws {Error} Throws an error if there is an issue fetching the provider data. */
export const gerProviderByIDSAP = async (SAP_id: string) => {
  const providers: any[] = [];

  await firestore
    .collection("proveedores")
    .where("idSAP", "==", SAP_id)
    .get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        providers.push(doc.data() as catalog);
      });
    })
    .catch((error) => {
      console.log("Error getting provider: ", error);
      throw new Error(error);
    });

  return providers;
};

export const getCatalogsByProvider = async (providerID: string) => {
  const catalogs: catalog[] = [];

  await firestore
    .collection("catalogs")
    .where("provider_id", "==", providerID)
    .get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        catalogs.push(doc.data() as catalog);
      });
    })
    .catch((error) => {
      console.log("Error getting catalogs: ", error);
      throw new Error(error);
    });

  return catalogs;
};

/**
 * Retrieves a catalog by its ID from the Firestore database.
 *
 * @param {string} catalogID - The ID of the catalog to retrieve.
 * @return The catalog object if found, otherwise undefined.
 */
export const getCatalog = async (catalogID: string) => {
  let catalog: catalog | undefined = undefined;

  const instanceRef = firestore.collection("catalogs").doc(catalogID);

  const instanceDoc: any = (await instanceRef.get()).data();
  if (instanceDoc) {
    catalog = instanceDoc;
  }

  return catalog;
};

/**
 * Retrieves the simple rules from the Firestore database.
 *
 * @return Object representing the simple rules.
 */
export const getOneRuleItem = async (
  nodo: "SimpleRules" | "TallasRulesEnabled" | "TallasUnitallaEnabled"
) => {
  let data: any;

  const instanceRef = firestore.collection("config").doc("RulesConfig");
  const instanceDoc: any = (await instanceRef.get()).data();

  if (instanceDoc && instanceDoc["data"] && instanceDoc["data"][nodo]) {
    data = instanceDoc["data"][nodo];
  }

  return data;
};

/**
 * Obtiene la configuración de las reglas COMPLEJAS o del PASO 2 guardadas en la colección config.
 * @return configuración de las reglas complejas
 */
export const getComplexRules = async () => {
  const complexRulesMap: any = {
    conditionalRules: [],
    groupingRules: [],
    tallasRules: [],
  };

  const instanceRef = firestore.collection("config").doc("RulesConfig");
  const instanceDoc: any = (await instanceRef.get()).data();

  if (
    instanceDoc &&
    instanceDoc["data"] &&
    instanceDoc["data"]["ComplexRules"]
  ) {
    const instanceData = instanceDoc["data"]["ComplexRules"];
    if (instanceData["groupingRules"]) {
      complexRulesMap.groupingRules = instanceData["groupingRules"];
    }
    if (instanceData["conditionalRules"]) {
      complexRulesMap.conditionalRules = instanceData["conditionalRules"];
    }
  }

  return complexRulesMap;
};

export const getTallasRules = async () => {
  let tallasRules: { [k: string]: string[] } = {};

  const instanceRef = firestore.collection("config").doc("RulesConfig");
  const instanceDoc: any = (await instanceRef.get()).data();

  if (
    instanceDoc &&
    instanceDoc["data"] &&
    instanceDoc["data"]["ComplexRules"]
  ) {
    const instanceData = instanceDoc["data"]["ComplexRules"];
    if (instanceData["tallasRules"]) {
      tallasRules = instanceData["tallasRules"];
    }
  }

  return tallasRules;
};

/**
 * Obtiene un arreglo de transformaciones dado el proveedor y el subMapa
 * @param idProvider proveedor al que le corresponde el mapa de transformación
 * @param subMap ID del mapa a obtener, por ejemplo "DETALLES", "KBS", "CABECERA"
 * @return arreglo de transformaciones correspondiente, o arreglo vacío si no se encuentra
 */
export const getTransformationMap = async (
  idProvider: string,
  subMap: string
) => {
  let transMap: Transformation[] = [];
  const instanceRef = firestore
    .collection("config")
    .doc("TransformationsConfig");

  const instanceDoc: any = (await instanceRef.get()).data();

  if (
    instanceDoc &&
    instanceDoc["data"] &&
    instanceDoc["data"][idProvider] &&
    instanceDoc["data"][idProvider]["data"] &&
    instanceDoc["data"][idProvider]["data"][subMap]
  ) {
    transMap = instanceDoc["data"][idProvider]["data"][subMap];
  }

  return transMap;
};

/**
 * Obtiene la configuración de las reglas SIMPLES o del PASO 1 guardadas en la colección config.
 * @return configuración de las reglas simples
 */
export const getSimpleRulesMap = async () => {
  let simpleRulesMap: CatalogSheet = { sheetsRules: [] };

  const instanceRef = firestore.collection("config").doc("RulesConfig");
  const instanceDoc: any = (await instanceRef.get()).data();

  if (
    instanceDoc &&
    instanceDoc["data"] &&
    instanceDoc["data"]["SimpleRules"] &&
    instanceDoc["data"]["SimpleRules"]["DETALLES"]
  ) {
    simpleRulesMap = instanceDoc["data"]["SimpleRules"]["DETALLES"];
  }

  return simpleRulesMap;
};

/**
 * Retrieves the application configuration data from Firestore.
 * It fetches the data stored under the "config" collection and the "AppConfig" document.
 * If the document exists and contains "data", it returns the corresponding data as an object.
 * If the document does not exist or does not contain "data", an empty object is returned.
 *
 * @return The application configuration data.
 */
export const getAppConfig = async () => {
  let config: any = {};

  const instanceRef = firestore.collection("config").doc("AppConfig");
  const instanceDoc: any = (await instanceRef.get()).data();

  if (instanceDoc && instanceDoc["data"]) {
    config = instanceDoc["data"];
  }

  return config;
};

/**
 * Retrieves a list of brands by their SAP ID.
 *
 * @param {string} idSAP - The SAP ID of the brands to retrieve.
 * @return An array of brands matching the SAP ID.
 * @throws {Error} - If there is an error retrieving the brands from Firestore.
 */
export const getBrandByIdSAP = async (idSAP: string) => {
  const brands: Brand[] = [];
  await firestore
    .collection("brands")
    .where("SAP_id", "==", idSAP)
    .get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        brands.push(doc.data() as Brand);
      });
    })
    .catch((error) => {
      console.log("Error getting brand: ", error);
      throw new Error(error);
    });

  return brands;
};

/**
 * Se agrega un nuevo catálogo de una marca
 * @param cat objeto del catálogo
 * @param id el id del catálogo con el que se va a registrar
 * @return true si la operación fue exitosa o error en caso de no haber creado el catálogo
 */
export const saveDocWithID = async (
  collection: string,
  data: any,
  docID: string
) => {
  try {
    await firestore.collection(collection).doc(docID).set(data);
    return true;
  } catch (error) {
    console.log("error", error);
    throw new Error(`Error creando documento ${collection} ${docID}`);
  }
};

/**
 *
 * @returns An array with the users assigned UDN
 */

export const getAsignedUDN = async () => {
  try {
    let udnArray: string[] = ["error"];
    const materialsRef = db_materiales.ref(
      "/HelperCatalogs/OrganizacionCompras"
    );
    const dataSnapShot = await materialsRef.get();
    if (dataSnapShot.exists()) {
      udnArray = Object.keys(dataSnapShot.val());
    }
    return udnArray;
  } catch {
    throw new Error(`Error getting Users UDN at GetAssignedUDN`);
  }
};
/**
 *
 * @param id uid of a user
 * @returns An array with the users assigned Sports
 */

export const getAsignedSpots = async (id: string) => {
  try {
    console.log("getAssignedSports ID", id);
    const docRef = firestore.collection("users").doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const docData = doc.data() as userData;
      // console.log("docData", docData);
      return docData.deportes;
    } else {
      throw new Error(`Error user is not found`);
    }
  } catch (error) {
    throw new Error(`Error getting Users deportes. ${error}`);
  }
};

/** Obtiene UN SOLO usuario con rol service (helper para llamar APIS) */
export const getServiceUser = async () => {
  let serviceUser = undefined;
  await firestore
    .collection("users")
    .where("roles", "array-contains", "service")
    .get()
    .then((querySnapshot) => {
      for (const doc of querySnapshot.docs) {
        serviceUser = doc.data();
        break;
      }
    })
    .catch((error) => {
      console.log("Error getting user: ", error);
      throw new Error(error);
    });

  return serviceUser;
};

/**
 *
 * @param upcArr An array of upcs from the selecetion
 * @returns An array with the users assigned Sports
 */

export const getSAPFromSelection = async (upcArr: string[]) => {
  try {
    console.log("upcArr", upcArr);
    let prodSAP: any = {};
    upcArr.forEach(async (id: string) => {
      const ref = db_materiales.ref(`/${MATERIALES}/${id}`);
      await ref.once("value", (snapshot) => {
        const data = snapshot.val();
        prodSAP[id] = data ? Object.values(data)[0] : null;
      });
    });
    return prodSAP;
  } catch (error) {
    throw new Error(`Error in getSAPFromSelection.${error} `);
  }
};

/**
 *
 * @returns An array with the users assigned Sports
 */

// export const getBanners = async () => {
//   try {
//     let baners: string[] = [];
//     const ref = db_materiales.ref(`/HelperCatalogs/OrganizacionCompras`);
//     await ref.once("value", (snapshot) => {
//       const data = snapshot.val();
//       baners = Object.keys(data);
//     });
//     return baners;
//   } catch (error) {
//     throw new Error(`Error in getBanners.${error} `);
//   }
// };

export const getASNbyID = async (
  id: number,
  collection: string
): Promise<FirebaseFirestore.DocumentData | undefined> => {
  let asn = undefined;
  await firestore
    .collection(collection)
    .where("asn", "==", id)
    .get()
    .then((querySnapshot) => {
      for (const doc of querySnapshot.docs) {
        asn = doc.data();
      }
    })
    .catch((error) => {
      console.log(`Error getting asn: `, error);
      throw new Error(error);
    });
  return asn;
};

export const updateEEASN = async (ee: any, asn: number) => {
  const asnDocs = await firestore
    .collection("asn")
    .where("asn", "==", asn)
    .get();
  const ees = asnDocs.docs[0].data().ee;
  await asnDocs.docs[0].ref.update({ ee: { ...ees, ...ee } });
};

export const updateStatusASN = async (asn: number) => {
  const asnDocs = await firestore
    .collection("asn")
    .where("asn", "==", asn)
    .get();
  const ees = asnDocs.docs[0].data().ee;
  let delivered = false;
  // If there's at least one "C" (completed) set delivered true, the rest EE are set to "M" (Missing)
  Object.entries(ees).map(([key, value]) => {
    if (value === "C") delivered = true;
    else ees[key] = "M";
  });
  await asnDocs.docs[0].ref.update({
    delivered: delivered,
    status: "Acuse",
    ee: ees,
  });
};

export const getOrderByNoDoc = async (pedido: string) => {
  const orderDocs = await firestore
    .collection("orders")
    .where("numeroDocumento", "==", pedido)
    .get();
  const order = orderDocs.docs[0] ? orderDocs.docs[0].data() : null;
  return order;
};

/**
 * Gets an Acuse using the order number
 * @param pedido #order
 * @returns acuse if it exists, else null
 */
export const getAcuseByOrder = async (pedido: string) => {
  const acuseDocs = await firestore
    .collection("acuseNoCore")
    .where("pedido", "==", pedido)
    .get();
  const acuse = acuseDocs.docs[0] ? acuseDocs.docs[0].data() : null;
  return acuse;
};

/**
 * Updates an Acuse
 * @param acuse updated Acuse
 * @returns The new request counter
 */
export const updateAcuseNoCore = async (acuse: any) => {
  try {
    const acuseDocs = await firestore
      .collection("acuseNoCore")
      .where("pedido", "==", acuse.pedido)
      .get();
    const acuseDoc = acuseDocs.docs[0];
    const acuseRef = acuseDoc.ref;
    const counter = await firestore.runTransaction(async (transaction) => {
      const currentCount = acuseDoc.data()?.requestCount || 1;
      transaction.update(acuseRef, { requestCount: currentCount + 1 });
      return currentCount + 1;
    });
    await acuseRef.update({ ...acuse });
    return counter;
  } catch (error) {
    console.log("Error actualizando el acuse: ", error);
  }
};

export const updateOrderStatus = async (order: string, changes: object) => {
  try {
    const orderDocs = await firestore
      .collection("orders")
      .where("numeroDocumento", "==", order)
      .get();
    return await orderDocs.docs[0].ref
      .update({ ...changes })
      .then(() => {
        return "Succesful update";
      })
      .catch((error) => error);
  } catch (error) {
    console.log(error);
  }
};

export const getAcuseByASN = async (asn: string) => {
  const acuseDocs = await firestore
    .collection("acuse")
    .where("cartaPorte", "==", asn)
    .get();
  const acuse = acuseDocs.docs[0] ? acuseDocs.docs[0].data() : null;
  return acuse;
};

export const updateOrderBoxCount = async (order: string, boxes: number) => {
  try {
    const orderDocs = await firestore
      .collection("orders")
      .where("numeroDocumento", "==", order)
      .get();
    const doc = orderDocs.docs[0];
    if (doc.data()?.boxCount) boxes += doc.data().boxCount;
    return await doc.ref
      .update({ boxCount: boxes })
      .then(() => {
        return "Succesful update";
      })
      .catch((error) => error);
  } catch (error) {
    console.log(error);
  }
};

export const verifyInvoince = async (invoice: string, providerId: string) => {
  try {
    const asnDocs = await firestore
      .collection("asn")
      .where("status", "!=", "SAP ERROR")
      .where("provider_id", "==", providerId)
      .where("factura", "==", invoice)
      .limit(1)
      .get();
    if (asnDocs.empty) return { success: true, data: "" };
    else
      return {
        success: false,
        data: `La factura ya está asignada a otro ASN: ${
          asnDocs.docs[0].data().asn
        }`,
      };
  } catch (error) {
    console.log(error);
    return { success: false, data: "Hubo un error al obtener la información" };
  }
};
