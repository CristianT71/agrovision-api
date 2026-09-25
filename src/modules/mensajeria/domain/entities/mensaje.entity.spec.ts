import { AdjuntoMensaje } from "./adjunto-mensaje.entity";
import { MAX_ADJUNTOS_POR_MENSAJE, MAX_LONGITUD_MENSAJE, Mensaje } from "./mensaje.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const adjunto = (id: string) =>
    new AdjuntoMensaje(id, "m-1", `mensajes/s-1/${id}.pdf`, "instrucciones.pdf", "application/pdf", 120, "documento");

const crear = (datos: { contenido?: string | null; adjuntos?: AdjuntoMensaje[] }) =>
    Mensaje.crear({ id: "m-1", solicitudId: "s-1", autorId: "u-1", autorTipo: "admin", ...datos });

describe("Mensaje", () => {
    describe("crear", () => {
        it("acepta un mensaje de solo texto", () => {
            const mensaje = crear({ contenido: "  Revisa la finca La Esperanza  " });

            expect(mensaje.contenido).toBe("Revisa la finca La Esperanza");
            expect(mensaje.adjuntos).toHaveLength(0);
            expect(mensaje.leido).toBe(false);
        });

        it("acepta un mensaje de solo adjuntos (RF-08.5)", () => {
            const mensaje = crear({ adjuntos: [adjunto("a-1")] });

            expect(mensaje.contenido).toBeNull();
            expect(mensaje.adjuntos).toHaveLength(1);
        });

        it("acepta texto y adjuntos juntos", () => {
            const mensaje = crear({ contenido: "Adjunto el protocolo", adjuntos: [adjunto("a-1")] });

            expect(mensaje.contenido).toBe("Adjunto el protocolo");
            expect(mensaje.adjuntos).toHaveLength(1);
        });

        it("rechaza un mensaje sin texto ni adjuntos", () => {
            expect(() => crear({})).toThrow(ReglaNegocioError);
        });

        it("rechaza texto de solo espacios sin adjuntos", () => {
            expect(() => crear({ contenido: "   " })).toThrow(ReglaNegocioError);
        });

        it("rechaza texto más largo que el máximo permitido", () => {
            expect(() => crear({ contenido: "x".repeat(MAX_LONGITUD_MENSAJE + 1) })).toThrow(ReglaNegocioError);
        });

        it("rechaza más adjuntos de los permitidos", () => {
            const adjuntos = Array.from({ length: MAX_ADJUNTOS_POR_MENSAJE + 1 }, (_, i) => adjunto(`a-${i}`));

            expect(() => crear({ adjuntos })).toThrow(ReglaNegocioError);
        });
    });

    describe("estaPendientePara", () => {
        it("queda pendiente para la contraparte", () => {
            expect(crear({ contenido: "hola" }).estaPendientePara("agronomo")).toBe(true);
        });

        it("nunca queda pendiente para quien lo escribió", () => {
            expect(crear({ contenido: "hola" }).estaPendientePara("admin")).toBe(false);
        });

        it("no queda pendiente si ya fue leído", () => {
            const mensaje = crear({ contenido: "hola" });
            mensaje.leido = true;

            expect(mensaje.estaPendientePara("agronomo")).toBe(false);
        });
    });
});
