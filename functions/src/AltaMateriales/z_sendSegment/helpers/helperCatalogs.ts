import { db_materiales } from "../../../firebase";
import { HELPER_CATALOGS } from "../../../z_helpers/constants";
import { BannerStores } from "../../01_batch_creation/interfaces";

export const getKeyForDeporte = async (name: string): Promise<string> => {
  return getSimple("Deportes", name);
};

export const getKeyForDivision = async (name: string): Promise<string> => {
  return getSimple("Division", name);
};

export const getKeyForFamilia = async (name: string): Promise<string> => {
  return getSimple("Familia", name);
};

export const getKeyForFamilia_Automatica = async (name: string): Promise<string> => {
  return getSimple("Familia_Automatica", name);
};

export const getKeyForSilueta = async (name: string): Promise<string> => {
  return getSimple("Silueta", name);
};

export const getKeyForGenero = async (name: string): Promise<string> => {
  return getSimple("Generos", name);
};

export const getKeyForMarca = async (name: string): Promise<string> => {
  return getSimple("Marcas", name);
};

export const getMarcaID = async (name: string): Promise<string> => {
  return getSimple("Marcas", name.toUpperCase());
};

export const getCategoriasCatalog = async (): Promise<{}> => {
  const ref = db_materiales.ref(HELPER_CATALOGS).child("Categorias");
  const val = (await ref.once("value")).val();

  return val ?? {};
};

export const getCentrosCatalog = async (): Promise<{}> => {
  const ref = db_materiales.ref(HELPER_CATALOGS).child("Centros");
  const val = (await ref.once("value")).val();

  return val ?? {};
};

export const getOrganizacionCompra = async (name: string): Promise<string> => {
  return getSimple("OrganizacionCompras", name);
};

export const getCaracteristicaMaterial = async (
  name: string
): Promise<string> => {
  return getSimple("CaracteristicasMat", name);
};

export const getSegmento1Tallas = async (name: string): Promise<string> => {
  return getSimple("Segmento1Tallas", name);
};

export const getGrupoCompras = async (name: string): Promise<string> => {
  return getSimple("GrupoCompras", name);
};

export const getStoresFromBanner = async (banner: string): Promise<BannerStores> => {
  banner = banner.toUpperCase();

  const ref = db_materiales
    .ref(HELPER_CATALOGS)
    .child("Surtido")
    .child(banner)
    .child("stores");

  const val = (await ref.once("value")).val();

  return val ?? null;
};

export const getSimple = async (node: string, name: string): Promise<string> => {
  const ref = db_materiales.ref(HELPER_CATALOGS).child(node).child(name);
  const val = (await ref.once("value")).val();

  return val ?? "";
};

/**
 * @returns fecha actual en formato aaaammdd
 */
export const formatDate = (date: Date) => {
  const anio = date.getFullYear();
  const mes = (date.getMonth() + 1).toString().padStart(2, "0");
  const dia = date.getDate().toString().padStart(2, "0");
  return `${anio}${mes}${dia}`;
};

/** Obtiene un arreglo de organizaciones por un arreglo de banners */
export const getOrg = async (banners: string[]) => {
  const codes: string[] = [];

  for (const banner of banners) {
    const org = await getOrganizacionCompra(banner);
    codes.push(org);
  }

  return codes;
};
