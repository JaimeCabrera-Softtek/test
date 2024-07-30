import Ajv from "ajv";

export class SchemaValidator {
  constructor(protected ajv: Ajv) {
  }

  public validate<T>(schema: object, data: T): T {
    const isValid = this.ajv.validate(schema, data);

    if (!isValid) {
      const errorMessages = this.ajv.errorsText();
      throw new Error(`Error en la validación (schema) de los datos enviados (request). ${errorMessages}`);
    }

    return data;
  }
}
