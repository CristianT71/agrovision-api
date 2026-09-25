import { validarEnvio, type ContextoSolicitud } from "./canal-coordinacion";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const contexto = (datos: Partial<ContextoSolicitud>): ContextoSolicitud => ({
    id: "s-1",
    agronomoId: "ag-1",
    estado: "Asignada",
    ...datos,
});

describe("Canal de coordinación", () => {
    describe("validarEnvio", () => {
        it("rechaza el envío en una solicitud sin agrónomo asignado (RF-08.7)", () => {
            expect(() => validarEnvio(contexto({ agronomoId: null, estado: "Enviada" }))).toThrow(ReglaNegocioError);
        });

        it("rechaza el envío en una solicitud resuelta", () => {
            expect(() => validarEnvio(contexto({ estado: "Resuelta" }))).toThrow(ReglaNegocioError);
        });

        it("rechaza el envío en una solicitud descartada", () => {
            expect(() => validarEnvio(contexto({ estado: "Descartada" }))).toThrow(ReglaNegocioError);
        });

        it("permite el envío en los demás estados con agrónomo asignado", () => {
            for (const estado of ["Pendiente", "Enviada", "Asignada"]) {
                expect(() => validarEnvio(contexto({ estado }))).not.toThrow();
            }
        });
    });
});
