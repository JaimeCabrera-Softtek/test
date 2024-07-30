export interface PreciosVentaSAP {
  codigoInterno?: string;
  listaPrecios?: any;
  claseCondicion: string;
  organizacionVentas: string;
  canalDistribucion: string;
  material: string; // TODO: SAP LO MANDA COMO numeroMaterial, pero nosotros lo mandamos como material
  E1KONH: [
    {
      inicioValidez: string; //fecha actual en aaaammdd
      finValidez: string; //fecha final en aaaammdd
      E1KONP: [
        {
          claseCondicion: string;
          importeOPorcentaje: string; // precio venta
        }
      ];
    }
  ];
}
