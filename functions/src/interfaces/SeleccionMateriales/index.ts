import { User } from "../user";

export interface materialFileData {
    "provider": string,
    "brand": string
    "brandData": brand
    "products": MaterialData[]
    [key: string]: any
}

export interface MaterialData {
    Estilo:string
    Unidades: string[];
    Tallas: string[] | undefined;
    Commerce: string[] | undefined;
    [key: string]: any
}

export interface MaterialSelect {
    Marca: string;
    Proveedor: string;
    MarcaId: string;
    Catalogo: string; // ?
    MarcaSAP: string;
    Temporada: string;
    Ano: string;
    Genero: string; // !
    Descripcion_larga: string;
    Descripcion_corta: string;
    Deporte: string; // !
    Color: string; // !
    Division: string; // !
    Silueta: string; // !
    Precio_venta: string;
    Precio_compra: string;
    Moneda_venta: string;
    Moneda_costo: string;
    Unidades: string[]; // !
    Estilo: string,
    variantes:any
    // variantes: {
    //     [key: string]: {
    //         tallaProveedor: string;
    //         upc: string;
    //     };
    // };
}

export interface realtimeMaterial {
    Color: string;
    Deporte: string;
    "Descripción corta del producto": string;
    "Descripción larga del producto": string;
    "Disponible desde": string;
    División: string;
    Estilo: string;
    Silueta: string;
    Género: string;
    "Moneda costo": string;
    "Moneda venta": string;
    "Precio de compra del producto": string;
    "Precio venta del producto": string;
    Talla: string;
    UPC: string;
    "Unidad de medida": string;
    brand: string;
    catalog: string;
    provider: string;
    season: string;
    [key: string]: any
}

export interface missingMaterial {
    UPC: string;
    Unidades: string[];
}


export interface brand {
    id: string;
    name: string;
    SAP_id: string;
}

export interface userData extends User {
    Unidades: string[]
    deportes: string[]
}