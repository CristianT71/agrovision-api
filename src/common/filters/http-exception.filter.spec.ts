import { BadRequestException, InternalServerErrorException, type ArgumentsHost } from "@nestjs/common";
import { HttpExceptionFilter, MENSAJE_ERROR_INTERNO } from "./http-exception.filter";
import { ReglaNegocioError } from "../errors/regla-negocio.error";
import type { ErrorResponse } from "../http-exception-response.interface";

function ejecutar(excepcion: unknown) {
    let estado = 0;
    let cuerpo: ErrorResponse | undefined;
    const respuesta = {
        status: (codigo: number) => {
            estado = codigo;
            return { json: (datos: ErrorResponse) => (cuerpo = datos) };
        },
    };
    const host = {
        switchToHttp: () => ({
            getResponse: () => respuesta,
            getRequest: () => ({ url: "/api/agronomos/registro", method: "POST" }),
        }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(excepcion, host);

    return { estado, cuerpo: cuerpo as ErrorResponse };
}

describe("HttpExceptionFilter", () => {
    beforeEach(() => {
        // Los errores esperados en estas pruebas no deben ensuciar la salida
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => jest.restoreAllMocks());

    it("un error inesperado no filtra su mensaje: ahí van nombres de tablas y restricciones", () => {
        const consulta = new Error('duplicate key value violates unique constraint "UQ_usuarios_telefono"');

        const { estado, cuerpo } = ejecutar(consulta);

        expect(estado).toBe(500);
        expect(cuerpo.mensaje).toBe(MENSAJE_ERROR_INTERNO);
        expect(JSON.stringify(cuerpo)).not.toContain("UQ_usuarios_telefono");
    });

    it("un valor que no es un Error tampoco se expone", () => {
        const { estado, cuerpo } = ejecutar("fallo con datos internos");

        expect(estado).toBe(500);
        expect(cuerpo.mensaje).toBe(MENSAJE_ERROR_INTERNO);
    });

    it("una regla de negocio responde 409 con su mensaje, que está escrito para el usuario", () => {
        const { estado, cuerpo } = ejecutar(new ReglaNegocioError("La solicitud ya está resuelta."));

        expect(estado).toBe(409);
        expect(cuerpo.mensaje).toBe("La solicitud ya está resuelta.");
    });

    it("una HttpException conserva su estado y su mensaje", () => {
        const { estado, cuerpo } = ejecutar(new BadRequestException(["El nombre es obligatorio."]));

        expect(estado).toBe(400);
        expect(cuerpo.mensaje).toEqual(["El nombre es obligatorio."]);
    });

    it("un 500 escrito a propósito (HttpException) sí entrega su mensaje", () => {
        const { estado, cuerpo } = ejecutar(new InternalServerErrorException("No se pudo entregar el mensaje SMS."));

        expect(estado).toBe(500);
        expect(cuerpo.mensaje).toBe("No se pudo entregar el mensaje SMS.");
    });
});
