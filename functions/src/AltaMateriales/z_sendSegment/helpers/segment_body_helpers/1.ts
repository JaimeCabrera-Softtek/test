import { db_materiales } from "../../../../firebase";
import { HELPER_CATALOGS } from "../../../../z_helpers/constants";
import {
  AltaMaterial_Articulo,
  AltaMaterial_ProductInit,
} from "../../../01_batch_creation/interfaces";
import { getFeatureFlagMateriales } from "../fb_materiales_helpers";
import {
  getCaracteristicaMaterial,
  getGrupoCompras,
  getKeyForDeporte,
  getKeyForDivision,
  getKeyForGenero,
  getKeyForSilueta,
  getSegmento1Tallas,
  getStoresFromBanner,
} from "../helperCatalogs";

/**
 * Genera el numero de variante
 * @param consecutivo numero de consecutivo del articulo - NO 18 caracteres
 * @param generico numero generico del articulo - NO 18 caracteres
 * @returns id de la variante - 18 caracteres - solo numeros - "000000007000016001"
 */
export function getVariante(consecutivo: number, generico: number): string {
  const concat = `${generico.toString()}${consecutivo
    .toString()
    .padStart(3, "0")}`;
  return concat.padStart(18, "0");
}

/**
 * Genera la fecha actual en formato yyyyMMdd
 * @returns fecha de 8 caracteres - solo numeros - "20230109"
 */
function getFechaActual(): string {
  const ahora = new Date(Date.now());
  const anio = ahora.getFullYear();
  const mes = (ahora.getMonth() + 1).toString().padStart(2, "0");
  const dia = ahora.getDate().toString().padStart(2, "0");
  return `${anio}${mes}${dia}`;
}

/**
 * Obtiene el array de tallas
 * @param variantes
 * @returns array de tallas - ["S", "M", "L", "XL"...]
 */
function getTallasArray(
  variantes: AltaMaterial_Articulo["variantes"]
): string[] {
  return Object.keys(variantes).map((upc) => variantes[upc].tallaProveedor);
}

async function getOrgsVenta() {
  const ref = db_materiales.ref(HELPER_CATALOGS).child("OrganizacionCompras");
  const fullDict = (await ref.once("value")).val();

  const values = Object.values(fullDict);
  // ! LA ORGS 2002, 1011, 1012, 1013 NO SE DEBEN TOMAR EN CUENTA
  let orgsVenta: string[] = values.filter(
    (org) =>
      org !== "2002" && org !== "1011" && org !== "1012" && org !== "1013"
  ) as string[];

  return Array.from(new Set(orgsVenta));
}

/**
 * Construye el nodo E1BPE1AUSPRT
 * @param generico numero generico del articulo - NO 18 caracteres
 * @param tallasArray array de tallas - ["S", "M", "L", "XL"...]
 * @param color color del articulo - "AMARILLO"
 * @param variantes variantes del articulo - {upc: {upc: "000000007000016001", tallaProveedor: "S", consecutivo: 1}, ...}
 * @returns array de objetos para el nodo E1BPE1AUSPRT
 */
function constructUsprt(
  generico: number,
  tallasArray: string[],
  color: string,
  variantes: AltaMaterial_Articulo["variantes"],
  tallaSegmento1: string,
  subsilueta?: string,
  franquicia?: string,
  version?: string,
  fit?: string
) {
  const genericoTemplate = (char_name: string, char_value: string) => {
    return {
      material: generico.toString().padStart(18, "0"),
      tallas: char_name,
      tamanos: char_value.toString(),
      longitudMaterial: generico.toString().padStart(18, "0"),
      valorCaracteristica: char_value.toString(),
      longitudValorLargo: char_value.toString(),
    };
  };

  const varianteTemplate = (
    char_name: string,
    char_value: string,
    variante: string
  ) => {
    return {
      material: variante,
      tallas: char_name,
      tamanos: char_value.toString(),
      longitudMaterial: variante,
      longitudValorLargo: char_value.toString(),
      valorCaracteristica: char_value.toString(),
      CodigoDependencia: "1", //fijo
    };
  };

  let usprt: any[] = [];

  // * TALLAS
  //Se crea el objeto generico para cada talla
  tallasArray.forEach((talla) => {
    usprt.push(genericoTemplate(tallaSegmento1, talla));
  });

  //Se crea el objeto variante para segun el array de variantes
  Object.keys(variantes).forEach((upc) => {
    usprt.push(
      varianteTemplate(
        tallaSegmento1,
        variantes[upc].tallaProveedor,
        getVariante(variantes[upc].consecutivo, generico)
      )
    );
  });

  // * COLORES
  //Se crea el objeto generico para el color
  usprt.push(genericoTemplate("COLORES", color));

  //Se crea el objeto color para cada variante
  Object.keys(variantes).forEach((upc) => {
    usprt.push(
      varianteTemplate(
        "COLORES",
        color,
        getVariante(variantes[upc].consecutivo, generico)
      )
    );
  });

  // * SUBSILUETA (KBS 7)
  if (subsilueta) {
    //Se crea el objeto generico para el color
    usprt.push(genericoTemplate("SUBSILUETA", subsilueta));

    //Se crea el objeto color para cada variante
    Object.keys(variantes).forEach((upc) => {
      usprt.push(
        varianteTemplate(
          "SUBSILUETA",
          subsilueta,
          getVariante(variantes[upc].consecutivo, generico)
        )
      );
    });
  }

  // * FRANQUICIA (KBS 8)
  if (franquicia) {
    //Se crea el objeto generico para el color
    usprt.push(genericoTemplate("FRANQUICIA", franquicia));

    //Se crea el objeto color para cada variante
    Object.keys(variantes).forEach((upc) => {
      usprt.push(
        varianteTemplate(
          "FRANQUICIA",
          franquicia,
          getVariante(variantes[upc].consecutivo, generico)
        )
      );
    });
  }

  // * SUBGENERO (KBS 9)

  //Se crea el objeto generico para el color
  usprt.push(genericoTemplate("SUBGENERO", ""));

  //Se crea el objeto color para cada variante
  Object.keys(variantes).forEach((upc) => {
    usprt.push(
      varianteTemplate(
        "SUBGENERO",
        variantes[upc].subgenero ?? "",
        getVariante(variantes[upc].consecutivo, generico)
      )
    );
  });

  // * EDAD (KBS 10)
  //Se crea el objeto generico para el color
  usprt.push(genericoTemplate("EDAD", ""));

  //Se crea el objeto color para cada variante
  Object.keys(variantes).forEach((upc) => {
    usprt.push(
      varianteTemplate(
        "EDAD",
        variantes[upc].edad ?? "",
        getVariante(variantes[upc].consecutivo, generico)
      )
    );
  });

  // * VERSION (KBS 11)
  if (version) {
    //Se crea el objeto generico para el color
    usprt.push(genericoTemplate("VERSION", version));

    //Se crea el objeto color para cada variante
    Object.keys(variantes).forEach((upc) => {
      usprt.push(
        varianteTemplate(
          "VERSION",
          version,
          getVariante(variantes[upc].consecutivo, generico)
        )
      );
    });
  }

  // * FIT (KBS 12)
  if (fit) {
    //Se crea el objeto generico para el color
    usprt.push(genericoTemplate("FIT", fit));

    //Se crea el objeto color para cada variante
    Object.keys(variantes).forEach((upc) => {
      usprt.push(
        varianteTemplate(
          "FIT",
          fit,
          getVariante(variantes[upc].consecutivo, generico)
        )
      );
    });
  }

  return usprt;
}

