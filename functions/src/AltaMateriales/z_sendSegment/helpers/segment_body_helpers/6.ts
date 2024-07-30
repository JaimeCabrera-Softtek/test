import { db_materiales } from "../../../../firebase";
import { HELPER_CATALOGS } from "../../../../z_helpers/constants";
import { AltaMaterial_ProductInit } from "../../../01_batch_creation/interfaces";
import { getVariante } from "./1";

export const body06 = async (
  product_data: AltaMaterial_ProductInit,
  operacion: "create" | "patch" | "put"
) => {
  const func = getFuncKey(operacion);
  const catalogacion = await getCatalogacion(
    product_data.banners,
    product_data.art.Commerce
  );

  return {
    catalogacion: variantizar(func, catalogacion, product_data),
  };
};

function variantizar(
  func: string,
  catalogacion: Array<{ surtido: string }>,
  product_data: AltaMaterial_ProductInit
) {
  let res: any[] = [];

  // por cada "surtido"
  for (const surtido of catalogacion) {
    // un generico
    let generico = {
      codigoInterno: product_data.push_id!,
      funcion: func,
      E1WLK1M: [surtido],
      material: product_data.consecutivo.toString().padStart(18, "0"),
    };

    // y sus variantes
    let variants = Object.values(product_data.art.variantes).map((v) => {
      return {
        codigoInterno: product_data.push_id!,
        funcion: func,
        E1WLK1M: [surtido],
        material: getVariante(v.consecutivo, product_data.consecutivo),
      };
    });

    res = [...res, generico, ...variants];
  }

  return res;
}

/**
 * Traducir `create` `update` `delete` a un char para que SAP entienda
 * @param operacion operación que queremos hacer
 * @returns el valor con el que le indicamos qué operación queremos hacer a SAP
 */
const getFuncKey = (operacion: "create" | "patch" | "put") => {
  if (operacion === "create") {
    return "009";
  } else if (operacion === "patch") {
    return "004";
  } else if (operacion === "put") {
    return "005";
  }
  return "";
};

/**
 * Obtener valor array para el campo E1WLK1M
 * @returns array para mandar en el campo E1WLK1M
 */
const getCatalogacion = async (banners: string[], commerce: string) => {
  let catalogacion: { surtido: string }[] = [];

  //   obtener los surtidos "globales"
  const surtidoBanners = (
    await db_materiales
      .ref(HELPER_CATALOGS)
      .child("Segmento6Surtido")
      .once("value")
  ).val();

  // en realidad compras solo puede enviar un banner, pero la estructura está realizada para obtener varios
  for (const banner of banners) {
    // tiendas especificas para catalogar por cada banner, incluyen el banner CEDIS (tienda 0370)
    const tiendasBanner: { [k: string]: any } = (
      await db_materiales
        .ref(HELPER_CATALOGS)
        .child("Segmento6SurtidoTiendas")
        .child(banner)
        .once("value")
    ).val();

    // concentrado del surtido general, y las tiendas especificas
    const surtidos: any[] = Object.values(tiendasBanner ?? {}).concat(
      surtidoBanners[banner]
    );

    // en selección de materiales hay una regla que dice que el commerce tiene que ser igual al banner seleccionado
    if (commerce !== "") {
      const bannerEcommerce = surtidoBanners[`${commerce} E`]; // ? los banners ecommerce se identifican en HelperCatalogos con el nombre del banner+espacio+E
      if (bannerEcommerce) {
        surtidos.push(bannerEcommerce);
      }
    }

    // por cada surtido, ya sea general o tiendas especificas
    for (const s of surtidos) {
      let surtido = s.toString();

      // si es numerico, agregar ceros hasta 10 posiciones
      if (/^\d+$/.test(surtido)) {
        surtido = surtido.toString().padStart(10, "0");
      }

      catalogacion.push({
        surtido: surtido, //organización de compras
      });
    }
  }

  return catalogacion;
};
