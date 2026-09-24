import { ConflictException, NotFoundException } from "@nestjs/common";
import { CompletarPerfilProductorService } from "./completar-perfil-productor.service";
import { ObtenerProductorService } from "./obtener-productor.service";
import { ValidarProductorService } from "./validar-productor.service";
import { ConsentimientoProductorService } from "./consentimiento-productor.service";
import { Productor } from "../../domain/entities/productor.entity";
import type { IProductorRepository } from "../../domain/ports/out/productor.repository";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import { escaparLike } from "../../../../common/utils/escapar-like";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const PERFIL = {
    usuarioId: "u-1",
    telefono: "+573114528801",
    nombre: " Carlos Arango ",
    finca: "La Esperanza",
    vereda: "El Cedro",
    municipio: "Pitalito",
};

const crearProductor = (consentimiento: boolean) => Productor.registrar({ id: "p-1", ...PERFIL, consentimiento });

describe("Productores - casos de uso", () => {
    let productor: Productor | null;
    let guardar: jest.Mock<Promise<Productor>, [Productor]>;
    let repositorio: IProductorRepository;
    let obtener: ObtenerProductorService;

    beforeEach(() => {
        productor = null;
        guardar = jest.fn((p: Productor) => Promise.resolve(p));
        repositorio = {
            findById: () => Promise.resolve(productor),
            findByUsuarioId: () => Promise.resolve(productor),
            findByTelefono: () => Promise.resolve(productor),
            findAll: () => Promise.resolve([]),
            guardar,
        };
        obtener = new ObtenerProductorService(repositorio);
    });

    it("completa el perfil con los datos del token y fecha el consentimiento", async () => {
        const creado = await new CompletarPerfilProductorService(repositorio).ejecutar({
            ...PERFIL,
            consentimiento: true,
        });

        expect(creado.usuarioId).toBe("u-1");
        expect(creado.nombre).toBe("Carlos Arango");
        expect(creado.estado).toBe("registrado");
        expect(creado.fechaConsentimiento).toBeInstanceOf(Date);
    });

    it("no deja completar el perfil dos veces", async () => {
        productor = crearProductor(false);

        await expect(
            new CompletarPerfilProductorService(repositorio).ejecutar({ ...PERFIL, consentimiento: false }),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it("responde 404 si el productor no existe", async () => {
        await expect(obtener.ejecutar({ id: "p-x" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("no valida dos veces al mismo productor", async () => {
        productor = crearProductor(false);
        productor.validar();

        await expect(new ValidarProductorService(repositorio, obtener).ejecutar("p-1")).rejects.toBeInstanceOf(
            ReglaNegocioError,
        );
        expect(guardar).not.toHaveBeenCalled();
    });

    it("revoca el consentimiento solo con confirmación explícita (RF-10.3)", async () => {
        productor = crearProductor(true);
        const servicio = new ConsentimientoProductorService(repositorio, obtener);

        await expect(servicio.revocar({ id: "p-1" }, false)).rejects.toBeInstanceOf(ReglaNegocioError);

        const revocado = await servicio.revocar({ id: "p-1" }, true);
        expect(revocado.consentimiento).toBe(false);
        expect(revocado.permiteUsoDeFotos()).toBe(false);
    });

    it("la búsqueda trata % y _ como texto literal", () => {
        expect(escaparLike("50%_café\\")).toBe("50\\%\\_café\\\\");
    });
});
