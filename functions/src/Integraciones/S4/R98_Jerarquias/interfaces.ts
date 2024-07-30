export interface R98Request {
    Jerarquias: R98RequestItem[]
}

export interface R98RequestItem {
    E1WAH02: R98Node[]
    E1WAH06: R98_Level[]
    id: string
    idioma: string
    numero: string
    texto: string
}

export interface R98_Level {
    idioma: string
    posicionNodo: string
    textoExplicativo: string
}


/**
 * ...
 * {
        "descripcion": "TOALLA",
        "fechaCambio": "20240117000030",
        "idioma": "S",
        "nivelNodo": "06",
        "nodo": "UACNAT069112",
        "nodoPadre": "UACNAT069"
    },
    {
        "descripcion": "SPEEDO",
        "fechaCambio": "20240117000030",
        "idioma": "S",
        "nivelNodo": "05",
        "nodo": "UACNAT096",
        "nodoPadre": "UACNAT"
    }
    ...
 */
export interface R98Node {
    descripcion: string
    fechaCambio: string
    idioma: string
    nivelNodo: string
    nodo: string
    nodoPadre: string
}

export interface R98Extraction {
    /**
     * Es el nombre del HelperCatalog
     */
    catName: 'Deportes' | 'Marcas' | 'Familia' | 'Silueta'
    /**
     * Nombre de la key
     */
    ibn_value: string
    /**
     * Valor de ibn_value transformado a como lo identifica SAP
     */
    sap_value: string
    parent: string
}