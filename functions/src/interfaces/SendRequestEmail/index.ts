export interface FBUser {
  deportes?: string[];
  brands?: brands;
  display_name: string;
  email: string;
  roles: string[];
  uid: string;
  picture?: string;
  SAP_idProvider?: string;
  RFC?: string;
  isActive?: boolean;
  isProvider?: string; // pending - created - active - disabled
  number?: string;
  docProviderOrg?: string; //para hacer la relación de usuario con el doc en la collection proveedor
  providerType?: string; // core = proveedor Core / noCore = proveedor No core
  cp?: string;
}

export interface brands {
  [brandID: string]: brand;
}

export interface brand {
  id: string;
  name: string;
  SAP_id: string;
}

export interface dataReq {
  ID: string;
  Email: string;
  Brand: string;
  Contact_name: string;
}

export interface signUpRequest {
  brands: string[];
  contact_name: string;
  data: {
    address: string;
    cp: string;
    rfc: string;
  };
  email: string;
  status: string;
}
