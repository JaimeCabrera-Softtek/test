import { db, db_materiales, firestore } from "../../../firebase";
import {
  Jerarquia_Solicitada,
  catalog,
} from "../../../interfaces/CargaCatalogo";
import { User } from "../../../interfaces/user";
import {
  HELPER_CATALOGS,
  JERARQUIAS_EXISTENTES,
  JERARQUIAS_SOLICITADAS,
} from "../../../z_helpers/constants";
import { SendMailObj, sendMail } from "../../../z_helpers/sendmail";

export const jerarquiasSolicitadas = async (
  productos: any[],
  catalog: catalog,
  jerarquias_existentes: string[],
  jerarquias_solicitadas: string[],
  generos: any,
  divisiones: any,
  deportes: any,
  marcas: any,
  familias_auto: any,
  siluetas: any
): Promise<{ exists: boolean; jerarquia: string; data?: any }> => {
  //Calculamos la Jerarquía que le correspondería al producto
  const jerarquia_solicitada = await getJerarquia(
    productos[0],
    catalog.brand_name,
    generos,
    divisiones,
    deportes,
    marcas,
    familias_auto,
    siluetas
  );
  const map: { [upc: string]: Jerarquia_Solicitada } = {};
  let exists = false;

  if (jerarquias_existentes.includes(jerarquia_solicitada)) {
    exists = true;
  } else if (jerarquias_solicitadas.includes(jerarquia_solicitada)) {
    exists = false;
  } else {
    //Buscar esa jerarquía en las jerarquías existentes
    exists = (
      await db_materiales
        .ref(HELPER_CATALOGS)
        .child(JERARQUIAS_EXISTENTES)
        .child(jerarquia_solicitada)
        .once("value")
    ).val();
  }

  if (!exists) {
    for (const producto of productos) {
      map[producto.UPC] = {
        UPC: producto.UPC,
        Estilo: producto.Estilo,
        Jerarquia_Solicitada: jerarquia_solicitada,
        Proveedor_IBN_ID: catalog.provider_id,
        Proveedor_SAP_ID: catalog.provider_idSAP ?? "id_sap_desconocido",
        Proveedor_Name: catalog.provider_name,
        Catalogo_IBN_ID: catalog.doc_id,
        Catalogo_Prov_ID: catalog.catalog_id,
      };
    }

    return { exists: false, jerarquia: jerarquia_solicitada, data: map };
  } else {
    return { exists: true, jerarquia: jerarquia_solicitada };
  }
};

/**
 * Concatenado de los IDs de Género + Division + Deporte + Marca + Familia + Silueta
 * @param product_data Valor del nodo del job
 * @returns Valor concatenado para la jerarquía
 */
const getJerarquia = async (
  product_data: any,
  brand_name: string,
  generos: any,
  divisiones: any,
  deportes: any,
  marcas: any,
  familias_auto: any,
  siluetas: any
): Promise<string> => {
  const genero = await getKeyFor(generos, product_data["Género"]);
  const division = await getKeyFor(divisiones, product_data["División"]);
  const deporte = await getKeyFor(deportes, product_data.Deporte);
  const marca = await getKeyFor(marcas, brand_name.toUpperCase() ?? "");
  const familia = (await getKeyFor(familias_auto, product_data.Silueta)) ?? "";
  const silueta = await getKeyFor(siluetas, product_data.Silueta);

  return `${genero}${division}${deporte}${marca}${familia}${silueta}`;
};

const getKeyFor = (map: any, value: string) => {
  return map[value];
};

export const saveJerarquiasSolicitadas = async (data: {
  [upc: string]: Jerarquia_Solicitada;
}) => {
  try {
    await db.ref(JERARQUIAS_SOLICITADAS).update(data);
  } catch (error) {
    console.log(
      "Error guardando jerarquias solicitadas",
      (error as Error).message
    );
    throw error;
  }
};

/**
 * Elimina los nodos de Jerarquia_Solicitada, que tengan alguna jerarquia que se haya detectado que ya existe
 * @param jerarquias_existentes arreglo de jerarquias existentes que se obtuvieron al procesar el catalogo
 */
export const removeNodosJerarquia = async (jerarquias_existentes: string[]) => {
  const ref = db.ref(JERARQUIAS_SOLICITADAS);

  for (const jerarquia of jerarquias_existentes) {
    try {
      const snapshot = await ref
        .orderByChild("Jerarquia_Solicitada")
        .equalTo(jerarquia)
        .once("value");

      if (snapshot.exists()) {
        const updates: { [key: string]: null } = {};
        snapshot.forEach((childSnapshot) => {
          const key = childSnapshot.key;
          if (key) {
            updates[key] = null;
          }
        });

        if (Object.keys(updates).length > 0) {
          // ESCRIBE NULL EN TODOS LOS NODOS A LA VEZ
          await ref.update(updates);
          console.log(
            "Nodos en Jerarquia_Solicitada eliminados.",
            jerarquia,
            Object.keys(updates).length
          );
        }
      }
    } catch (error) {
      console.error("Error al eliminar nodos: ", error);
    }
  }
};

export const getHelperCatalog = async (nodo: string): Promise<{}> => {
  const ref = db_materiales.ref(HELPER_CATALOGS).child(nodo);
  const val = (await ref.once("value")).val();

  return val ?? {};
};

export const sendMailJerarquias = async (
  jerarquias: string[],
  catalog: catalog
) => {
  const queryMDM = firestore
    .collection("users")
    .where("roles", "array-contains", "mdm");

  const user_mdm = (await queryMDM.get()).docs;
  const users_mails: string[] = user_mdm.map((x) => (x.data() as User).email);

  let bodyJerarquias = "";
  jerarquias.forEach((j) => {
    bodyJerarquias += `<tr><td>${j}</td></tr>`;
  });

  //Preparación del correo
  const obj: SendMailObj = {
    To: users_mails,
    Subject: "Nuevas jerarquias solicitadas",
    Body: `Hay nuevas jerarquías que están siendo solicitadas en el catálogo ${catalog.catalog_id}.`,
    isHTML: true,
    HTMLBody: `<body>
              <p>Hay nuevas jerarquías que están siendo solicitadas.</p>
              <table>
                <tr>
                  <td>ID Catálogo</td>
                  <td>${catalog.catalog_id}</td>
                </tr>
                <tr>
                  <td>Marca</td>
                  <td>${catalog.brand_name}</td>
                </tr>
                <tr>
                  <td>Proveedor</td>
                  <td>${catalog.provider_name}</td>
                </tr>
                <tr>
                  <td>Temporada</td>
                  <td>${catalog.season.year} - ${catalog.season.name}</td>
                </tr>
              </table>
              <br/>
              <table>
                <tr>
                  <td>JERARQUIAS SOLICITADAS:</td>
                </tr>
                ${bodyJerarquias}
              </table>
          </body>`,
  };

  //Enviar el correo
  await sendMail(obj);

  console.log("correos de jerarquias enviados");
};
