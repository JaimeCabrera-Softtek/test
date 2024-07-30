export interface User {
    // Campos básicos del usuario
    uid: string
    display_name: string
    email: string
    picture: string
    roles: string[]

    //PROVEEDORES
    RFC?: string
    SAP_idProvider?: string
    docProviderOrg?: string; //para hacer la relación de usuario con el doc en la collection proveedor


    // más campos, depende del rol... hacer otras interfaces que hereden?
    [key: string]: any
}
