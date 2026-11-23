import { NotFoundException } from "@nestjs/common";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalAlmacenamientoAdapter } from "../../../../common/almacenamiento/local-almacenamiento.adapter";
import type { IAlmacenamientoArchivos } from "../../../../common/almacenamiento/almacenamiento.port";
import { Plaga } from "../../domain/entities/plaga.entity";
import { PlagaProtegidaError } from "../../domain/errors/plaga-protegida.error";
import type { IPlagaRepository } from "../../domain/ports/out/plaga.repository";
import { ObtenerPlagaService } from "./obtener-plaga.service";
import { EliminarPlagaService } from "./eliminar-plaga.service";

const ID = "11111111-1111-4111-8111-111111111111";
const FOTO = `/archivos/plagas/${ID}.png`;
const crearFicha = (catalogId = `Pest_${ID}`, fotoUrl: string | null = FOTO) =>
    new Plaga(
        ID,
        "Ficha",
        null,
        "plaga",
        "Descripción",
        "Síntomas",
        "cafe",
        ["hoja"],
        [],
        "Manejo",
        null,
        fotoUrl,
        [],
        [],
        catalogId,
    );

describe("EliminarPlagaService", () => {
    let ficha: Plaga;
    let repo: jest.Mocked<IPlagaRepository>;
    let eliminarPublico: jest.Mock;
    let almacenamiento: IAlmacenamientoArchivos;
    let servicio: EliminarPlagaService;

    beforeEach(() => {
        ficha = crearFicha();
        repo = {
            findById: jest.fn().mockImplementation(() => Promise.resolve(ficha)),
            findAll: jest.fn(),
            existeNombreCientifico: jest.fn(),
            guardar: jest.fn(),
            eliminar: jest.fn().mockResolvedValue(true),
            fotoEnUso: jest.fn().mockResolvedValue(false),
        };
        eliminarPublico = jest.fn().mockResolvedValue(undefined);
        almacenamiento = { eliminarPublico } as unknown as IAlmacenamientoArchivos;
        servicio = new EliminarPlagaService(repo, almacenamiento, new ObtenerPlagaService(repo));
    });

    it("borra una ficha normal antes de retirar su foto sin referencias", async () => {
        await expect(servicio.ejecutar(ID)).resolves.toBeUndefined();
        expect(repo.eliminar).toHaveBeenCalledWith(ID);
        expect(repo.fotoEnUso).toHaveBeenCalledWith(FOTO);
        expect(eliminarPublico).toHaveBeenCalledWith(FOTO);
        expect(repo.eliminar.mock.invocationCallOrder[0]).toBeLessThan(repo.fotoEnUso.mock.invocationCallOrder[0]);
        expect(repo.fotoEnUso.mock.invocationCallOrder[0]).toBeLessThan(eliminarPublico.mock.invocationCallOrder[0]);
    });

    it.each([
        "Enfermedad_Roya",
        "Enfermedad_ManchadeHierro",
        "Enfermedad_OjodeGallo",
        "Enfermedad_Antracnosis",
        "Deficiencia_Azufre",
        "Deficiencia_Potasio",
        "Enfermedad_Phoma",
        "Plaga_Minador",
    ])("impide eliminar la ficha protegida %s y conserva su foto", async (catalogId) => {
        ficha = crearFicha(catalogId);
        await expect(servicio.ejecutar(ID)).rejects.toBeInstanceOf(PlagaProtegidaError);
        expect(repo.eliminar).not.toHaveBeenCalled();
        expect(repo.fotoEnUso).not.toHaveBeenCalled();
        expect(eliminarPublico).not.toHaveBeenCalled();
    });

    it("devuelve 404 si la ficha no existe", async () => {
        repo.findById.mockResolvedValue(null);
        await expect(servicio.ejecutar(ID)).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.eliminar).not.toHaveBeenCalled();
        expect(eliminarPublico).not.toHaveBeenCalled();
    });

    it("devuelve 404 si otra petición ya borró la ficha y no toca archivos", async () => {
        repo.eliminar.mockResolvedValue(false);
        await expect(servicio.ejecutar(ID)).rejects.toBeInstanceOf(NotFoundException);
        expect(eliminarPublico).not.toHaveBeenCalled();
    });

    it("conserva la foto si otra ficha la usa", async () => {
        repo.fotoEnUso.mockResolvedValue(true);
        await servicio.ejecutar(ID);
        expect(repo.eliminar).toHaveBeenCalledWith(ID);
        expect(eliminarPublico).not.toHaveBeenCalled();
    });

    it.each([
        null,
        "https://otro.test/foto.png",
        "/archivos/otra/foto.png",
        `/archivos/plagas/../../privado/${ID}.png`,
        `/archivos/plagas/${ID}.png/otra`,
    ])("no intenta borrar fotos ajenas o rutas inválidas: %p", async (fotoUrl) => {
        ficha = crearFicha(undefined, fotoUrl);
        await servicio.ejecutar(ID);
        expect(repo.fotoEnUso).not.toHaveBeenCalled();
        expect(eliminarPublico).not.toHaveBeenCalled();
    });

    it("conserva la foto si falla el DELETE", async () => {
        repo.eliminar.mockRejectedValue(new Error("Fallo de persistencia"));
        await expect(servicio.ejecutar(ID)).rejects.toThrow("Fallo de persistencia");
        expect(eliminarPublico).not.toHaveBeenCalled();
    });

    it("retira la foto del disco y deja intacta una foto distinta; tolera que ya no exista", async () => {
        const raiz = await mkdtemp(join(tmpdir(), "plagas-delete-"));
        const anterior = process.env.UPLOADS_DIR;
        try {
            process.env.UPLOADS_DIR = raiz;
            const local = new LocalAlmacenamientoAdapter();
            const directorio = join(raiz, "publico", "plagas");
            const propia = join(directorio, `${ID}.png`);
            const ajena = join(directorio, "22222222-2222-4222-8222-222222222222.png");
            await mkdir(directorio, { recursive: true });
            await writeFile(propia, "propia");
            await writeFile(ajena, "ajena");
            servicio = new EliminarPlagaService(repo, local, new ObtenerPlagaService(repo));
            await servicio.ejecutar(ID);
            await expect(readFile(propia)).rejects.toMatchObject({ code: "ENOENT" });
            expect(await readFile(ajena, "utf8")).toBe("ajena");
            await expect(servicio.ejecutar(ID)).resolves.toBeUndefined();
        } finally {
            if (anterior === undefined) delete process.env.UPLOADS_DIR;
            else process.env.UPLOADS_DIR = anterior;
            await rm(raiz, { recursive: true, force: true });
        }
    });
});
