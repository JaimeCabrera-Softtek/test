import { Timestamp } from "firebase-admin/firestore";

export interface Cajas {
    [clave: string]: Caja;
}

export interface Caja {
    tipo_encabezado: string;
    no_tienda: string;
    tipo_contenedor: string;
    no_caja: string;
    contenido: Contenido[];
}

export interface Contenido {
    tipo_encabezado: string;
    codigo_barra: string;
    tipo_codigo: string;
    blanco: string;
    estilo_modelo: string;
    talla: string;
    color: string;
    no_piezas: string;
    unidad: string;
    no_piezas_unidad: string;
    costo_unitario: string;
}

export interface ASNAppointment {
    ASN: number[];
    AppointedTime: Timestamp;
    CEDIS: string;
    Detalles_ASN: {
        [key: string]: {
            ASN: number;
            Bultos_Enviados: number;
            Entrega_Entrante: string;
            Pedido: string;
            Tipo_Pedido: string;
        }
    }
    Duration_Minutes: number;
    Folio_Cita: number;
    ID: string;
    ProviderID: string;
    SAP_ProviderID: string;
    ShipmentNumber: string;
}