import { Timestamp } from "firebase-admin/firestore";

/**
 * Estructura de un doc catálogo
 */
export interface catalog {
  sociedad_SAP: "1001" | "2001";
  brand_id: string;
  brand_idSAP: string;
  brand_name: string;
  current: true;
  date_uploaded: Timestamp;
  /** INDICA LA ÚLTIMA VEZ QUE SE ACTUALIZÓ EL JSON DE PRODUCTOS OK PARA VENTAS */
  date_updated?: Timestamp;
  paths: {
    /** Carpeta del catálogo */
    root: string;
    /** PATH HACIA EL ARCHIVO .JSON QUE REPRESENTA LA CABECERA DEL CATÁLOGO */
    cabecera: string;
    /** PATH HACIA EL ARCHIVO (XLSX|XML) SUBIDO ORIGINALMENTE, YA CUMPLIÓ CON REGLAS 1 */
    catalog: string;
    /** PATH HACIA EL JSON CON TODOS LOS PRODUCTOS */
    all_products: string;
    /** PATH HACIA EL JSON CON LOS ERRORES EN REGLAS 2, LO QUE VE EL PROVEEDOR */
    error_rules2?: string;
    /**  PATH HACIA EL JSON CON LOS PRODS QUE NO SE PUDIERON TRANSFORMAR, LO VE MDM */
    error_transformations?: string;
  };
  doc_id: string;
  catalog_id: string;
  item_status: {
    /** TOTAL DE UPC active = true */
    total_activos?: number;
    /** TOTAL DE UPC active = false */
    total_inactivos?: number;
    /** TOTAL DE OBJETOS QUE NO SE PUDIERON TRANSFORMAR */
    total_error_MDM?: number;
    /**  TOTAL DE OBJETOS CON ERRORES DE REGLAS 2 */
    total_error_provider?: number;
    /** TOTAL DE OBJETOS QUE PASARON REGLAS 2 Y TRANSFORMACIONES */
    total_ok?: number;
    /** TOTAL DE UPC QUE SE IDENTIFICARON COMO REUTILIZADOS */
    total_reutilizados?: number;
    /** TOTAL DE OBJETOS QUE TIENE EL CATÁLOGO (APROBARON SOLO REGLAS 1) */
    total: number;
  };
  provider_id: string;
  provider_name: string;
  provider_idSAP?: string;
  season: {
    name: string;
    year: number;
  };
  /**
   * enviado: ES PARA CUANDO SE RECIBIÓ UN NUEVO CATÁLOGO (SOLO APROBARON REGLAS 1)
   *
   * revisión: ES PARA CUANDO NO SE PUDIERON TRANSFORMAR ALGUNOS PRODUCTOS Y LO TIENE QUE REVISAR EL MDMD
   *
   * aprobado: CUANDO ALGUNOS PRODUCTOS PASARON LAS REGLAS 2 Y SI SE PUDIERON TRANSFORMAR
   */
  status: "enviado" | "revision" | "aprobado" | "procesando";
  carga: "MANUAL" | "AUTO";
  // filters: { [filterName: string]: {[key:string]:number}}
  filters: { [filterName: string]: { items: string[]; count: number[] } };
}

export interface Historic {
  [UPC: string]: { [date: string]: any };
}

export interface productsMap {
  [UPC: string]: any;
}

export interface appConfig {
  catalogSheetData: string;
  catalogSheetProducts: string;
  fieldIdCatalog: string;
  fieldIdBrand: string;
  fieldIdSAPProvider: string;
  fieldSeason: string;
  fieldYear: string;
  APIKeyRegex: string;
  ["Deporte proveedor"]: string[];
  ["Division proveedor"]: string[];
  ["Genero proveedor"]: string[];
  ["Roles options"]: string[];
  /** Es un mapa que ayuda en la detección de cambios (productos dados de alta en SAP vs productos de un nuevo catálogo)
   * La key es el campo en SAP y el value es el equivalente al campo en el catálogo.
   * Por ejemplo: UPC_SAP -> UPC */
  fieldsToCheckChanges: { [campoSAP: string]: string };
}

/**
 * Interface de la marca de una colección
 */
export interface Brand {
  SAP_id: string;
  active: boolean;
  created: Timestamp;
  icon: string;
  id: string;
  name: string;
}

export interface Changes {
  [ID: string]: change;
}

export interface change {
  cabecera: changesCabecera;
  cambios: changesLog;
  allChangesCheck: boolean;
  id?: string;
  precios?: {
    compra: string;
    venta: string;
  };
}

export interface changesCabecera {
  productName?: string;
  providerID: string;
  providerIDSAP: string;
  brandID: string;
  catalogID: string;
  catalogName: string;
  date: string;
  season: string;
  estilo?: string;
  generico?: string;
  variantesSAP?: any[];
  variantesIBN?: string[];
  sociedad: string;
}

export interface changesLog {
  [field: string]: {
    before: any;
    after: any;
    log?: {
      approved: boolean;
      date?: string;
      user?: string;
    };
  };
}

export interface PreprocessingRules {
  replacedCharacters?: string; // String que representa todos los caracteres que se van a borrar
  replacement?: string; // String que representa a que se va a cambiar todos los caracteres en replacedCharacters
  casing?: "toCaps" | "toLower" | "capitalize";
  mantenerAcentos?: boolean; // quitar acentos de las letras
  substring?: Substring;
}

export interface Substring {
  [field: string]: any;
  _default: number;
  _excluded?: string[];
}

export interface Jerarquia_Solicitada {
  UPC: string;
  Estilo: string;
  Jerarquia_Solicitada: string;
  Proveedor_IBN_ID: string;
  Proveedor_SAP_ID: string;
  Proveedor_Name: string;
  Catalogo_IBN_ID: string;
  Catalogo_Prov_ID: string;
}
