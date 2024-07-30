import { getMaterial } from "../../../../z_helpers/realtimeServices";
import {
  AltaMaterial_Articulo,
  AltaMaterial_ProductInit,
  CambioPrecios_Init,
  Job,
} from "../../../01_batch_creation/interfaces";
import { formatDate, getOrg } from "../helperCatalogs";
import { getFechaFin, proxMiercoles } from "./5";

export const body04 = async (product_data: Job) => {
  let items: any[] = [];

  // GET INFO NECESARIA
  let fecha = formatDate(new Date(Date.now()));
  let fechaFin = "99991231";
  let orgs: string[] = [];

  if (
    product_data.type === "nuevo_completo" ||
    product_data.type === "extension_de_banner"
  ) {
    const pd = product_data as AltaMaterial_ProductInit;
    orgs = await getOrg(pd.banners);
  } else if (
    product_data.type === "cambio_precios" ||
    product_data.type === "cambio_precio_compra"
  ) {
    const pd = product_data as CambioPrecios_Init;
    // obtener los banners en los que se ha dado de alta,  como son varios UPC, traer todos...
    for (const v of Object.values(pd.art.variantes)) {
      let material = await getMaterial(v.upc);
      if (material) {
        const m = material as AltaMaterial_Articulo;
        const orgs_variant = await getOrg(m.Banners[product_data.art.Sociedad]);
        orgs = Array.from(new Set([...orgs, ...orgs_variant]));
      } else {
        // ! no deberia pasar, si se detectaron cambios fue en este nodo...
      }
    }

    // TODO: ESTAS REGLAS TAMBIÉN SON PARA EL COSTO?
    const prox = proxMiercoles();
    fecha = formatDate(prox);

    fechaFin = await getFechaFin(prox, pd.consecutivo.toString());
  } else {
    console.log("no type");
    throw new Error(`no type found ${product_data.push_id}`);
  }

  // OBTENER EL NUMERO DE PROVEEDOR
  const numeroVendor = product_data.art.providerIDSAP
    ? product_data.art.providerIDSAP.padStart(10, "0")
    : process.env.TEMP_ID_PROVIDER_ALTA;

  // ESTOS DATOS LO TIENEN TODOS LOS ITEMS
  const base = {
    codigoInterno: product_data.push_id!,
    claseCondicion: "PB00",
    material: product_data.consecutivo.toString().padStart(18, "0"), // consecutivo generico
    NumeroVendorCreditor: numeroVendor,
    CabeceraCondicion: {
      inicioValidez: fecha,
      finValidez: fechaFin,
    },
    CondicionesPosicion: [
      {
        claseCondicion: "PB00",
        importePorcentajeCondicion: product_data.art.Precio_compra, // precio de artículo
      },
    ],
  };

  // CONSTRUIR UN ITEM POR CADA ORGANIZACIÓN/BANNER
  for (const org of orgs) {
    items.push(getItem(base, org));
  }

  // BODY PARA CPI
  return {
    ClaveCondicion: items,
  };
};

/**
 * Obtiene un item para ClaveCondicion
 * @param base info base que no cambia en los items
 * @param org organización del item
 * @returns item
 */
const getItem = (base: any, org: string) => {
  return {
    ...base,
    organizacionCompras: org,
  };
};
