/**
 * Integraciones necesarias para recibir eventos o entidades desde S4
 *
 * - Cambios en marcas
 * - Registros o Cambios en proveedores
 * - Creación de contratos
 * - Creación de pedidos
 */

// Información general, para sicronización de plataforma
import { supplierUpdate } from "./SupplierUpdate";
import { R91_replicaPrecios } from "./R91_Precios";
import { R98_replicaJerarquias } from "./R98_Jerarquias";
import { R99_gpoArticulos } from "./R99_GpoArticulos";

export {
  supplierUpdate,
  R91_replicaPrecios,
  R98_replicaJerarquias,
  R99_gpoArticulos,
};

// Información de operaciones
import { R28_R43_R48 } from "./R28_R43_R48";
// import * as PurchaseOrders from './PurchaseOrders'
import * as Proveedores from "./Proveedores";

export {
  R28_R43_R48,
  // PurchaseOrders,
  Proveedores,
};
