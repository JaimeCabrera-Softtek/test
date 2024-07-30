import { PreciosVentaSAP } from "../../../../interfaces/CargaCatalogo/precios";
import {
  getMaterial,
  getPrecioVenta,
} from "../../../../z_helpers/realtimeServices";
import {
  AltaMaterial_Articulo,
  AltaMaterial_ProductInit,
  CambioPrecios_Init,
  Job,
} from "../../../01_batch_creation/interfaces";
import { formatDate, getOrg, getSimple } from "../helperCatalogs";

export const body05 = async (product_data: Job) => {
  let precios: any[] = [];

  // GET INFO NECESARIA
  let fecha = formatDate(new Date(Date.now()));
  let fechaFin = "99991231";
  let canales = ["10"];
  let orgs: string[] = [];

  if (
    product_data.type === "nuevo_completo" ||
    product_data.type === "extension_de_banner"
  ) {
    const pd = product_data as AltaMaterial_ProductInit;
    orgs = await getOrg(pd.banners);
    canales = pd.canal_distribucion;
  } else if (
    product_data.type === "cambio_precios" ||
    product_data.type === "cambio_precio_venta"
  ) {
    const pd = product_data as CambioPrecios_Init;

    // obtener los banners en los que se ha dado de alta,  como son varios UPC, traer todos...
    // obtener los canales de distribucion
    for (const v of Object.values(product_data.art.variantes)) {
      let material = await getMaterial(v.upc);
      if (material) {
        const m = material as AltaMaterial_Articulo;
        const orgs_variant = await getOrg(m.Banners[product_data.art.Sociedad]);
        orgs = Array.from(new Set([...orgs, ...orgs_variant]));
      } else {
        // ! no deberia pasar, si se detectaron cambios fue en este nodo...
      }
    }

    const prox = proxMiercoles();
    fecha = formatDate(prox);

    fechaFin = await getFechaFin(prox, pd.consecutivo.toString());

    const canalesPorSociedad = await getSimple(
      "CanalesPorSociedad",
      product_data.art.Sociedad
    );
    canales = Object.values(canalesPorSociedad);
  } else {
    console.log("no type");
    throw new Error(`no type found ${product_data.push_id}`);
  }

  // INFO BASE QUE NO CAMBIA EN LOS ITEMS
  const getBase = (listaPrecios: string) => {
    let precio: string = product_data.art.Precio_venta;

    if (listaPrecios === "04") {
      const numberP = Number(precio);
      const sinIVA = numberP / 1.16;
      const ochoIVA = sinIVA * 1.08;
      precio = ochoIVA.toFixed(2).toString();
    }

    return {
      codigoInterno: product_data.push_id!,
      claseCondicion: "VKP0", // SIEMPRE FIJO
      unidadMedida: "PCE",
      E1KONH: [
        {
          inicioValidez: fecha,
          finValidez: fechaFin,
          E1KONP: [
            {
              claseCondicion: "VKP0", // SIEMPRE FIJO
              importeOPorcentaje: precio, // precio venta
            },
          ],
        },
      ],
    };
  };

  const generico = product_data.consecutivo.toString().padStart(18, "0");

  /**
   * Obtiene un item para preciosVenta
   * @param org organización/banner
   * @param canal canal de distribución
   * @param base info que no debe cambiar en todos los items
   * @returns item
   */
  const getItem = (
    org: string,
    canal: string,
    listaPrecios: string,
    numMat: string
  ) => {
    const base = getBase(listaPrecios);
    return {
      ...base,
      organizacionVentas: org,
      canalDistribucion: canal,
      listaPrecios: listaPrecios,
      numeroMaterial: numMat,
    };
  };

  // POR CADA ORGANIZACIÓN
  for (const org of orgs) {
    // POR CADA CANAL
    for (const canal of canales) {
      // POR CADA LISTA DE PRECIOS
      for (const lp of ["03", "04"]) {
        // CONSTRUIR UN ITEM PARA preciosVenta
        precios.push(getItem(org, canal, lp, generico));
      }
    }
  }

  // BODY PARA CPI
  return {
    preciosVenta: precios,
  };
};

/**
 * El cambio de precio de venta deberá tener la fecha de inicio
 * del miércoles de la próxima semana (semana en curso para autorizar cambios se contempla de lunes a domingo)
 * @returns obtiene el Date del miercoles de la próxima semana
 */
export const proxMiercoles = () => {
  var d = new Date();
  // proximo lunes
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
  // sumo dos dias
  d.setDate(d.getDate() + 2);

  return d;
};

/**
 * Cambio de precio de venta debe tener como fecha fin un día antes a la fecha inicio más próxima programada,
 * esto en caso de existir uno o más cambios de venta programados, en caso que no, se debe mandar el fin de los tiempos.
 */
export const getFechaFin = async (proxMiercoles: Date, materialID: string) => {
  const preciosSAP: PreciosVentaSAP[] = await getPrecioVenta(materialID);

  // * OBTENER LISTA DE FECHAS DE INICIO DE VALIDEZ
  const inicios: Date[] = preciosSAP.flatMap((i) =>
    i.E1KONH.map((j) => {
      const s = j.inicioValidez;
      const y = Number(s.substring(0, 4));
      const m = Number(s.substring(4, 6));
      const d = Number(s.substring(6));
      return new Date(y, m - 1, d); //los meses inician en 0
    })
  );

  // * OBTENER FECHA DE FIN DE VALIDEZ
  let finDate,
    fechaFin = "99991231";

  // obtiene la proxima fecha de inicio de validez (debe ser mayor que la fecha del proximo miercoles)
  const prox_inicio_index = inicios
    .sort((a, b) => a.getTime() - b.getTime())
    .findIndex((date) => date.getTime() - proxMiercoles.getTime() >= 0);

  if (inicios[prox_inicio_index]) {
    // obtiene la fecha fin para la actualización, un día antes de la proxima fecha inicio
    const prox_inicio = inicios[prox_inicio_index];
    finDate = new Date(prox_inicio.setDate(prox_inicio.getDate() - 1));
    fechaFin = formatDate(finDate);
  }

  return fechaFin;
};
