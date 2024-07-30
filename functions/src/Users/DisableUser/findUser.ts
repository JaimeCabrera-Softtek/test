import {auth} from "../../firebase";

/**
 * Recuperar un usuario de auth
 * @param email correo del usuario que buscamos
 * @return registro de auth del usuario buscado o undefined
 */
export const findUser = async (email: string) => {
  try {
    const user = await auth.getUserByEmail(email);
    return user;
  } catch (err) {
    return undefined;
  }
};