/**
 * Construye el nodo E1BPE1AUSPRT
 * @param generico numero generico del articulo - NO 18 caracteres
 * @param tallasArray array de tallas - ["S", "M", "L", "XL"...]
 * @param color color del articulo - "AMARILLO"
 * @param variantes variantes del articulo - {upc: {upc: "000000007000016001", tallaProveedor: "S", consecutivo: 1}, ...}
 * @returns array de objetos para el nodo E1BPE1AUSPRT
 */
function constructUsprtX(
  generico: number,
  variantes: AltaMaterial_Articulo["variantes"],
  tallaSegmento1: string,
  subsilueta?: string,
  franquicia?: string,
  version?: string,
  fit?: string
) {
  const genericoTemplate = (char_name: string) => {
    return {
      material: generico.toString().padStart(18, "0"),
      tallas: char_name,
      longitudMaterial: generico.toString().padStart(18, "0"),
    };
  };

  const varianteTemplate = (variante: string, char_name: string) => {
    return {
      material: variante,
      tallas: char_name,
      longitudMaterial: variante,
    };
  };

  let usprtx: any[] = [];

  // * TALLAS
  //Se crea el objeto generico para para registrar que tendrá "tallas" como característica
  usprtx.push(genericoTemplate(tallaSegmento1));

  //Se crea el objeto variante para segun el array de variantes
  Object.keys(variantes).forEach((upc) => {
    usprtx.push(
      varianteTemplate(
        getVariante(variantes[upc].consecutivo, generico),
        tallaSegmento1
      )
    );
  });

  // * COLORES
  //Se crea el objeto generico para registrar que tendrá "colores" como característica
  usprtx.push(genericoTemplate("COLORES"));

  //Se crea el objeto color para cada variante
  Object.keys(variantes).forEach((upc) => {
    usprtx.push(
      varianteTemplate(
        getVariante(variantes[upc].consecutivo, generico),
        "COLORES"
      )
    );
  });

  // * SUBSILUETA KBS 7
  if (subsilueta) {
    usprtx.push(genericoTemplate("SUBSILUETA"));

    Object.keys(variantes).forEach((upc) => {
      usprtx.push(
        varianteTemplate(
          getVariante(variantes[upc].consecutivo, generico),
          "SUBSILUETA"
        )
      );
    });
  }

  // * FRANQUICIA KBS 8
  if (franquicia) {
    usprtx.push(genericoTemplate("FRANQUICIA"));

    Object.keys(variantes).forEach((upc) => {
      usprtx.push(
        varianteTemplate(
          getVariante(variantes[upc].consecutivo, generico),
          "FRANQUICIA"
        )
      );
    });
  }

  // * SUBGENERO KBS 9
  usprtx.push(genericoTemplate("SUBGENERO"));

  Object.keys(variantes).forEach((upc) => {
    usprtx.push(
      varianteTemplate(
        getVariante(variantes[upc].consecutivo, generico),
        "SUBGENERO"
      )
    );
  });

  // * EDAD (KBS 10)
  usprtx.push(genericoTemplate("EDAD"));

  Object.keys(variantes).forEach((upc) => {
    usprtx.push(
      varianteTemplate(
        getVariante(variantes[upc].consecutivo, generico),
        "EDAD"
      )
    );
  });

  // * VERSION KBS 11
  if (version) {
    usprtx.push(genericoTemplate("VERSION"));

    Object.keys(variantes).forEach((upc) => {
      usprtx.push(
        varianteTemplate(
          getVariante(variantes[upc].consecutivo, generico),
          "VERSION"
        )
      );
    });
  }

  // * FIT KBS 12
  if (fit) {
    usprtx.push(genericoTemplate("FIT"));

    Object.keys(variantes).forEach((upc) => {
      usprtx.push(
        varianteTemplate(
          getVariante(variantes[upc].consecutivo, generico),
          "FIT"
        )
      );
    });
  }

  return usprtx;
}

/**
 * Construye el nodo E1BPE1MARART
 * @param generico numero generico del articulo - NO 18 caracteres
 * @param variantes variantes del articulo - {upc: {upc: "000000007000016001", tallaProveedor: "S", consecutivo: 1}, ...}
 * @returns array de objetos para el nodo E1BPE1MARART
 */
