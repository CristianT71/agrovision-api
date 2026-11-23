import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

jest.mock("@nestjs/config", () => ({ ConfigService: class {} }));
import type { QueryRunner } from "typeorm";
import { SembrarCatalogoPlagas1793100000000 } from "../../../../database/migrations/1793100000000-SembrarCatalogoPlagas";
import { SincronizacionPublicaPlagas1793500000000 } from "../../../../database/migrations/1793500000000-SincronizacionPublicaPlagas";
import type { FichaCatalogo, ICatalogoRepository } from "../../domain/ports/out/catalogo.repository";
import { UrlsFotosCatalogoAdapter } from "../../infrastructure/adapters/out/urls/urls-fotos-catalogo.adapter";
import { aPestDto, SincronizarCatalogoService } from "./sincronizar-catalogo.service";

const foto = "/archivos/plagas/11111111-1111-4111-8111-111111111111.png";
const fotos = new UrlsFotosCatalogoAdapter({ get: () => "https://agrovision.sbs/" } as unknown as ConfigService);
const ficha = (cambios: Partial<FichaCatalogo> = {}): FichaCatalogo => ({
    catalogId: "Enfermedad_Roya",
    nombreCientifico: "Hemileia vastatrix",
    nombreComun: "Roya de Café",
    sinonimos: ["Roya"],
    cultivo: "café",
    organosAfectados: ["hoja"],
    descripcion: "Manchas amarillas",
    medidasContencion: "Manejo de sombra",
    protocoloQuimico: "Texto químico que debe permanecer privado sin aval",
    fotoUrl: null,
    version: 1,
    tipo: "enfermedad",
    ...cambios,
});

describe("Mapeo público del catálogo Android", () => {
    it("rellena y publica EXACTAMENTE los ocho ids de Android sin modificar sus UUID internos", async () => {
        const sembradas: { uuid: string; scientificName: string | null; commonName: string }[] = [];
        const ids = new Map<string, string>();
        const runner = {
            query: (sql: string, parametros?: string[]) => {
                if (sql.startsWith('INSERT INTO "plagas"')) {
                    sembradas.push({
                        uuid: parametros![0],
                        commonName: parametros![1],
                        scientificName: parametros![2],
                    });
                }
                if (sql === "UPDATE plagas SET catalog_id = $2 WHERE id = $1") ids.set(parametros![0], parametros![1]);
                return Promise.resolve([]);
            },
        } as unknown as QueryRunner;
        // SQL capturado en memoria: estas pruebas no ejecutan migraciones en una base de datos.
        await new SembrarCatalogoPlagas1793100000000().up(runner);
        await new SincronizacionPublicaPlagas1793500000000().up(runner);
        const publicadas = sembradas.map((seed) =>
            aPestDto(
                ficha({
                    catalogId: ids.get(seed.uuid)!,
                    nombreCientifico: seed.scientificName,
                    nombreComun: seed.commonName,
                }),
                fotos,
            ),
        );
        expect(publicadas.map((p) => p.id)).toEqual([
            "Enfermedad_Roya",
            "Enfermedad_ManchadeHierro",
            "Enfermedad_OjodeGallo",
            "Enfermedad_Antracnosis",
            "Deficiencia_Azufre",
            "Deficiencia_Potasio",
            "Enfermedad_Phoma",
            "Plaga_Minador",
        ]);
        expect(publicadas.every((p) => p.images.length === 0 && p.recommendations.length === 0)).toBe(true);
        expect(publicadas[4].scientificName).toBe("Sin binomio registrado");
    });

    it("sin aval omite approval, vacía recommendations y no filtra datos internos", () => {
        const interna = {
            ...ficha(),
            usuarioId: "secreto",
            correo: "privado@ejemplo.com",
            estado: "interno",
            avales: ["privado"],
        };
        const dto = aPestDto(interna, fotos);
        expect(dto).toEqual({
            id: "Enfermedad_Roya",
            scientificName: "Hemileia vastatrix",
            commonName: "Roya de Café",
            localSynonyms: ["Roya"],
            crop: "CAFE",
            affectedOrgans: ["HOJA"],
            description: "Manchas amarillas",
            recommendations: [],
            images: [],
            version: 1,
            kind: "ENFERMEDAD",
        });
        expect(Object.hasOwn(dto, "approval")).toBe(false);
        expect(JSON.stringify(dto)).not.toMatch(/secreto|privado|interno|químico/);
    });

    it("con aval publica fecha numérica epoch ms y el texto del protocolo sin inventar dosis", () => {
        const fechaAval = new Date("2026-11-12T12:34:56.789Z");
        const dto = aPestDto(ficha({ aval: { nombreAgronomo: "Ana Ríos", numeroTarjeta: "TP-12", fechaAval } }), fotos);
        expect(dto.approval).toEqual({
            agronomistName: "Ana Ríos",
            licenseNumber: "TP-12",
            approvedAt: fechaAval.getTime(),
        });
        expect(dto.recommendations).toEqual([
            { kind: "CULTURAL", summary: "Medidas de contención", detail: "Manejo de sombra" },
            { kind: "QUIMICO", summary: "Protocolo químico", detail: ficha().protocoloQuimico },
        ]);
    });

    it("no publica recomendaciones si el aval está incompleto", () => {
        expect(
            aPestDto(ficha({ aval: { nombreAgronomo: "", numeroTarjeta: "TP-12", fechaAval: new Date() } }), fotos),
        ).toMatchObject({ recommendations: [] });
    });

    it("produce URLs HTTPS absolutas y solo para la carpeta pública del catálogo", () => {
        expect(aPestDto(ficha({ fotoUrl: foto }), fotos).images).toEqual([`https://agrovision.sbs${foto}`]);
        for (const fotoUrl of [
            null,
            "https://externo.com/foto.png",
            "/archivos/../privado/x.png",
            "/archivos/plagas/../../x.png",
        ]) {
            expect(aPestDto(ficha({ fotoUrl }), fotos).images).toEqual([]);
        }
        const inseguras = new UrlsFotosCatalogoAdapter({
            get: () => "http://agrovision.sbs",
        } as unknown as ConfigService);
        expect(() => inseguras.urlPublica(foto)).toThrow("HTTPS");
    });
});

