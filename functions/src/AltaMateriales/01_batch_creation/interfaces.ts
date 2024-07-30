export type Batch_Types = "nuevo_completo" | "cambio_precios" | "cambio_precio_venta" | "cambio_precio_compra" | "extension_de_banner"

/**
 * Estructura del request de 01_batch_creation
 */
export interface AltaMaterial_Request {
    items: AltaMaterial_Request_Item[]
    batch_id: string
    type?: Batch_Types
}

export interface AltaMaterial_Request_Item {
    [key: string]: any
    Proveedor: string
    Marca: string
    MarcaId: string
    Unidades: string[]
    variantes: {
        [talla: string]: {
            upc: string
            talla: string
        }
    }
}

export type JobStatus = 'pending' | 'queued' | 'processing' | 'success' | 'failed'

export interface Job {
    uid: string
    date: string;
    art: AltaMaterial_Articulo;
    type: Batch_Types;
    push_id?: string;
    consecutivo: number;
    batch_id?: string;
}

/**
 * Estructura que tendremos en firebase_materiales/AltaMaterialesStatus
 */
export interface AltaMaterial_ProductInit extends Job {
    canal_distribucion: string[]
    banners: string[]
    status: AltaMaterial_Status | ExtensionMaterial_Status
    batch_id: string
}

export interface CambioPrecios_Init extends Job {
    status?: CambioPrecios_Status;
}

/**
 * Estructura que agrupa jobs de un batch de selección de materiales para ver su status general
 */
export interface SeleccionMaterialBatchStatus {
    [jobID: string]: JobStatus
}

export interface BannerStores {
    [id: string]: string;
}

export interface AltaMaterial_Articulo {
    [key: string]: any
    Estilo: string
    MarcaID: string
    Marca: string
    Color: string
    Division: string
    Genero: string
    Deporte: string
    Silueta: string
    Temporada: string
    Ano: string
    Disponible_desde?: string
    Descripcion_larga: string
    Descripcion_corta: string
    Precio_compra: string
    Precio_venta: string
    variantes: {
        [upc: string]: {
            upc: string
            tallaProveedor: string
            consecutivo: number
            subgenero?: string
            edad?: string
        }
    }
}

export interface CambioPrecios_Status {
    4?: AltaMaterial_Status_Segment;
    5?: AltaMaterial_Status_Segment;
}

export interface AltaMaterial_Status {
    1: AltaMaterial_Status_Segment
    2: AltaMaterial_Status_Segment
    3: AltaMaterial_Status_Segment
    4: AltaMaterial_Status_Segment
    5: AltaMaterial_Status_Segment
    6: AltaMaterial_Status_Segment
}

export interface ExtensionMaterial_Status {
    1: AltaMaterial_Status_Segment
    3: AltaMaterial_Status_Segment
    4: AltaMaterial_Status_Segment
    5: AltaMaterial_Status_Segment
    6: AltaMaterial_Status_Segment
}

export interface AltaMaterial_Status_Segment {
    date: string
    msg: string
    status: JobStatus
    success: boolean
    cpi?: {
        queue_resp: {
            raw: {
                message: CPI_Queue_Message[]
            }
        }
        status_report?: SegmentStatusCallback_Notificacion[]
    }
}

export interface CPI_Queue_Message {
    returnType: string
    returnId: string
    returnNumber: string
    returnMessage: string
}

export interface SegmentStatusCallback {
    notificaciones: SegmentStatusCallback_Notificacion[]
}

export interface SegmentStatusCallback_Notificacion {
    articulo: string
    codigoInterno: string
    IDOCID: string
    //Varía dependiendo del segmento que haya sido
    messageArticulo?: SegmentStatusCallback_R52[]
    messageJerarquias?: SegmentStatusCallback_R56[]
    messageInforecord?: SegmentStatusCallback_R53[]
    messagePreciosCompra?: SegmentStatusCallback_R54[]
    messagePreciosVenta?: SegmentStatusCallback_R55[]
    messageCatalogacion?: SegmentStatusCallback_R57[]
}

