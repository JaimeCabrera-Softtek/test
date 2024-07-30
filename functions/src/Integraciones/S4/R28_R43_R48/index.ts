import axios from "axios";
import * as functions from "firebase-functions";
import { storage, firestore } from "../../../firebase";

import {
  VerifyIntegrationRequest,
  CallbackFunction,
} from "../../../z_helpers/IntegrationsWrapper";
import * as Contract_Schema from "./Contract_Schema.json";
import * as Pedido_Schema from "./Pedido_Schema.json";
import * as Devolucion_Schema from "./Devolucion_Schema.json";
import {
  COLLECTION_CONTRATOS,
  COLLECTION_DEVOLUCIONES,
  COLLECTION_PEDIDOS,
} from "../../../z_helpers/constants";
import { User } from "../../../interfaces/user";
import { Timestamp } from "firebase-admin/firestore";
import _ = require("lodash");
import { sociedades } from "./sociedadConstants";
import { readJsonFile } from "../../Suppliers/ContractACK";

/**
 * Valida el rango del numeroDocumento para saber que tipo de doc es
 * Contrato/Documento/Orden de compra
 * @param number rango a validar
 * @returns Que tipo de documento es
 */
const classifyNumber = (number: number): string => {
  if (
    (4300000000 <= number && number <= 4399999999) ||
    (4500000000 <= number && number <= 4599999999) ||
    (4600000000 <= number && number <= 4699999999) ||
    (5000000000 <= number && number <= 5099999999) ||
    (6100000000 <= number && number <= 6199999999) ||
    (6300000000 <= number && number <= 6399999999) ||
    (6600000000 <= number && number <= 6699999999)
  ) {
    return "Compras_Core";
  } else if (
    (4400000000 <= number && number <= 4499999999) ||
    (6400000000 <= number && number <= 6499999999) ||
    (6500000000 <= number && number <= 6599999999)
  ) {
    return "Compras_NoCore";
  } else if (5500000000 <= number && number <= 5599999999) {
    return "Contratos";
  } else if (6000000000 <= number && number <= 6099999999) {
    return "Devoluciones";
  } else {
    return "Unknown";
  }
};

/**
 * Endpoint para la creación de un contrato
 *
 * El origen es S4, se guarda información en IBN para display
 * El destino es el proveedor
 * * SFTP
 * * EDI
 * * REST
 * * WEB (IBN website)
 */
export const R28_R43_R48 = functions.https.onCall(async (data, context) => {
  /**
   * Al tener tres tipos de documentos el schema que se revisa puede ser distinto en base a que body se envía
   * En especifico al parametro de data.Pedido.claseDocumento
   */

  let ToUseSchema: any = {};
  if (data?.Pedido?.claseDocumento) {
    const numeroDocumento = data.Pedido.claseDocumento;

    const tipo_doc_por_rango = classifyNumber(parseInt(numeroDocumento));

    switch (tipo_doc_por_rango) {
      case "Compras_Core":
      case "Compras_NoCore":
        ToUseSchema = Pedido_Schema;
        break;
      case "Devoluciones":
        ToUseSchema = Devolucion_Schema;
        break;
      case "Contratos":
        ToUseSchema = Contract_Schema;
        break;
    }
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-S4-R28_R43_R48",
      ["service", "tester", "proveedor"],
      ToUseSchema,
      doWork,
      "Compras"
    );
    return result;
  } else {
    return {
      error: true,
      message: [
        {
          returnType: "E",
          returnId: "IBN",
          returnNumber: "400",
          returnMessage: "Bad Request",
        },
      ],
    };
  }
});

