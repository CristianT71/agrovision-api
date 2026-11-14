import { ReglaZona, type EstadoRegla } from "./regla-zona";
import { FILAS_EJEMPLO } from "../testing/filas-ejemplo";
import {
    ReglaInmutableError,
    ReglaInvalidaError,
    ReglaNoAprobadaError,
    TransicionInvalidaError,
} from "../errors/reglas-zona.error";

const ahora = new Date("2026-11-13T12:00:00Z");
const aprobador = { nombre: "Ana Pérez", tarjetaProfesional: "TP-123" };
const borrador = () =>
    ReglaZona.crearBorrador({
        id: "r1",
        tipoEnfermedad: "roya",
        version: 1,
        notas: "ejemplo",
        filas: FILAS_EJEMPLO,
        creadaPor: "u1",
        ahora,
    });
const enEstado = (estado: EstadoRegla) => ReglaZona.reconstruir({ ...borrador().instantanea(), estado });

describe("ReglaZona", () => {
    it("nace en borrador, sin calibrar y con la tabla validada", () => {
        const r = borrador();
        expect(r.vista()).toMatchObject({ estado: "borrador", calibrada: false, aprobadaPor: null, version: 1 });
        expect(() =>
            ReglaZona.crearBorrador({ ...borrador().instantanea(), filas: [], ahora, creadaPor: "u1" }),
        ).toThrow(ReglaInvalidaError);
    });

    it("el borrador se edita; la edición inválida no cambia nada", () => {
        const r = borrador();
        r.editar({ notas: "nuevas" });
        expect(r.vista().notas).toBe("nuevas");
        expect(() => r.editar({ filas: FILAS_EJEMPLO.slice(0, 2) })).toThrow(ReglaInvalidaError);
        expect(r.filas).toHaveLength(4);
    });

    it.each<EstadoRegla>(["aprobada", "activa", "archivada"])("una regla %s es inmutable", (estado) => {
        const r = enEstado(estado);
        expect(() => r.editar({ notas: "x" })).toThrow(ReglaInmutableError);
        expect(() => r.exigirBorrador()).toThrow(ReglaInmutableError);
        expect(() => r.aprobar(aprobador, "u2", { calibrada: false }, ahora)).toThrow(ReglaInmutableError);
    });

    it("aprobar guarda nombre y tarjeta; calibrada solo con nota", () => {
        const sinNota = borrador();
        expect(() => sinNota.aprobar(aprobador, "u2", { calibrada: true, nota: "  " }, ahora)).toThrow(
            ReglaInvalidaError,
        );
        expect(sinNota.estado).toBe("borrador");

        const r = borrador();
        r.aprobar(aprobador, "u2", { calibrada: true, nota: "Validada en 3 fincas" }, ahora);
        expect(r.vista()).toMatchObject({
            estado: "aprobada",
            calibrada: true,
            aprobadaPor: aprobador,
            aprobadaEn: ahora,
        });
        expect(r.vista().notas).toContain("Nota de calibración: Validada en 3 fincas");

        const sinCalibrar = borrador();
        sinCalibrar.aprobar(aprobador, "u2", { calibrada: false }, ahora);
        expect(sinCalibrar.calibrada).toBe(false);
    });

    it("solo una regla aprobada se activa", () => {
        expect(() => borrador().activar(ahora)).toThrow(ReglaNoAprobadaError);
        expect(() => enEstado("archivada").activar(ahora)).toThrow(ReglaNoAprobadaError);
        const r = enEstado("aprobada");
        r.activar(ahora);
        expect(r.vista()).toMatchObject({ estado: "activa", activadaEn: ahora });
    });

    it("se archiva desde aprobada o activa, nunca desde borrador ni dos veces", () => {
        expect(() => borrador().archivar()).toThrow(TransicionInvalidaError);
        expect(() => enEstado("archivada").archivar()).toThrow(TransicionInvalidaError);
        const r = enEstado("activa");
        r.archivar();
        expect(r.estado).toBe("archivada");
    });

    it("duplicar crea una nueva versión en borrador sin heredar aprobación ni calibración", () => {
        const origen = borrador();
        origen.aprobar(aprobador, "u2", { calibrada: true, nota: "ok" }, ahora);
        const copia = origen.duplicar({ id: "r2", version: 2, creadaPor: "u3", ahora });
        expect(copia.vista()).toMatchObject({
            id: "r2",
            tipoEnfermedad: "roya",
            version: 2,
            estado: "borrador",
            calibrada: false,
            aprobadaPor: null,
            creadaPor: "u3",
        });
        expect(copia.filas).toEqual(origen.filas);
        expect(origen.estado).toBe("aprobada");
    });

    it("la revisión nace en 1, sube con cada modificación del borrador y no se hereda al duplicar", () => {
        const r = borrador();
        expect(r.revision).toBe(1);
        r.editar({ notas: "a" });
        r.editar({ filas: FILAS_EJEMPLO });
        expect(r.revision).toBe(3);
        r.editar({});
        expect(r.revision).toBe(3);
        expect(r.duplicar({ id: "r2", version: 2, creadaPor: "u2", ahora }).revision).toBe(1);
        r.aprobar(aprobador, "agro", { calibrada: false }, ahora);
        expect(r.vista()).toMatchObject({ estado: "aprobada", revision: 4 });
    });

    it("exigirRevision rechaza una revisión distinta de la guardada (VERSION_EN_CONFLICTO)", () => {
        const r = borrador();
        r.editar({ notas: "a" });
        expect(() => r.exigirRevision(2)).not.toThrow();
        expect(() => r.exigirRevision(1)).toThrow(expect.objectContaining({ codigo: "VERSION_EN_CONFLICTO" }));
    });
});