async function constructMarartVariantes(
  product_data: AltaMaterial_ProductInit,
  innergy: boolean
): Promise<any[]> {
  const generico = product_data.consecutivo;
  const marcaID = product_data.art.MarcaSAP;
  const variantes = product_data.art.variantes;

  /**
   * Cuando queramos mandar los atributos de fashion 1, 2, 3... esta flag debe ser true
   * Si es false, será vacío
   */
  const marartVarianteTemplate = (i: string) => {
    return {
      material: getVariante(variantes[i].consecutivo, generico), //variante
      unidadMedidaBase: "ST", //fijo
      unidadMedidaIso: "PCE", //fijo
      BATCH_MGMT: "X",
      inicioValidez:
        product_data.type === "nuevo_completo" ? getFechaActual() : "", //fecha actual yyyyMMdd, vacio para cuando es extensión
      finValidez: "99991231", //fijo
      fechaCreacion:
        product_data.type === "nuevo_completo" ? getFechaActual() : "",
      CONF_MATL: generico.toString().padStart(18, "0"), //generico
      PR_REF_MAT: generico.toString().padStart(18, "0"), //generico
      TAX_CLASS: "1", //fijo cambia a 1
      PRPROFVAR: "2", //fijo
      grupoTipoPosicion: "NORM", //fijo
      TRANS_GRP: "0001",
      sector: "10",
      fuenteAprovisionamiento: "1",
      pesoNeto: "1200",
      priceBand: "X",
      E1BPE1MARART1: {
        marca: marcaID,
        AtributoFashion1: variantes[i].tallaProveedor,
        AtributoFashion2: product_data.art.Color,
        AtributoFashion3: product_data.art.SegmentacionDeProducto, // KBS 5 SEGMENTACIÓN
        grado: "",
        SegmentacionStructura: process.env.SEGMENTACION_STRUCTURA, //fijo
        SegmentacionStrategia: innergy
          ? ""
          : process.env.SEGMENTACION_STRATEGIA, //fijo
        CONF_MATL: generico.toString().padStart(18, "0"), //generico
        PR_REF_MAT: generico.toString().padStart(18, "0"), //generico
        SegmentacionStatus: "X", //fijo
        nivelTemporada: "T", //fijo
        SEGMENTATION_SCOPE: "1", //fijo
        SEGMENTATION_RELEVANCE: "X", //fijo
        longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
        CONF_MATL_LONG: generico.toString().padStart(18, "0"), //generico
        PR_REF_MAT_LONG: generico.toString().padStart(18, "0"), //generico
      },
    };
  };

  let marart: any[] = [
    {
      material: generico.toString().padStart(18, "0"), //generico
      unidadMedidaBase: "ST", //fijo
      unidadMedidaIso: "PCE", //fijo
      BATCH_MGMT: "X", //fijo
      inicioValidez:
        product_data.type === "nuevo_completo" ? getFechaActual() : "", //fecha actual yyyyMMdd, vacio para cuando es extensión
      finValidez: "99991231", //fijo
      fechaCreacion:
        product_data.type === "nuevo_completo" ? getFechaActual() : "",
      TAX_CLASS: "1", //fijo cambia a 1
      PRPROFVAR: "2", //fijo
      grupoTipoPosicion: "SAMM", //fijo
      TRANS_GRP: "0001",
      sector: "10",
      fuenteAprovisionamiento: "1",
      pesoNeto: "",
      priceBand: "X",
      E1BPE1MARART1: {
        marca: marcaID,
        grado: "",
        SegmentacionStructura: process.env.SEGMENTACION_STRUCTURA, //fijo
        SegmentacionStrategia: innergy
          ? ""
          : process.env.SEGMENTACION_STRATEGIA, //fijo
        SegmentacionStatus: "X", //fijo
        nivelTemporada: "T", //fijo //TODO: revisar con Marco 2024-01-22
        SEGMENTATION_SCOPE: "1", //fijo
        SEGMENTATION_RELEVANCE: "X", //fijo
        longitudMaterial: generico.toString().padStart(18, "0"), //generico
        MaterialConfigurable: "X", //fijo
      },
    },
  ];

  //Se crea el objeto marart para cada variante
  Object.keys(variantes).forEach((upc) => {
    marart.push(marartVarianteTemplate(upc));
  });

  return marart;
}

function constructMAW1RT(
  generico: number,
  variantes: AltaMaterial_Articulo["variantes"],
  grupoCompras: string
): any[] {
  const maw1rtVarianteTemplate = (i: string) => {
    return {
      material: getVariante(variantes[i].consecutivo, generico), //variante
      LOADINGGRP: "0001", //fijo, cambia a 0001
      grupoCompras: grupoCompras,
      grupoTransporte: "0001", // CPI debe de incluirlo en la estructura
      categoriaValoracion: "3100", // CPI debe de incluirlo en la estructura
      longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
      REPL_LIST: "1",
      // unidadMedidaVenta: 'ST', // TODO EN ALGUN MOMENTO RETOMAR AHORITA NO 26-02-2024
      // unidadMedidaVentaIso: 'PCE',
      // unidadMedidaSalida: 'ST',
      // unidadMedidaSalidaIso: 'PCE',
    };
  };

  let maw1rt: any[] = [];

  //Se crea el objeto maw1rt para cada variante
  Object.keys(variantes).forEach((upc) => {
    maw1rt.push(maw1rtVarianteTemplate(upc));
  });

  return maw1rt;
}

function constructMaktrt(
  generico: number,
  variantes: AltaMaterial_Articulo["variantes"],
  color: string,
  descripcionLarga: string
): any[] {
  const maktrtVarianteTemplate = (i: string) => {
    return {
      material: getVariante(variantes[i].consecutivo, generico), //variante
      claveIdioma: "S", //fijo
      codigoIdiomaSap: "ES", //fijo
      textoMaterial: `${descripcionLarga} ${variantes[i].tallaProveedor} ${color}`, //descripcion larga+,+talla+,+color
      longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
    };
  };

  let maktrt: any[] = [];

  //Se crea el objeto maktrt para cada variante
  Object.keys(variantes).forEach((upc) => {
    maktrt.push(maktrtVarianteTemplate(upc));
  });

  return maktrt;
}

function constructMARMRT(
  generico: number,
  variantes: AltaMaterial_Articulo["variantes"],
  product: AltaMaterial_Articulo,
  volumeTest: boolean
): any[] {
  const marmrtVarianteTemplate = (i: string) => {
    return {
      //1 por variante
      material: getVariante(variantes[i].consecutivo, generico), //variante
      ean: volumeTest ? "" : variantes[i].upc,
      tipoNumeroArticulo: volumeTest ? "VC" : "", //DEBE IR VACIO PARA QUE SAP LO ASIGNE AUTO
      longitud: product.Largo,
      ancho: product.Ancho,
      altura: product.Alto,
      unidadMedidaDimension: "CM",
      unidadMedidaDimensionISO: "CMT",
      // volumen: '', // SE CALCULA AUTOMATICAMENTE EN SAP
      // unidadVolumen: "CM3",
      // unidadVolumenIso: "CMQ",
      pesoBruto: "1200",
      unidadPesoBruto: "G", //fijo
      unidadPesoBrutoIso: "GRM", //fijo
      unidadMedida: "ST", //fijo
      unidadMedidaIso: "PCE", //fijo
      // unidadMedidaVenta: 'ST',
      // unidadMedidaVentaIso: 'PCE',
      numeradorConversionUnidadMedida: "1", //fijo
      denominadorConversionUnidadMedida: "1", //fijo
      unidadMedidaInferior: "ST", //fijo
      unidadMedidaInferiorIso: "PCE", //fijo
      longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
    };
  };

  let marmrt: any[] = [];

  //Se crea el objeto marmrt para cada variante
  Object.keys(variantes).forEach((upc) => {
    marmrt.push(marmrtVarianteTemplate(upc));
  });

  return marmrt;
}