describe("SincronizarCatalogoService", () => {
    it("envía since al puerto y conserva upserts, bajas y el reloj del snapshot", async () => {
        const leerDelta = jest
            .fn()
            .mockResolvedValue({ fichas: [ficha({ version: 3 })], deletedIds: ["Plaga_Minador"], serverTime: 5000 });
        const service = new SincronizarCatalogoService({ leerDelta }, fotos);
        const delta = await service.ejecutar(2000);
        expect(leerDelta).toHaveBeenCalledWith(2000);
        expect(delta).toMatchObject({
            upserted: [{ id: "Enfermedad_Roya", version: 3 }],
            deletedIds: ["Plaga_Minador"],
            serverTime: 5000,
        });
    });

    it("el ETag es estable frente al reloj y orden, y cambia con contenido, versión o bajas", async () => {
        const snapshot = {
            fichas: [ficha(), ficha({ catalogId: "Plaga_Minador" })],
            deletedIds: [] as string[],
            serverTime: 5000,
        };
        const repo: ICatalogoRepository = { leerDelta: () => Promise.resolve(snapshot) };
        const service = new SincronizarCatalogoService(repo, fotos);
        const primero = await service.ejecutar();
        snapshot.serverTime++;
        snapshot.fichas.reverse();
        expect((await service.ejecutar()).etag).toBe(primero.etag);
        snapshot.fichas[0].descripcion += " nueva";
        const conContenido = await service.ejecutar();
        expect(conContenido.etag).not.toBe(primero.etag);
        snapshot.fichas[0].version++;
        const conVersion = await service.ejecutar();
        expect(conVersion.etag).not.toBe(conContenido.etag);
        snapshot.deletedIds.push("Deficiencia_Azufre");
        expect((await service.ejecutar()).etag).not.toBe(conVersion.etag);
    });

    it("rechaza un cursor futuro", async () => {
        const repo: ICatalogoRepository = {
            leerDelta: () => Promise.resolve({ fichas: [], deletedIds: [], serverTime: 5000 }),
        };
        await expect(new SincronizarCatalogoService(repo, fotos).ejecutar(5001)).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });
});
