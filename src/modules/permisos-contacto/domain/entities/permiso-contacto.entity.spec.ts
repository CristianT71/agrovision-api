import { PermisoContacto, type ContextoSolicitud } from "./permiso-contacto.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const CONTEXTO: ContextoSolicitud = { id: "s-1", productorId: "p-1", agronomoId: "ag-1", estado: "Asignada" };

const sinOtorgar = () => PermisoContacto.sinOtorgar("pc-1", "s-1");

describe("PermisoContacto", () => {
    describe("otorgar", () => {
        it("habilita el contacto al agrónomo asignado y registra quién lo otorgó (RF-08.8)", () => {
            const permiso = sinOtorgar();

            permiso.otorgar(CONTEXTO, "u-admin");

            expect(permiso.habilitado).toBe(true);
            expect(permiso.agronomoId).toBe("ag-1");
            expect(permiso.otorgadoPor).toBe("u-admin");
            expect(permiso.fechaOtorgado).toBeInstanceOf(Date);
        });

        it("rechaza una solicitud sin agrónomo asignado", () => {
            expect(() => sinOtorgar().otorgar({ ...CONTEXTO, agronomoId: null, estado: "Enviada" }, "u-admin")).toThrow(
                ReglaNegocioError,
            );
        });

        it.each(["Resuelta", "Descartada"])("rechaza una solicitud %s", (estado) => {
            expect(() => sinOtorgar().otorgar({ ...CONTEXTO, estado }, "u-admin")).toThrow(ReglaNegocioError);
        });

        it("rechaza otorgar dos veces al mismo agrónomo", () => {
            const permiso = sinOtorgar();
            permiso.otorgar(CONTEXTO, "u-admin");

            expect(() => permiso.otorgar(CONTEXTO, "u-admin")).toThrow(ReglaNegocioError);
        });

        it("rechaza el contexto de otra solicitud", () => {
            expect(() => sinOtorgar().otorgar({ ...CONTEXTO, id: "s-9" }, "u-admin")).toThrow(ReglaNegocioError);
        });

        it("tras una reasignación se puede otorgar al nuevo agrónomo", () => {
            const permiso = sinOtorgar();
            permiso.otorgar(CONTEXTO, "u-admin");

            permiso.otorgar({ ...CONTEXTO, agronomoId: "ag-2" }, "u-admin-2");

            expect(permiso.agronomoId).toBe("ag-2");
            expect(permiso.otorgadoPor).toBe("u-admin-2");
        });

        it("se vuelve a otorgar después de una revocación", () => {
            const permiso = sinOtorgar();
            permiso.otorgar(CONTEXTO, "u-admin");
            permiso.revocar("u-admin");

            permiso.otorgar(CONTEXTO, "u-admin");

            expect(permiso.habilitado).toBe(true);
        });
    });

    describe("revocar", () => {
        it("extingue el permiso y registra quién lo revocó sin borrar quién lo otorgó", () => {
            const permiso = sinOtorgar();
            permiso.otorgar(CONTEXTO, "u-admin");

            permiso.revocar("u-admin-2");

            expect(permiso.habilitado).toBe(false);
            expect(permiso.revocadoPor).toBe("u-admin-2");
            expect(permiso.fechaRevocado).toBeInstanceOf(Date);
            expect(permiso.otorgadoPor).toBe("u-admin");
        });

        it("rechaza revocar un permiso que no está habilitado", () => {
            expect(() => sinOtorgar().revocar("u-admin")).toThrow(ReglaNegocioError);
        });
    });

    describe("estaVigentePara", () => {
        it("es vigente para el agrónomo al que se otorgó (RF-04.10)", () => {
            const permiso = sinOtorgar();
            permiso.otorgar(CONTEXTO, "u-admin");

            expect(permiso.estaVigentePara("ag-1")).toBe(true);
        });

        it("no pasa a otro agrónomo si la solicitud se reasigna", () => {
            const permiso = sinOtorgar();
            permiso.otorgar(CONTEXTO, "u-admin");

            expect(permiso.estaVigentePara("ag-2")).toBe(false);
        });

        it("no es vigente sin agrónomo ni después de revocarse", () => {
            const permiso = sinOtorgar();
            permiso.otorgar(CONTEXTO, "u-admin");

            expect(permiso.estaVigentePara(null)).toBe(false);

            permiso.revocar("u-admin");
            expect(permiso.estaVigentePara("ag-1")).toBe(false);
        });
    });
});