function constructMLANRT(
  generico: number,
  variantes: AltaMaterial_Articulo["variantes"]
): any[] {
  const mlanrtVarianteTemplate = (i: string) => {
    return {
      material: getVariante(variantes[i].consecutivo, generico), //variante
      pais: "MX", //fijo
      paisIso: "MX", //fijo
      tipoImpuesto1: "MWST", //fijo
      clasificacionFiscal1: "1", //fijo
      longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
      indicadorImpuesto: "2",
    };
  };

  let mlanrt: any[] = [];

  //Se crea el objeto mlanrt para cada variante
  Object.keys(variantes).forEach((upc) => {
    mlanrt.push(mlanrtVarianteTemplate(upc));
  });

  return mlanrt;
}

async function constructMVKERT(
  art: AltaMaterial_Articulo,
  generico: number,
  genericoLong: string,
  variantes: AltaMaterial_Articulo["variantes"],
  todasLasOrgs: string[]
): Promise<any[]> {
  const NOOS = art.NOOS
    ? art.NOOS.toUpperCase().trim() === "SI"
      ? "X"
      : ""
    : "";

  const carryOver = art.CarryOver
    ? art.CarryOver.toUpperCase().trim() === "SI"
      ? "X"
      : ""
    : "";

  const exclusivo = art.Exclusividades
    ? art.Exclusividades.toUpperCase().trim() === "APLICA"
      ? "X"
      : ""
    : "";

  const mvkertBannerTemplate = (org: string, canal: string) => {
    return {
      material: genericoLong, //generico
      organizacionVentas: org,
      canalDistribucion: canal, // depende de la sociedad, 10 -> 1001 50, 60, 70 -> 2001
      CASH_DISC: "X", //fijo
      grupoTiposPosicion: "SAMM", //fijo
      procCatalogacionPt: "ZB", //fijo
      procCatalogacionPc: "ZB", //fijo
      catalogacionSurtidos: "X", //fijo
      fechaInicioListaFilial: getFechaActual(), //fecha actual
      fechaFinListaFilial: "99991231", //fijo
      fechaInicioCeDis: getFechaActual(), //fecha actual
      fechaFinCeDis: "99991231", //fijo
      fechaInicioVentaCeDis: getFechaActual(), //fecha actual
      fechaFinVentaCeDis: "99991231", //fijo
      SELL_DC_FR: getFechaActual(), //fecha actual
      SELL_DC_TO: "99991231", //fijo
      longitudMaterial: genericoLong, //generico
      // unidadMedidaVenta: "ST",
      // unidadMedidaVentaIso: "PCE",
      grupoImputacionMaterial: "01",
      prodAtt3: NOOS, // KBS 1 NOOS
      prodAtt4: carryOver, // KBS 2 CARRY OVER
      prodAtt5: exclusivo, // KBS 4 EXCLUSIVO
    };
  };

  const mvkertVarianteTemplate = (i: string, org: string, canal: string) => {
    return {
      material: getVariante(variantes[i].consecutivo, generico), //variante
      organizacionVentas: org,
      canalDistribucion: canal, // depende de la sociedad, 10 -> 1001 50, 60, 70 -> 2001
      CASH_DISC: "X", //fijo
      grupoTiposPosicion: "NORM", //fijo
      PR_REF_MAT: genericoLong, //generico
      procCatalogacionPt: "ZB", //fijo
      procCatalogacionPc: "ZB", //fijo
      catalogacionSurtidos: "X", //fijo
      fechaInicioListaFilial: getFechaActual(), //fecha actual
      fechaFinListaFilial: "99991231", //fijo
      fechaInicioCeDis: getFechaActual(), //fecha actual
      fechaFinCeDis: "99991231", //fijo
      fechaInicioVentaCeDis: getFechaActual(), //fecha actual
      fechaFinVentaCeDis: "99991231", //fijo
      SELL_DC_FR: getFechaActual(), //fecha actual
      SELL_DC_TO: "99991231", //fijo
      longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
      PR_REF_MAT_LONG: genericoLong, //generico
      // unidadMedidaVenta: "ST",
      // unidadMedidaVentaIso: "PCE",
      grupoImputacionMaterial: "01",
      prodAtt3: NOOS, // KBS 1 NOOS
      prodAtt4: carryOver, // KBS 2 CARRY OVER
      prodAtt5: exclusivo, // KBS 4 EXCLUSIVO
    };
  };

  let mvkert: any[] = [];

  // ? AHORA EN CREACIÓN SE ENVIAN TODAS LAS ORGANIZACIONES CON TODOS LO CANALES DE VENTA ASOCIADOS
  for (const org of todasLasOrgs) {
    let canales = ["10"];

    // la org 2001 solo permite estos canales, el resto, solo el 10
    if (org === "2001") {
      canales = ["50", "60", "70"];
    }

    // por cada org/canal/generico-variante, armar el segmento
    for (const canal of canales) {
      const bannerTemplate = mvkertBannerTemplate(org, canal);
      mvkert.push(bannerTemplate);

      for (const upc of Object.keys(variantes)) {
        const varianteTemplate = mvkertVarianteTemplate(upc, org, canal);
        mvkert.push(varianteTemplate);
      }
    }
  }

  return mvkert;
}

async function getTiendas(
  banners: string[],
  ecommerce: boolean
): Promise<string[]> {
  let tiendas: string[] = [];
  for (const banner of banners) {
    const tiendasBanner = await getStoresFromBanner(banner);
    tiendas = tiendas.concat(Object.keys(tiendasBanner));
  }

  // AGREGAR LA TIENDA 0370 A TODOS LOS BANNERS, MARCO DIJO 26-02 PRESENCIAL
  if (!tiendas.includes("0370")) {
    tiendas.push("0370"); // CEDIS Edo Mx
  }

  if (!tiendas.includes("0166")) {
    tiendas.push("0166");
  }

  // FILTRAR ECOMMERCE si no lo marcó compras
  if (!ecommerce) {
    tiendas = tiendas.filter((v) => !v.startsWith("E"));
  }

  return tiendas;
}

/**
 *
 * @param generico Número del material genérico
 * @param variantes array de todas las variantes
 * @param grupoCompra Valor para el campo grupo de compras
 * @param tiendas tiendas a las que será asignado
 * @returns array de elementos para el segmento MARCRT
 */
