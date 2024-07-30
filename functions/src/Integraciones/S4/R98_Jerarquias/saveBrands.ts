import * as _ from "lodash";

import { firestore } from "../../../firebase";
import { Brand } from "../../../interfaces/CargaCatalogo";
import { Timestamp } from "firebase-admin/firestore";

interface Brands {
  [docID: string]: Brand;
}

interface Map {
  [key: string]: string;
}

const brandRef = firestore.collection("brands");

/**
 * Guarda en la colección de firestore "brands", las marcas recibidas por la r98
 * @param brands
 */
export const saveFirebaseBrands = async (brands: Map) => {
  const processBrands = await getFirebaseBrands();
  const { brandsMap, fbBrands } = processBrands;

  /** Estructura nueva de "brands" */
  const fbBrandsUpdated: Brands = _.cloneDeep(fbBrands);

  // Recorrer las marcas obtenidas de la r98
  for (const [brandName, idSAP] of _.entries(brands)) {
    // intentar obtener el doc id de la marca
    const docID = brandsMap[brandName];

    // existe un doc id, es una marca que ya estaba en la colección
    if (docID) {
      // Actualizamos solo el idSAP, por si llegó a cambiar
      const brandData = fbBrands[docID];
      fbBrandsUpdated[docID] = { ...brandData, SAP_id: idSAP };
    } else {
      // No existe un doc id, es una marca que no se tiene en fb, crear nuevo doc
      const docRef = brandRef.doc();
      const newID = docRef.id;

      // nueva marca
      fbBrandsUpdated[newID] = {
        active: true,
        created: Timestamp.fromDate(new Date()),
        icon: "path/to/picture.png",
        id: newID,
        name: brandName,
        SAP_id: idSAP,
      };

      console.log("nueva marca", brandName, newID);
    }
  }

  // guardar la data actualizada en firestore
  for (const [docID, brandData] of _.entries(fbBrandsUpdated)) {
    await brandRef
      .doc(docID)
      .set(brandData)
      //   .then(() => {
      //     console.log("marca guardada", brandData.name, docID);
      //   })
      .catch((error) => {
        console.error(
          `Error al guardar marca ${brandData.name} en doc ${docID}: `,
          error
        );
      });
  }
};

const getFirebaseBrands = async () => {
  /** Mapa de las marcas actuales en la colección "brands" */
  const fbBrands: Brands = {};
  /** Relación nombre marca - doc id */
  const brandsMap: Map = {};

  const querySnapshot = await brandRef.get();

  querySnapshot.forEach((doc) => {
    const brandData = doc.data() as Brand;
    fbBrands[brandData.id] = brandData;
    brandsMap[brandData.name] = brandData.id;
  });

  return { fbBrands, brandsMap };
};