/**
 * Lógica core para creación de un contrato
 *
 * La cabecera de los contratos la guardaremos en firestore, por ser información de consulta, indexable.
 * El detalle del contrato (UPC, piezas, montos, etc) lo guardaremos en un archivo en storage por su tamaño.
 *
 * @param body Body del request original enviado por SAP S4
 * @param name Nombre de la función para los logs
 * @param user Usuario que hizo el request
 * @returns CloudRes estándar
 */

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<any> => {
  const pedido = body.Pedido;

  /**
   * Identifica que clase de documento se va a crear
    Pedido -> "ZBCD"
    Devolucion -> "ZDEV"
    Contrato -> "ZCON"
   */
  let tipoDoc = "";

  const proveedor = pedido.proveedor;
  console.log("Proveedor es: ", proveedor);

  const numeroDocumento = pedido.numeroDocumento;
  const tipo_doc_por_rango = classifyNumber(parseInt(numeroDocumento));
  console.log("TIPO DOC: ", tipo_doc_por_rango);

  console.log("NumeroDocumento es: ", numeroDocumento);

  //El path del file puede cambiar en base a que tipo de documento se guarda
  let filePath = "";

  //La referencia de la collection puede ser distinta en base al tipo de documento
  let collectionRefRoute = "";

  //URL del endpoint Generate contract
  let generateContractURL = "";

  //EntityType para api que genera xml
  let entityType = 0;

  //Array de items del body
  const E1EDP01 = _.cloneDeep(pedido.E1EDP01 ?? []) as any[];
  const ZCROSSDOCKING = _.cloneDeep(pedido.ZCROSSDOCKING ?? []) as any[];

  const buffer = Buffer.from(JSON.stringify(pedido));

  //Se borra array del object de pedido
  delete pedido.E1EDP01;

  //Los status de las Ordenes de compra no core cambian
  let status = "Pendiente";

  //Switch para asignar a variables que se diferencian con cada tipo de documento
  switch (tipo_doc_por_rango) {
    //PEDIDOS
    case "Compras_Core":
    case "Compras_NoCore":
      collectionRefRoute = COLLECTION_PEDIDOS;
      filePath = `orders/${proveedor}/detalles_pedido${numeroDocumento}.json`;
      tipoDoc = "Pedido";
      //Se borra array de ZCROSSDOCKING
      entityType = pedido.claseDocumento === "ZBPA" ? 220 : 226;
      generateContractURL = process.env.GENERATE_CONTRACT_URL ?? "";
      delete pedido.ZCROSSDOCKING;
      if (tipo_doc_por_rango === "Compras_NoCore")
        status = "PENDIENTE DE ENTRADA DE MERCANCÍA";
      break;
    //DEVOLUCIONES
    case "Devoluciones":
      collectionRefRoute = COLLECTION_DEVOLUCIONES;
      filePath = `returns/${proveedor}/detalles_devolucion${numeroDocumento}.json`;
      tipoDoc = "Devolucion";
      break;
    //CONTRATOS
    case "Contratos":
      filePath = `contracts/${proveedor}/detalles_contrato_${numeroDocumento}.json`;
      collectionRefRoute = COLLECTION_CONTRATOS;
      generateContractURL = process.env.GENERATE_CONTRACT_URL ?? "";
      entityType = 221;
      tipoDoc = "Contrato";
      break;
  }

  const collectionRef = firestore.collection(collectionRefRoute);

  const bucket = storage.bucket();
  const file = bucket.file(filePath);

  try {
    // Verificar si el folio ya existe
    const foilQuery = await collectionRef
      .where("numeroDocumento", "==", numeroDocumento)
      .get();

    if (!foilQuery.empty) {
      /**
       * Cuando el numeroDocumento ya existe en base de datos
       * En caso de ser una orden de compra, solo actualizar la fecha de vigencia (finValidez)
       * En cualquier otro caso regresar error
       */
      if (tipoDoc === "Pedido" || tipoDoc === "Contrato") {
        /**
         * Actualizar solo cantidadConfirmada
         */
        const originalDoc = await readJsonFile(filePath);
        const detallesOriginal = originalDoc.E1EDP01;
        let nuevoDetalles: any = [];
        detallesOriginal.forEach((item: any) => {
          const foundItem = E1EDP01.find((v: any) => {
            return v.eanUpc.padStart(14, "0") === item.eanUpc.padStart(14, "0");
          });
          /**
           * Lo encuentra en el nuevo cambio
           * actualiza el original, agregandole en cantidadConfirmadaProveedor lo que trae el nuevo en cantidad
           * actualiza el campo fechaFinEm
           */
          if (foundItem && foundItem.accion === "002") {
            nuevoDetalles.push({
              ...item,
              fechaFinEm: foundItem.fechaFinEm ?? "",
              cantidadConfirmadaProveedor: foundItem.cantidad,
            });
          } else {
            nuevoDetalles.push(item);
          }
        });

        //Se guarda a nivel del documento
        //Guardar en firestore

        const id_orden_actualizar = foilQuery.docs[0].id;
        if (tipoDoc === "Contrato") {
          pedido.status = "Confirmado";
        }
        await collectionRef.doc(id_orden_actualizar).update({ ...pedido });
        let toUpdatePedido = {
          ...pedido,
          E1EDP01: _.cloneDeep(nuevoDetalles),
        };
        if (ZCROSSDOCKING && ZCROSSDOCKING.length > 0) {
          toUpdatePedido.ZCROSSDOCKING = _.cloneDeep(ZCROSSDOCKING);
        }
        console.log("actualizado", JSON.stringify(pedido));
        const buffer_update = Buffer.from(JSON.stringify(toUpdatePedido));
        await file.save(buffer_update, {
          contentType: "application/json",
        });
      } else {
        /**
         * Cuando se haga una modificación a una devolución que ya existe
         * se sobreescribe toda la devolución pero se guarda la devolución anterior en un historial
         * para mostrar en el portal en base a la fecha con la que se haya guardado
         */

        const firestore_og = foilQuery.docs[0].data();
        const originalJson = await readJsonFile(filePath);
        const id_firestore_doc = foilQuery.docs[0].id;
        const time_arrival = firestore_og.time_arrival as Timestamp;
        const previous_update_date = time_arrival.toDate();

        /**
         * time_arrival nos dice la ultima vez que se actualizó la devolución
         */

        let historial = firestore_og.historial
          ? _.cloneDeep(firestore_og.historial)
          : {};

        const newHistorialFileName = `returns/${proveedor}/${numeroDocumento}_${previous_update_date.getTime()}.json`;
        historial[previous_update_date.toUTCString()] = newHistorialFileName;

        /**
         * Update de sobreescribir datos de devolucion
         */
        await collectionRef.doc(id_firestore_doc).update({
          ...pedido,
          historial,
          time_arrival: Timestamp.fromDate(new Date()),
        });
        const historial_buffer = Buffer.from(JSON.stringify(originalJson));

        const file_historial = bucket.file(newHistorialFileName);

        /**
         * Guardar el nuevo doc de la devolucion
         */
        await file.save(buffer, {
          contentType: "application/json",
        });

        /**
         * Guardar el historial de la devolución
         */
        await file_historial.save(historial_buffer, {
          contentType: "application/json",
        });
      }
      return {
        error: false,
        message: [
          {
            returnType: "S",
            returnId: "IBN",
            returnNumber: "200",
            returnMessage:
              tipoDoc +
              " actualizado correctamente con numeroDocumento " +
              numeroDocumento,
          },
        ],
      };
    }

    const docRef = collectionRef.doc();
    const docId = docRef.id;

    const timeStamp = new Date().getTime();
    console.log("Timestamp es ", timeStamp);

    /**
     * Timestamp y status van dentro del objeto de "Pedido"
     * el doc_id también se guarda dentro de Pedido
     */
    pedido.time_arrival = Timestamp.fromDate(new Date());
    pedido.status = status;
    pedido.doc_id = docId;

    /**
     * Calcular importe total
     * Calcular cantidad piezas
     */

    let total = 0;
    let piezas = 0;
    const first = E1EDP01[0] ?? {};
    const marca = first.marca ?? "";
    const temporada = first.temporada ?? "";
    // dict para controlar si en los detalles se tiene mas de una unidadMedida
    let helper_mixed_dict: any = {};

    E1EDP01.forEach((item) => {
      const { cantidad, costoUnitario, unidadMedida } = item;
      const qty = parseFloat(cantidad);
      const costo = parseFloat(costoUnitario);
      total += qty * costo;
      piezas += qty;
      helper_mixed_dict[unidadMedida] = true;
    });

    pedido.import = total;
    pedido.quantity = piezas;
    pedido.marca = marca;
    pedido.temporada = temporada;

    const unidades = Object.keys(helper_mixed_dict);

    /**
     * Cuando se tenga mas de una unidadMedida en los detalles,
     * se pondra vacio la cantidad en portal
     */
    if (unidades.length > 1) {
      pedido.hideQty = true;
    } else {
      /**
       * Cuando solo se tenga una unidadMedida, guardar en cabeceras esta unidad
       */
      pedido.unidadMedida = unidades[0];
    }

    //Se guarda a nivel del documento
    //Guardar en firestore
    console.log("pedido", JSON.stringify(pedido));
    await docRef.set(pedido);

    await file.save(buffer, {
      contentType: "application/json",
    });

    // Duplicar el valor de x-ibn-token para token que se envía a generate contract
    const duplicatedToken = context.rawRequest.headers["x-ibn-token"];
    console.log("x-ibn-token es ", duplicatedToken);

    /**
     * LOGICA PARA LLAMAR A GENERATE CONTRACT
     * Este proceso de llamar a la segunda API para generar el contrato
     * Se utiliza solo cuando es contrato
     * Se revisa cuando la variable de secondAPIURL no este vacía
     */

    /**
     * EN BASE AL PROVEEDOR, SE TIENE QUE SACAR LOS DATOS COMO EL RFC (GLN)
     * NOMBRE (NAME)
     */

    /**
     * Primero sacar el proveedor de firestore
     */

    const fs_proveedor_ref = await firestore.collection("proveedores");
    const fs_proveedor_snap = await fs_proveedor_ref
      .where("idSAP", "==", proveedor)
      .get();
    const fs_proveedor_doc = fs_proveedor_snap.docs[0] ?? {};
    const fs_proveedor: any = fs_proveedor_doc
      ? fs_proveedor_doc.data()
        ? fs_proveedor_doc.data()
        : {}
      : {};

    if (generateContractURL) {
      let generateContractRequest: any = {
        contrato: {
          header: {
            vendorAccount: proveedor,
            contentVersion: "1.0.0",
            creationDate: timeStamp.toString(),
            documentStatus: "ORIGINAL",
            firebase_id: docId,
            orderIdentification: {
              type: "v",
              entityType, //221 Contrato, 226 orden de compra
              uniqueCreatorIdentification: numeroDocumento,
              referenceContract: pedido.contrato
                ? parseInt(pedido.contrato)
                : 0,
            },
            orderLogisticalDateGroup: {
              requestedDeliveryDate: pedido.inicioValidez ?? "",
              orderCancelInformation: {
                cancelDate: pedido.finValidez ?? "",
              },
            },
            specialInstruction: {
              code: "1001", //Code siempre va fijo a 1001 10/04/24
              text: sociedades[pedido.organizacionCompras] ?? "",
            },
            buyer: {
              gln: "ISP831021NV9",
              nameAndAddress: {
                name: "INNOVASPORT SA DE CV",
              },
            },
            seller: {
              gln: fs_proveedor.identificacion?.rfc.value ?? "",
              nameAndAddress: {
                name: fs_proveedor.identificacion?.razonSocial?.value ?? "",
              },
            },
            shipTo: {
              gln: pedido.centroEntrega,
              nameAndAddress: {
                name: pedido.nombre,
              },
            },
          },
          items: [],
        },
        type: tipoDoc, //Pedido,Contrato
        crossdock: ZCROSSDOCKING && ZCROSSDOCKING.length > 0,
      };

      let items: any = [];
      if (ZCROSSDOCKING && ZCROSSDOCKING.length > 0) {
        E1EDP01.forEach((itemE1: any) => {
          ZCROSSDOCKING.forEach((itemZC) => {
            const ZCROSSDOCK = itemZC.ZCROSSDOCK as any[];
            const ZCrossItemMatch = ZCROSSDOCK.find(
              (iZ) =>
                iZ.ean.padStart(14, "0") === itemE1.eanUpc.padStart(14, "0")
            );
            if (ZCrossItemMatch) {
              items.push({
                requestedQuantity: ZCrossItemMatch.cantidadPedida,
                netPrice: {
                  type: "CONTRACT_PRICE",
                  unitOfMeasure: "UNITS",
                  amount: itemE1.precioVenta,
                },
                tradeItemIdentification: {
                  gtin: ZCrossItemMatch.ean,
                  additionalTrradeItemIdentification: {
                    buyer_number: ZCrossItemMatch.numeroMaterial, //ZCrossItemMatch.numeroMaterial
                    style: itemE1.materialProveedor, // itemE1.materialProveedor
                    color: ZCrossItemMatch.color,
                    size: ZCrossItemMatch.talla,
                  },
                },
                description: {
                  text: ZCrossItemMatch.descripcion,
                },
                crossDockingInfo: {
                  requested: {
                    quantity: ZCrossItemMatch.cantidadPedida,
                  },
                  shipParty: {
                    gln: itemZC.centro,
                  },
                },
              });
            }
          });
        });
      } else {
        items = E1EDP01.map((item: any) => ({
          requestedQuantity: item.cantidad,
          netPrice: {
            type: "CONTRACT_PRICE",
            unitOfMeasure: "UNITS",
            amount: item.precioVenta,
          },
          tradeItemIdentification: {
            gtin: item.eanUpc,
            additionalTrradeItemIdentification: {
              buyer_number: item.numeroMaterial, //item.numeroMaterial
              style: item.materialProveedor, //item.materialProveedor
              color: item.color,
              size: item.talla,
            },
          },
          description: {
            text: item.descripcion,
          },
          crossDockingInfo: {
            requested: {
              quantity: item.cantidad,
            },
            shipParty: {
              gln: pedido.centroEntrega,
            },
          },
        }));
      }
      generateContractRequest.contrato.items = items;
      console.log("Request de Generate contract");

      console.log(JSON.stringify(generateContractRequest));

      // Usar el token duplicado
      const response = await axios.post(
        generateContractURL,
        JSON.stringify(generateContractRequest, null, 2),
        {
          headers: {
            token: duplicatedToken,
          },
        }
      );

      console.log("Response from generate contract API:", response.data);
    }

    // Respuesta exitosa
    return {
      error: false,
      message: [
        {
          returnType: "S",
          returnId: "IBN",
          returnNumber: "200",
          returnMessage:
            tipoDoc +
            " guardado correctamente con numeroDocumento " +
            numeroDocumento,
        },
      ],
    };
  } catch (error) {
    // Manejo de errores
    const returnMessage = `Error al guardar ${tipoDoc}`;
    console.error(returnMessage, error);

    return {
      error: true,
      message: [
        {
          returnType: "E",
          returnId: "IBN",
          returnNumber: "500",
          returnMessage,
        },
      ],
      data: error,
    };
  }
};