async function constructMARCRT(
  generico: number,
  variantes: AltaMaterial_Articulo["variantes"],
  grupoCompra: string,
  tiendas: string[],
  innergy: boolean
): Promise<any[]> {
  /**
   *
   * @param i upc de la variante
   * @param tienda tienda a la que será enviado, o 9998 o 9999
   * @param almacenes [''] para cuando la tienda es 9998 o 9999, si no entonces un array con valores
   * @returns array para hacer push en marcrt
   */
  const marcrtVariante1Template = (
    i: string,
    tienda: string,
    almacenes: string[]
  ) => {
    //#region Asignación de cebe
    //? Catálogo de Marco, dice que es el mismo valor que la tienda ++ TODAS LAS TIENDAS QUE NO SEAN NUMERICAS VA A IR '1'
    const tiendaParseada = parseInt(tienda);
    let cebe = "";
    if (isNaN(tiendaParseada)) {
      //* Para tiendas no numéricas, el cebe es vacio
      cebe = "";
    } else {
      if (["9998", "9999"].includes(tienda)) {
        //* Para 9998 y 9999 el cebe es vacío
        cebe = "";
      } else if (tienda === "7501") {
        cebe = "M1";
      } else {
        //* Marco dice que es el mismo valor que la tienda, sin los 0 de la izquierda
        cebe = tiendaParseada.toString().padStart(10, "0");
      }
    }
    //#endregion Asignación de cebe

    return almacenes.map((x) => ({
      //1 por variante
      material: getVariante(variantes[i].consecutivo, generico), //variante
      centro: tienda,
      grupoCompras: grupoCompra, //Catalogo chat de teams
      caracteristicaPlaneacion: "PD", //fijo
      plazoEntragaPrevistoDias: "15", //fijo 2024-01-31 ponemos 15 según la guía de Alberto (Excel)
      indPeriodo: "W", //fijo
      proc_type: "F", //fijo
      LOADINGGRP: "0001", //fijo
      AUTO_RESET: "X", //fijo
      lot_size: "1.000", //fijo
      fuenteAprovisionamiento: "1",
      indPedidoAutomatico: "X",
      stocksNegativosPermitidos: "X",
      almacenPropuestoAprovisionamiento: x,
      centroBeneficio: cebe,
      planeacionNecesidades: "001",
      gr_pr_time: "",
      LOTSIZEKEY: "EX",
      sproctype: "40",
      grupoVerificacion: "Z2",
      E1BPE1MARCRT1: {
        SEGMENTATION_STATUS: "X", //fijo
        SEGMENTATION_SCOPE: "1", //fijo
        longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
        SEGMENTATION_STRATEGY: innergy
          ? ""
          : process.env.SEGMENTACION_STRATEGIA, //fijo
      },
    }));
  };

  let marcrt: any[] = [];

  const enabled = await getFeatureFlagMateriales("constructMARCRT_tiendas");
  if (enabled) {
    //Mandar las variantes a todas las tiendas, con true para mandarlas a los almacenesPropuestos
    for (const tienda of tiendas) {
      let almacenes = ["1001"];

      if (tienda === "0370" || tienda === "0166" || tienda === "9999") {
        almacenes = ["1002"];
      }

      for (const upc of Object.keys(variantes)) {
        const variante1Result = marcrtVariante1Template(upc, tienda, almacenes);
        marcrt.push(...variante1Result);
      }
    }
  }

  return marcrt;
}

function constructMBEWRT(
  variantes: AltaMaterial_Articulo["variantes"],
  generico: number
): any[] {
  const mbewrtVarianteTemplate = (i: string) => {
    return ["9998", "9999"].map((x) => ({
      //1 por variante por tienda
      material: getVariante(variantes[i].consecutivo, generico), //variante
      ambitoValoracion: x, //fijo
      indControlPrecios: "V", //fijo
      MOVING_PR: "0", //fijo //TODO: revisar con Marco/negocio
      PRICE_UNIT: "1", //fijo
      VAL_CLASS: "3100", //fijo
      PR_CTRL_PP: "V", //fijo
      MOV_PR_PP: "0", //fijo //TODO: revisar con Marco/negocio
      PR_UNIT_PP: "1", //fijo
      VCLASS_PP: "3100", //fijo
      PR_CTRL_PY: "V", //fijo
      MOV_PR_PY: "0", //fijo //TODO: revisar con Marco/negocio
      PR_UNIT_PY: "1", //fijo
      VCLASS_PY: "3100", //fijo
      longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
    }));
  };

  let mbewrt: any[] = [];

  //Se crea el objeto mbewrt para cada variante
  Object.keys(variantes).forEach((upc) => {
    mbewrt.push(...mbewrtVarianteTemplate(upc));
  });

  return mbewrt;
}

function constructWLK2RT(
  variantes: AltaMaterial_Articulo["variantes"],
  generico: number,
  todasLasOrgs: string[]
): any[] {
  const wlk2rtTemplate = (
    i: string,
    type: "generico" | "variante",
    canal: string,
    org: string
  ) => {
    const mat =
      type === "generico"
        ? i.padStart(18, "0")
        : getVariante(variantes[i].consecutivo, generico);

    return {
      material: mat, //variante
      organizacionVentas: org,
      canalDistribucion: canal, // depende de la sociedad, 10 -> 1001 50, 60, 70 -> 2001
      fechaInicioVentaListaFilial: getFechaActual(), //fecha actual
      fechaFinVentaListaFilial: "99991231", //fijo
      longitudMaterial: mat, //variante
    };
  };

  let wlk2rt: any[] = [];

  // ? AHORA EN CREACIÓN SE ENVIAN TODAS LAS ORGANIZACIONES CON TODOS LO CANALES DE VENTA ASOCIADOS
  for (const org of todasLasOrgs) {
    let canales = ["10"];

    // la org 2001 solo permite estos canales, el resto, solo el 10
    if (org === "2001") {
      canales = ["50", "60", "70"];
    }

    // por cada org/canal/generico-variante, armar el segmento
    for (const canal of canales) {
      //Se crea el objeto wlk2rt para el generico
      wlk2rt.push(wlk2rtTemplate(generico.toString(), "generico", canal, org));

      //Se crea el objeto wlk2rt para cada variante
      Object.keys(variantes).forEach((upc) => {
        wlk2rt.push(wlk2rtTemplate(upc, "variante", canal, org));
      });
    }
  }

  return wlk2rt;
}

function constructVARKEY(
  variantes: AltaMaterial_Articulo["variantes"],
  genericoLong: string,
  generico: number
): any[] {
  let varkey: any[] = [];
  for (const upc of Object.keys(variantes)) {
    varkey.push({
      material: genericoLong, //generico
      longitudMaterial: genericoLong, //generico
      longitudVariante: getVariante(variantes[upc].consecutivo, generico), //variante
      variante: getVariante(variantes[upc].consecutivo, generico), //variante
    });
  }
  return varkey;
}

