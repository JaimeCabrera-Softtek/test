import axios from "axios";

/**
 * Obtener un Bearer Token para el consumo de los servicios de CPI para el alta de materiales
 * @return el bearer token que nos da CPI
 */
export const getTokenCpiMateriales = async (): Promise<string> => {
  try {
    const url = process.env.ALTAMATERIALES_CPI_GETTOKEN_URL ?? "";

    const res = await axios.post(
      url,
      {},
      {
        auth: {
          username: process.env.ALTAMATERIALES_CPI_GETTOKEN_USER ?? "",
          password: process.env.ALTAMATERIALES_CPI_GETTOKEN_PASSWORD ?? "",
        },
      }
    );

        return res.data.access_token;
    } catch (e) {
        console.log('getTokenCpiMateriales', 'error', JSON.stringify(e))
        return '';
    }
}

/**
 * Conocer si fue exitoso el envío y creación de los idocs
 * @param data respuesta de CPI cuando enviamos un segmento
 * @returns true si no hay mensajes de error en el encolamiento
 */
export function cpiQueued(data: {
    message: Array<{ returnId: string, returnMessage: string, returnNumber: string, returnType: 'S' | 'E' }>
}) {
    const results = data.message.map(x => x.returnType);
    const huboErrores = results.filter(x => x === 'E').length > 0;
    return !huboErrores;
}
