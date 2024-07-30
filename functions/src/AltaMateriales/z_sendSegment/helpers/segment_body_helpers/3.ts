import { AltaMaterial_ProductInit } from "../../../01_batch_creation/interfaces";
import { getGrupoCompras, getOrganizacionCompra } from "../helperCatalogs";


export const body03 = async (product_data: AltaMaterial_ProductInit, operacion: 'create' | 'update') => {
    const func = getFuncKey(operacion);
    const orgs = await getOrgs(product_data);

    /**
     * Función generadora del body para la R53
     * @param material código del material genérico o variante
     * @returns objeto de regInfo
     */
    function reginfo(material: string) {
        return {
            codigoInterno: product_data.push_id!,
            "funcion": func, // "009": crear, "005": modificar
            "material": material,
            "proveedor": product_data.art.providerIDSAP ?? process.env.TEMP_ID_PROVIDER_ALTA,
            "materialProveedor": product_data.art.Estilo, //El estilo del material según el proveedor indicó en su catálogo
            "proveedorRegular": "X", //? NUEVO CAMPO
            "E1EINEM": orgs,
        }
    }

    /**
     * Arreglo que acumulará todos los regInfo que vamos a enviar
     */
    const arr = [
        reginfo(product_data.consecutivo.toString().padStart(18, '0'))
    ]

    /**
     * Estas son las variantes que tiene el producto
     */
    const variantes: { upc: string, tallaProveedor: string, consecutivo: number }[] = Object.values(product_data.art.variantes);
    arr.push(
        ...variantes.map(x => {
            const codigo = `${product_data.consecutivo.toString().padStart(15, '0')}${x.consecutivo.toString().padStart(3, '0')}`;
            return reginfo(codigo);
        })
    );

    return {
        "registroInfo": arr
    }
}

/**
 * Traducir `create` `update` `delete` a un char para que SAP entienda
 * @param operacion operación que queremos hacer
 * @returns el valor con el que le indicamos qué operación queremos hacer a SAP
 */
const getFuncKey = (operacion: 'create' | 'update') => {
    // TODO: PUEDE HABER MÁS, JOEL VA A BUSCAR POSIBLES ENTRADAS
    if (operacion === 'create') {
        return '009';
    } else if (operacion === 'update') {
        return '005';
    }
    return '';
}

/**
 * Obtener valor array para el campo E1EINEM
 * @param product_data Valor del nodo del job
 * @returns array para mandar en el campo E1EINEM
 */
const getOrgs = async (product_data: AltaMaterial_ProductInit) => {
    let orgs: any[] = []
    const { banners } = product_data;

    for (const banner of banners) {
        const org = await getOrganizacionCompra(banner)
        const gCompras = await getGrupoCompras(product_data.art.Division)

        orgs.push({
            "organizacionCompras": org,
            "grupoCompras": gCompras,
            "precioNeto": product_data.art.Precio_compra,
            "precioEfectivo": product_data.art.Precio_compra,
            "grupoCondicionesProveedor": "", //2024-01-30 Myri dijo que va vacío
            "indicadorImpuestos": "V2",
            "claveControlConfirmacion": "Z004", // FIJO
            "controlFechaPrecio": "2"
        })
    }

    return orgs
}