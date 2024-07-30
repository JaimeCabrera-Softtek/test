import axios from "axios";
import { getServiceUser } from "../../../../z_helpers/firestoreServices";

/**
 * Obtiene el token de un usuario service (helper para llamar APIS)
 */
export const getServiceToken = async () => {
  try {
    const serviceUser: any = await getServiceUser();
    const x_ibn_token_axios_resp = await axios.get(
      process.env.GET_TOKEN_TEXT_URL ?? "",
      {
        headers: {
          user_id: serviceUser.uid,
        },
      }
    );
    const data = x_ibn_token_axios_resp.data;
    const { token } = data;

    return token;
  } catch (error) {
    throw new Error("Error obteniendo token");
  }
};
