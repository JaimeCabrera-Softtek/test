//#region firestore collections
export const COLLECTION_MARCAS = "brands";
export const COLLECTION_CATALOGOS = "catalogs";
export const COLLECTION_CONTRATOS = "contracts";
export const COLLECTION_FACTURAS = "invoices";
export const COLLECTION_USUARIOS = "users";
export const COLLECTION_PEDIDOS = "orders";
export const COLLECTION_ORDERBOOKS = "orderbooks";
export const COLLECTION_ASN = "asn";
export const COLLECTION_PROVEEDORES = 'proveedores';
export const COLLECTION_DEVOLUCIONES = "returns";
//#endregion firestore collections

//#region RealtimeDB Nodes
//#region Default-RDTB
export const JERARQUIAS_SOLICITADAS = 'JerarquiasSolicitadas'
//#endregion Default-RDTB

//#region Analytics
export const ANALYTICS_THRESHOLD_DAYS = 'THRESHOLD_DAYS';
//#endregion Analytics

//#region Materiales
export const MATERIALES_BATCH_STATUS = 'BatchMaterialesStatus';
export const THROTTLE_FEATURE_FLAG = 'CloudTasksThrottle'
export const THROTTLE_BUFFER = 'CloudTasksBuffer'
export const THROTTLE_BUFFER_PAGESIZE = 'CloudTasksBufferPageSize'
export const SEGMENT_STATUS_BUFFER = "SegmentStatusBuffer";
export const SEGMENT_STATUS_PAGESIZE = "SegmentStatusBufferPageSize";

/**
 * Nodo para los jobs de alta de materiales
 */
export const ALTA_MATERIALES = "AltaMateriales";
/**
 * HelperCatalogs del alta de materiales
 */
export const HELPER_CATALOGS = "HelperCatalogs";
export const JERARQUIAS_EXISTENTES = 'JerarquiasExistentes'
/**
 * Almacén de los precios de venta R91
 */
export const PRECIOS_VENTA_SAP = "PreciosVentaSAP";
/**
 * Nodo para los materiales que ya se dieron de alta exitosamente en S4
 */
export const MATERIALES = "Materiales";
//#endregion Materiales
//#endregion RealtimeDB Nodes