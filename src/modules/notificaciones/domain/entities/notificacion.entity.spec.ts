import { MAX_DESCRIPCION, MAX_TITULO, Notificacion } from "./notificacion.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const BASE = {
    id: "n-1",
    usuarioId: "u-1",
    tipo: "mensaje_nuevo" as const,
    titulo: "Nuevo mensaje en una solicitud",
    descripcion: "Coordinación te escribió en una solicitud asignada.",
    referenciaTipo: "solicitud" as const,
    referenciaId: "s-1",
};

describe("Notificacion (dominio)", () => {
    describe("crear", () => {
        it("crea una notificación válida sin leer y con fecha (RF-02.5)", () => {
            const notificacion = Notificacion.crear(BASE);

            expect(notificacion.leida).toBe(false);
            expect(notificacion.fecha).toBeInstanceOf(Date);
            expect(notificacion.referenciaTipo).toBe("solicitud");
            expect(notificacion.referenciaId).toBe("s-1");
        });

        it("recorta los espacios del título y la descripción", () => {
            const notificacion = Notificacion.crear({ ...BASE, titulo: "  Hola  ", descripcion: "  Texto  " });

            expect(notificacion.titulo).toBe("Hola");
            expect(notificacion.descripcion).toBe("Texto");
        });

        it("permite una notificación sin referencia", () => {
            const notificacion = Notificacion.crear({ ...BASE, referenciaTipo: null, referenciaId: null });

            expect(notificacion.referenciaTipo).toBeNull();
            expect(notificacion.referenciaId).toBeNull();
        });

        it("falla con título vacío o de solo espacios", () => {
            expect(() => Notificacion.crear({ ...BASE, titulo: "" })).toThrow(ReglaNegocioError);
            expect(() => Notificacion.crear({ ...BASE, titulo: "   " })).toThrow(ReglaNegocioError);
        });

        it(`falla con título de más de ${MAX_TITULO} caracteres`, () => {
            expect(() => Notificacion.crear({ ...BASE, titulo: "a".repeat(MAX_TITULO + 1) })).toThrow(
                ReglaNegocioError,
            );
            expect(() => Notificacion.crear({ ...BASE, titulo: "a".repeat(MAX_TITULO) })).not.toThrow();
        });

        it("falla con descripción vacía", () => {
            expect(() => Notificacion.crear({ ...BASE, descripcion: "  " })).toThrow(ReglaNegocioError);
        });

        it(`falla con descripción de más de ${MAX_DESCRIPCION} caracteres`, () => {
            expect(() => Notificacion.crear({ ...BASE, descripcion: "a".repeat(MAX_DESCRIPCION + 1) })).toThrow(
                ReglaNegocioError,
            );
        });

        it("falla si viene el tipo de referencia sin el id", () => {
            expect(() => Notificacion.crear({ ...BASE, referenciaId: null })).toThrow(ReglaNegocioError);
        });

        it("falla si viene el id de referencia sin el tipo", () => {
            expect(() => Notificacion.crear({ ...BASE, referenciaTipo: null })).toThrow(ReglaNegocioError);
        });
    });

    describe("marcarLeida", () => {
        it("la marca como leída y es idempotente (RF-02.6)", () => {
            const notificacion = Notificacion.crear(BASE);

            notificacion.marcarLeida();
            expect(notificacion.leida).toBe(true);

            expect(() => notificacion.marcarLeida()).not.toThrow();
            expect(notificacion.leida).toBe(true);
        });
    });

    describe("perteneceA", () => {
        it("solo pertenece a su destinatario", () => {
            const notificacion = Notificacion.crear(BASE);

            expect(notificacion.perteneceA("u-1")).toBe(true);
            expect(notificacion.perteneceA("u-2")).toBe(false);
        });
    });
});