function constructMAMTRT(
  generico: number,
  variantes: AltaMaterial_Articulo["variantes"],
  descripcion_corta: string
): any[] {
  const camposFijos = {
    claveIdioma: "S",
    codigoIdiomaSap: "ES",
    unidadMedidaAlternativaAlmacen: "ST",
    unidadMedidaAlternativaAlmacenIso: "PCE",
    textoUnidadMedida: "02",
    numeroActualMamt: "01",
  };

  let mamrt_variantes: any[] = [
    // generico
    {
      ...camposFijos,
      textoMaterialUnidadMedida: descripcion_corta,
      longitudMaterial: generico.toString().padStart(18, "0"),
    },
  ];

  for (const variante of Object.values(variantes)) {
    // variantes
    mamrt_variantes.push({
      ...camposFijos,
      textoMaterialUnidadMedida: descripcion_corta,
      longitudMaterial: getVariante(variante.consecutivo, generico),
    });
  }

  return mamrt_variantes;
}

function constructMPOPRT(
  variantes: AltaMaterial_Articulo["variantes"],
  generico: number,
  tiendas: string[]
): any[] {
  const mpoprtVarianteTemplate = (i: string, planta: string) => {
    return {
      //1 por variante por tienda
      material: getVariante(variantes[i].consecutivo, generico), //variante
      PLANT: planta, //fijo
      MODEL_SP: "2", //fijo
      INITIALIZE: "X", //fijo
      TRACKLIMIT: "4.000", //fijo
      HIST_VALS: "60", //fijo
      FORE_PDS: "12", //fijo
      MATERIAL_LONG: getVariante(variantes[i].consecutivo, generico), //variante
    };
  };

  let mpoprt: any[] = [];

  //Se crea el objeto mpoprt para cada variante
  for (const tienda of tiendas) {
    Object.keys(variantes).forEach((upc) => {
      mpoprt.push(mpoprtVarianteTemplate(upc, tienda));
    });
  }

  return mpoprt;
}

function constructMPGDRT(
  variantes: AltaMaterial_Articulo["variantes"],
  generico: number,
  tiendas: string[]
): any[] {
  const template1 = (i: string, tienda: string) => {
    return {
      //1 por variante por tienda
      material: getVariante(variantes[i].consecutivo, generico), //variante
      centro: tienda,
      longitudMaterial: getVariante(variantes[i].consecutivo, generico), //variante
    };
  };

  let mpgdrt: any[] = [];

  //Se crea el objeto mpgdrt para cada variante
  for (const tienda of tiendas) {
    Object.keys(variantes).forEach((upc) => {
      mpgdrt.push(template1(upc, tienda));
    });
  }

  return mpgdrt;
}

async function getGrupoArticulos(product: AltaMaterial_ProductInit) {
  const genero = await getKeyForGenero(product.art.Genero);
  const division = await getKeyForDivision(product.art.Division);
  const deporte = await getKeyForDeporte(product.art.Deporte);
  const silueta = await getKeyForSilueta(product.art.Silueta);

  return `${genero}${division}${deporte}${silueta}`;
}

async function getCaracteristicaMat(product: AltaMaterial_ProductInit) {
  const caracteristica = `P_${product.art.Division}_${product.art.Genero}`;
  // console.log("caracteristica ", caracteristica);
  const caracteristicaMat = await getCaracteristicaMaterial(
    caracteristica.toUpperCase()
  );

  return caracteristicaMat;
}

async function getTalla(caracteristicaMaterial: string) {
  const talla = await getSegmento1Tallas(caracteristicaMaterial);

  return talla;
}

function constructMARDRT(
  generico: string,
  variantes: string[],
  tiendas: string[],
  innergy: boolean
) {
  function MARD_Template(material: string, tienda: string, almacen: string) {
    return {
      centro: tienda,
      almacen: almacen,
      puntoPedido: "0",
      REPL_QTY: "0",
      longitudMaterial: material,
    };
  }

  let mardrt: any[] = [];

  if (!innergy) {
    for (let a of ["1001"]) {
      mardrt.push(MARD_Template(generico, "9998", a));
    }
  }

  for (let variante of variantes) {
    for (let t of tiendas) {
      let almacenes = ["1001"];

      if (t === "0370" || t === "0166" || t === "9999") {
        almacenes = ["1002"];
      }

      for (let a of almacenes) {
        mardrt.push(MARD_Template(variante, t, a));
      }
    }
  }

  return mardrt;
}