export interface SegmentStatusCallback_Any {
    returnType: string
    returnId: string
    returnNumber: string
    returnMessage: string
}

/**
 * Estructura de respuesta de estatus para el segmento del Artículo
 */
export interface SegmentStatusCallback_R52 extends SegmentStatusCallback_Any { }

/**
 * Estructura de respuesta de estatus para el segmento de Jerarquía
 */
export interface SegmentStatusCallback_R56 extends SegmentStatusCallback_Any { }

/**
 * Estructura de respuesta de estatus para el segmento de Registroinfo
 */
export interface SegmentStatusCallback_R53 extends SegmentStatusCallback_Any {
}

/**
 * Estructura de respuesta de estatus para el segmento de Precios de Compra
 */
export interface SegmentStatusCallback_R54 extends SegmentStatusCallback_Any { }

/**
 * Estructura de respuesta de estatus para el segmento de Precios de Venta
 */
export interface SegmentStatusCallback_R55 extends SegmentStatusCallback_Any { }

/**
 * Estructura de respuesta de estatus para el segmento de Catalogación
 */
export interface SegmentStatusCallback_R57 extends SegmentStatusCallback_Any { }


/**
 * *************************
 */

export const MATERIAL_SEGMENTS = [
    1, //segmento 1: R52 Articulo
    2, // segmento 2: R56 Jerarquía
    3, // segmento 3: R53 Registro Info
    4, // segmento 4: R54 Precio Compra
    5, // segmento 5: R55 Precio Venta
    6, // segmento 6: R57 Catalogación
]

export function generateMaterialInitialStatus(date: string) {
    const status: any = {};
    MATERIAL_SEGMENTS.forEach((segment) => {
        status[segment] = {
            date,
            status: "pending",
            success: false,
            msg: "",
        };
    });

    return status as AltaMaterial_Status;
}

export const CAMBIO_PRECIOS_SEGMENTS = [
    4, // segmento 4: R54 Precio Compra
    5, // segmento 5: R55 Precio Venta
]

export const CAMBIO_PRECIO_COMPRA_SEGMENTS = [
    4, // segmento 4: R54 Precio Compra
]

export const CAMBIO_PRECIO_VENTA_SEGMENTS = [
    5, // segmento 5: R55 Precio Venta
]

export function generateCambioPreciosInitialStatus(date: string, type: string) {
    // DE ACUERDO AL SUBTIPO SE VAN A LLAMAR CIERTOS SEGMENTOS
    let segments: any[] = [];
    switch (type) {
        case "cambio_precios":
            segments = CAMBIO_PRECIOS_SEGMENTS;
            break;
        case "cambio_precio_venta":
            segments = CAMBIO_PRECIO_VENTA_SEGMENTS;
            break;
        case "cambio_precio_compra":
            segments = CAMBIO_PRECIO_COMPRA_SEGMENTS;
            break;
    }

    const status: any = {};
    segments.forEach((segment) => {
        status[segment] = {
            date,
            status: "pending",
            success: false,
            msg: "",
        };
    });

    return status as AltaMaterial_Status;
}

export const EXTENSION_BANNER_SEGMENTS = [
    3, // segmento 3: R53 Registro Info
    4, // segmento 4: R54 Precio Compra
    5, // segmento 5: R55 Precio Venta
    6, // segmento 6: R57 Catalogación
]

export function generateExtensionBannerInitialStatus(date: string) {
    const status: any = {};
    EXTENSION_BANNER_SEGMENTS.forEach((segment) => {
        status[segment] = {
            date,
            status: "pending",
            success: false,
            msg: "",
        };
    });

    return status as ExtensionMaterial_Status;
}

/** Nodo de AltaMaterialesConsecutivosJobs (realtime) */
export interface ConsecutivoJob {
    generico: number;
    variantes: {
        [talla: string]: number
    }
}