export const body01 = async (product_data: AltaMaterial_ProductInit) => {
  /** Es un alta a INNERGY ?  */
  const innergy = product_data.banners.includes("INNERGY");

  //Variables
  const generico: string = product_data.consecutivo
    .toString()
    .padStart(18, "0");
  const tallasArray = getTallasArray(product_data.art.variantes);
  const grupoCompra = await getGrupoCompras(product_data.art.Division);
  const todasLasOrgs = await getOrgsVenta();

  /** Bandera para saber si es prueba de volumen y enviar siempre el mismo grupo de articulos que ya funciona en dev */
  const volumeTest = await getFeatureFlagMateriales("volumeTest");
  let grupoArticulos = "";

  grupoArticulos = await getGrupoArticulos(product_data);

  const caracteristicaMat = await getCaracteristicaMat(product_data);

  //Obtenemos la talla correspondiente a la caracteristica del material
  const talla = await getTalla(caracteristicaMat);

  //Obtenemos la lista de tiendas, si la bandera de la version dos está activa, solo se agregan las que Marco pidió, si no, todas
  const tiendasVersion2 = await getFeatureFlagMateriales("tiendasVersion2");
  /** Bandera que indica si el artículo se dará de alta tambien en la tienda commerce (inicia con E) */
  const ecommerce = product_data.art.Commerce !== "";

  let tiendas = ["9999", "9998", "0166", "0370"];
  if (!innergy) {
    if (tiendasVersion2) {
      if (ecommerce) {
        // concatenar tiendas commerce
        for (const banner of product_data.banners) {
          const tiendasBanner = await getStoresFromBanner(banner);
          // OBTENER LA TIENDA COMMERCE PARA ENVIARLA A SAP (LAS DEMÁS TIENDAS SE EXPLOSIONARÁN CON UN PROGRAMA ABAP)
          const tiendasCommerce = Object.keys(tiendasBanner).filter((v) =>
            v.startsWith("E")
          );

          tiendas = tiendas.concat(tiendasCommerce);
        }
      }
    } else {
      tiendas = await getTiendas(product_data.banners, ecommerce);
    }
  } else {
    tiendas = tiendas.concat("7501");
  }

  if (tiendas.length === 0) {
    throw new Error(
      `No se encontraron tiendas para los banners ${product_data.banners}`
    );
  }

  //Construccion de nodos
  const nodoMarart = await constructMarartVariantes(product_data, innergy);

  const nodoUsprt = constructUsprt(
    product_data.consecutivo,
    tallasArray,
    product_data.art.Color,
    product_data.art.variantes,
    talla,
    product_data.art.Subsilueta, // SUBSILUETA KBS 7
    product_data.art.Franquicia, // FRANQUICIA KBS 8
    product_data.art.Version, // VERSION KBS 11
    product_data.art.Fit // FITT KBS 12
  );

  const nodoUsprtX = constructUsprtX(
    product_data.consecutivo,
    product_data.art.variantes,
    talla,
    product_data.art.Subsilueta, // SUBSILUETA KBS 7
    product_data.art.Franquicia, // FRANQUICIA KBS 8
    product_data.art.Version, // VERSION KBS 11
    product_data.art.Fit // FITT KBS 12
  );

  const variantesMAW1RT = constructMAW1RT(
    product_data.consecutivo,
    product_data.art.variantes,
    grupoCompra
  );

  const variantesMAKTRT = constructMaktrt(
    product_data.consecutivo,
    product_data.art.variantes,
    product_data.art.Color,
    product_data.art.Descripcion_larga
  );

  const variantesMARMRT = constructMARMRT(
    product_data.consecutivo,
    product_data.art.variantes,
    product_data.art,
    volumeTest
  );

  const variantesMLANRT = constructMLANRT(
    product_data.consecutivo,
    product_data.art.variantes
  );

  const nodoMVKERT = await constructMVKERT(
    product_data.art,
    product_data.consecutivo,
    generico,
    product_data.art.variantes,
    todasLasOrgs
  );

  const variantesMBEWRT = constructMBEWRT(
    product_data.art.variantes,
    product_data.consecutivo
  );

  const variantesMARCRT = await constructMARCRT(
    product_data.consecutivo,
    product_data.art.variantes,
    grupoCompra,
    tiendas,
    innergy
  );

  const nodoWLK2RT = constructWLK2RT(
    product_data.art.variantes,
    product_data.consecutivo,
    todasLasOrgs
  );

  const variantesMPOPRT = constructMPOPRT(
    product_data.art.variantes,
    product_data.consecutivo,
    tiendas
  );

  const variantesMPGDRT = constructMPGDRT(
    product_data.art.variantes,
    product_data.consecutivo,
    tiendas
  );

  const variantesVARKEY = constructVARKEY(
    product_data.art.variantes,
    generico,
    product_data.consecutivo
  );

  const nodoE1BPE1MAMTRT = constructMAMTRT(
    product_data.consecutivo,
    product_data.art.variantes,
    product_data.art.Descripcion_corta
  );

  const variantes = Object.values(product_data.art.variantes).map(
    (x: any) =>
      `${product_data.consecutivo.toString().padStart(15, "0")}${x.consecutivo
        .toString()
        .padStart(3, "0")}`
  );

  return {
    creacionArticulo: [
      {
        E1BPE1MATHEAD: {
          funcion: "005", //fijo
          material: generico, //generico
          tipoMaterial: "ZMOD", //fijo
          grupoArticulos: grupoArticulos, //genero+division+deporte+silueta
          codigoInterno: product_data.push_id || "",
          categoriaMaterial: "01", //fijo
          caracteristicaMat: caracteristicaMat, //P_DIVISION_GENERO
          vistaDatosBasicos: "X", //fijo
          vistaListado: "X", //fijo
          vistaVentas: "X", //fijo
          vistaLogisticaCedis: "X", //fijo
          vistaLogisticaTiendas: "X", //fijo
          vistaTpv: "X", //fijo
          longitudMaterial: generico, //generico
          caracteristicaNom: caracteristicaMat, //P_DIVISION_GENERO
          tipoClasificacion: "300", //fijo
        },
        E1BPE1VARKEY: variantesVARKEY,
        E1BPE1AUSPRT: nodoUsprt,
        E1BPE1AUSPRTX: nodoUsprtX,
        E1BPE1MARART: nodoMarart,
        E1BPE1MAW1RT: [
          {
            material: generico, //generico
            LOADINGGRP: "0001", //fijo cambia a 0001
            grupoTransporte: "0001", // CPI debe de incluirlo en la estructura
            grupoCompras: grupoCompra,
            categoriaValoracion: "3100",
            longitudMaterial: generico, //generico
            REPL_LIST: "1",
            // unidadMedidaVenta: 'ST',
            // unidadMedidaVentaIso: 'PCE',
            // unidadMedidaSalida: 'ST',
            // unidadMedidaSalidaIso: 'PCE',
          },
          ...variantesMAW1RT,
        ],
        E1BPE1MAKTRT: [
          {
            material: generico, //generico
            claveIdioma: "S", //fijo
            codigoIdiomaSap: "ES", //fijo
            textoMaterial: product_data.art.Descripcion_larga, //descripcion largadel art
            longitudMaterial: generico, //generico
          },
          ...variantesMAKTRT,
        ],
        E1BPE1MARCRT: [
          {
            //1 por tienda (en el campo "centro")
            material: generico, //generico
            centro: "9998", //fijo
            grupoCompras: grupoCompra, //catalogo (chat de teams)
            caracteristicaPlaneacion: "PD", //fijo
            plazoEntragaPrevistoDias: "15", //fijo
            indPeriodo: "W", //fijo
            proc_type: "F", //fijo
            LOADINGGRP: "0001", //fijo
            AUTO_RESET: "X", //fijo
            lot_size: "1.000", //fijo
            fuenteAprovisionamiento: "1",
            indPedidoAutomatico: "X",
            stocksNegativosPermitidos: "X",
            planeacionNecesidades: "001",
            gr_pr_time: "",
            LOTSIZEKEY: "EX",
            sproctype: "40",
            grupoVerificacion: "Z2",
            E1BPE1MARCRT1: {
              SEGMENTATION_STATUS: "X", //fijo
              SEGMENTATION_SCOPE: "1", //fijo
              longitudMaterial: generico, //generico
              SEGMENTATION_STRATEGY: innergy
                ? ""
                : process.env.SEGMENTACION_STRATEGIA, //fijo
            },
          },
          {
            //1 por centro de distribución (en el campo "centro")
            material: generico, //generico
            centro: "9999", //fijo
            grupoCompras: grupoCompra, //catalogo (chat de teams)
            caracteristicaPlaneacion: "PD", //fijo
            plazoEntragaPrevistoDias: "15", //fijo
            indPeriodo: "W",
            proc_type: "F",
            LOADINGGRP: "0001",
            AUTO_RESET: "X",
            lot_size: "1.000",
            fuenteAprovisionamiento: "1",
            indPedidoAutomatico: "X",
            stocksNegativosPermitidos: "X",
            planeacionNecesidades: "001",
            gr_pr_time: "",
            LOTSIZEKEY: "EX",
            sproctype: "40",
            grupoVerificacion: "Z2",
            E1BPE1MARCRT1: {
              SEGMENTATION_STRATEGY: innergy
                ? ""
                : process.env.SEGMENTACION_STRATEGIA, //fijo
              SEGMENTATION_STATUS: "X", //fijo
              SEGMENTATION_SCOPE: "1", //fijo
              longitudMaterial: generico, //generico
            },
          },
          ...variantesMARCRT,
        ],
        E1BPE1MPOPRT: [
          {
            material: generico, //generico
            PLANT: "9998", //fijo
            MODEL_SP: "2", //fijo
            INITIALIZE: "X", //fijo
            TRACKLIMIT: "4.000", //fijo
            HIST_VALS: "60", //fijo
            FORE_PDS: "12", //fijo
            MATERIAL_LONG: generico, //generico
          },
          {
            material: generico, //generico
            PLANT: "9999", //fijo
            MODEL_SP: "2", //fijo
            INITIALIZE: "X", //fijo
            TRACKLIMIT: "4.000", //fijo
            HIST_VALS: "60", //fijo
            FORE_PDS: "12", //fijo
            MATERIAL_LONG: generico, //generico
          },
          ...variantesMPOPRT,
        ],
        E1BPE1MPGDRT: [
          {
            material: generico, //generico
            centro: "9998", //fijo
            longitudMaterial: generico, //generico
          },
          {
            material: generico, //generico
            centro: "9999", //fijo
            longitudMaterial: generico, //generico
          },
          ...variantesMPGDRT,
        ],
        //Agregar MARD
        E1BPE1MARDRT: constructMARDRT(generico, variantes, tiendas, innergy),
        E1BPE1MARMRT: [
          {
            material: generico, //generico
            tipoNumeroArticulo: "VC",
            unidadMedida: "ST", //fijo
            unidadMedidaIso: "PCE", //fijo
            numeradorConversionUnidadMedida: "1", //fijo
            denominadorConversionUnidadMedida: "1", //fijo
            pesoBruto: "",
            unidadPesoBruto: "G", //fijo, cambia a G, estaba en KG
            unidadPesoBrutoIso: "GRM", //fijo, cambia a GRM, estaba en KGM
            unidadMedidaInferior: "ST", //fijo
            unidadMedidaInferiorIso: "PCE", //fijo
            longitudMaterial: generico, //generico
            longitud: "",
            ancho: "",
            altura: "",
            unidadMedidaDimension: "CM",
            unidadMedidaDimensionISO: "CMT",
          },
          ...variantesMARMRT,
        ],
        E1BPE1MLANRT: [
          {
            material: generico, //generico
            pais: "MX", //fijo
            paisIso: "MX", //fijo
            tipoImpuesto1: "MWST", //fijo
            clasificacionFiscal1: "1", //fijo
            longitudMaterial: generico, //generico
            indicadorImpuesto: "2",
          },
          ...variantesMLANRT,
        ],
        E1BPE1MBEWRT: [
          {
            material: generico, //generico
            ambitoValoracion: "9998", //fijo
            indControlPrecios: "V", //fijo
            MOVING_PR: "0", //fijo //TODO: revisar con Marco/negocio //CAMBIA, EL USUARIO TIENE QUE SELECCIONAR CUAL VA A SER EL PRECIO INTERNO QUE LE DAN, SOLO INNOVA LO VA A SABER
            PRICE_UNIT: "1", //fijo
            VAL_CLASS: "3100", //fijo
            PR_CTRL_PP: "V", //fijo
            MOV_PR_PP: "0", //fijo //TODO: revisar con Marco/negocio //REVISARLO CON ALBERTO (INNOVA)
            PR_UNIT_PP: "1", //fijo
            VCLASS_PP: "3100", //fijo
            PR_CTRL_PY: "V", //fijo
            MOV_PR_PY: "0", //fijo //TODO: revisar con Marco/negocio //REVISARLO CON ALBERTO (INNOVA)
            PR_UNIT_PY: "1", //fijo
            VCLASS_PY: "3100", //fijo
            longitudMaterial: generico, //generico
          },
          {
            material: generico, //generico
            ambitoValoracion: "9999", //fijo
            indControlPrecios: "V", //fijo
            MOVING_PR: "0", //fijo //TODO: revisar con Marco/negocio //REVISARLO CON ALBERTO (INNOVA)
            PRICE_UNIT: "1", //fijo
            VAL_CLASS: "3100", //fijo
            PR_CTRL_PP: "V", //fijo
            MOV_PR_PP: "0", //fijo //TODO: revisar con Marco/negocio //REVISARLO CON ALBERTO (INNOVA)
            PR_UNIT_PP: "1", //fijo
            VCLASS_PP: "3100", //fijo
            PR_CTRL_PY: "V", //fijo
            MOV_PR_PY: "0", //fijo //TODO: revisar con Marco/negocio //REVISARLO CON ALBERTO (INNOVA)
            PR_UNIT_PY: "1", //fijo
            VCLASS_PY: "3100", //fijo
            longitudMaterial: generico, //generico
          },
          ...variantesMBEWRT,
        ],
        E1BPE1MVKERT: nodoMVKERT,
        E1BPE1WLK2RT: nodoWLK2RT,
        E1BPFSHSEASONS: {
          material: generico, //generico
          AnoTemporada: product_data.art.Ano, //año del catálogo del articulo
          Temporada: product_data.art.Temporada, //temporada del articulo
          Descripciontemporada: product_data.art.Temporada, //temporada del articulo
          longitudMaterial: generico, //generico
          IDtemporada: product_data.art.Temporada, //temporada del articulo
          COLLECTION: process.env.COLLECTION ?? "",
          THEME: process.env.THEME ?? "", //TODO ES UN MES, PENDIENTE COMO SE SACA 26-02
        },
        E1BPE1MAMTRT: nodoE1BPE1MAMTRT,
      },
    ],
  };
};
