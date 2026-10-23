import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { SubirModeloService } from "./subir-modelo.service";
import { CompletarArtefactosService } from "./completar-artefactos.service";
import { RegistrarMetricasService } from "./registrar-metricas.service";
import { CambiarCanalService } from "./cambiar-canal.service";
import { ActivarKillSwitchService } from "./activar-kill-switch.service";
import { ObtenerManifiestoService } from "./obtener-manifiesto.service";
import { DescargarArtefactoService } from "./descargar-artefacto.service";
import { ModeloIa, type ArtefactosModelo, type Canal } from "../../domain/entities/modelo-ia.entity";
import { MetricaModelo } from "../../domain/entities/metrica-modelo.entity";
import type { RegistroAuditoria } from "../../domain/entities/registro-auditoria.entity";
import type { IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import type { IFirmadorModelos } from "../../domain/ports/out/firmador-modelos.port";
import type { IUrlsArtefactos } from "../../domain/ports/out/urls-artefactos.port";
import type {
    ArchivoParaGuardar,
    IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { ArchivoSubido } from "../../../../common/almacenamiento/validar-archivo";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// uuid se publica como ESM y Jest no lo carga: se reemplaza por el generador nativo
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

const archivo = (nombre: string, contenido: Buffer): ArchivoSubido => ({
    originalname: nombre,
    mimetype: "application/octet-stream",
    size: contenido.length,
    buffer: contenido,
});

const TFLITE = Buffer.concat([Buffer.from([0x18, 0, 0, 0]), Buffer.from("TFL3"), Buffer.alloc(16)]);
const ETIQUETAS = Buffer.from(
    JSON.stringify({
        version: "1.0.0",
        class_count: 2,
        embedding_dim: 2,
        classes: [
            { index: 0, class_id: "Enfermedad_Roya", display_name: "Roya" },
            { index: 1, class_id: "Sana", display_name: "Sana", pest_id: null },
        ],
    }),
);
const CALIBRACION = Buffer.from(
    JSON.stringify({
        temperature: 1.4,
        confidence_threshold: 0.7,
        margin_threshold: 0.1,
        ood_threshold: 2.5,
        energy_weight: 0.5,
        energy_mean: -4,
        energy_std_dev: 1.2,
        class_centroids: [
            [0.1, 0.2],
            [0.3, 0.4],
        ],
        precision_matrix: [1, 0, 0, 1],
    }),
);

const ARTEFACTOS: ArtefactosModelo = {
    rutaModelo: "modelos/x/modelo",
    rutaEtiquetas: "modelos/x/labels",
    rutaCalibracion: "modelos/x/calibration",
    tamanoBytes: 24,
    sha256: "ab".repeat(32),
    firma: "firma-base64",
    numeroClases: 2,
    clases: ["Enfermedad_Roya", "Sana"],
};

// Modelo listo para publicarse, llevado por el pipeline hasta el canal pedido
function modeloEn(canal: Canal, id: string, version: string): ModeloIa {
    const modelo = ModeloIa.registrar({
        id,
        version,
        formato: "tflite",
        versionMinApp: "2.0.0",
        artefactos: { ...ARTEFACTOS },
        creadoPor: "u-admin",
    });
    modelo.registrarMetricas([MetricaModelo.crear({ precision: 0.98, recall: 0.97, f1: 0.98 })]);
    const ruta: Canal[] = ["interno", "canario", "produccion"];
    for (const paso of ruta.slice(0, ruta.indexOf(canal) + 1)) {
        modelo.cambiarCanal(paso, { porcentajeCanario: 10 });
    }
    return modelo;
}

describe("Modelos IA - casos de uso", () => {
    let repositorio: jest.Mocked<IModeloIaRepository>;
    let almacenamiento: jest.Mocked<IAlmacenamientoArchivos>;
    // Mocks sueltos para las aserciones: evita referenciar métodos del objeto (unbound-method)
    let crear: jest.Mock<Promise<boolean>, [ModeloIa, RegistroAuditoria]>;
    let guardarCambios: jest.Mock<Promise<boolean>, [ModeloIa[], RegistroAuditoria[]]>;
    let guardarPrivado: jest.Mock<Promise<string>, [string, ArchivoParaGuardar]>;
    let eliminarPrivado: jest.Mock<Promise<void>, [string]>;
    let firmarConjunto: jest.Mock<string | null, [{ sha256Modelo: string; etiquetas: Buffer; calibracion: Buffer }]>;
    let porCanal: Partial<Record<Canal, ModeloIa>>;

    beforeEach(() => {
        porCanal = {};
        crear = jest.fn<Promise<boolean>, [ModeloIa, RegistroAuditoria]>(() => Promise.resolve(true));
        guardarCambios = jest.fn<Promise<boolean>, [ModeloIa[], RegistroAuditoria[]]>(() => Promise.resolve(true));
        let numero = 0;
        guardarPrivado = jest.fn<Promise<string>, [string, ArchivoParaGuardar]>((carpeta) =>
            Promise.resolve(`${carpeta}/archivo-${++numero}`),
        );
        eliminarPrivado = jest.fn<Promise<void>, [string]>(() => Promise.resolve());
        firmarConjunto = jest.fn(() => "firma-ed25519");

        repositorio = {
            findById: jest.fn().mockResolvedValue(null),
            findByVersion: jest.fn().mockResolvedValue(null),
            findAll: jest.fn(({ canal }: { canal?: Canal } = {}) =>
                Promise.resolve(canal && porCanal[canal] ? [porCanal[canal]] : []),
            ),
            crear,
            guardarMetricas: jest.fn().mockResolvedValue(undefined),
            guardarCambios,
            listarAuditoria: jest.fn().mockResolvedValue([]),
        };
        almacenamiento = {
            guardarPublico: jest.fn(),
            eliminarPublico: jest.fn(),
            guardarPrivado,
            leerPrivado: jest.fn().mockResolvedValue(Buffer.from("contenido")),
            eliminarPrivado,
        };
    });

    describe("SubirModeloService (RF-09.5)", () => {
        const firmador = (): IFirmadorModelos => ({ firmarConjunto });
        const subir = (archivos: { modelo?: Buffer; etiquetas?: Buffer | null; calibracion?: Buffer | null } = {}) =>
            new SubirModeloService(repositorio, firmador(), almacenamiento).ejecutar({
                adminUsuarioId: "u-admin",
                version: "1.2.0",
                versionMinApp: "2.0.0",
                modelo: archivo("modelo.tflite", archivos.modelo ?? TFLITE),
                etiquetas:
                    archivos.etiquetas === null ? undefined : archivo("labels.json", archivos.etiquetas ?? ETIQUETAS),
                calibracion:
                    archivos.calibracion === null
                        ? undefined
                        : archivo("calibration.json", archivos.calibracion ?? CALIBRACION),
            });

        it("guarda el .tflite firmado como borrador y lo audita", async () => {
            const vista = await subir();

            expect(vista).toMatchObject({ canal: "borrador", formato: "tflite", firmado: true, numeroClases: 2 });
            expect(vista).not.toHaveProperty("artefactos");
            expect(guardarPrivado).toHaveBeenCalledTimes(3);
            expect(crear.mock.calls[0][1]).toMatchObject({ accion: "subida", actorUsuarioId: "u-admin" });
        });

        it("firma con el sha256 real del modelo y las etiquetas sin BOM", async () => {
            const conBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), ETIQUETAS]);
            await subir({ etiquetas: conBom });

            const { sha256Modelo, etiquetas } = firmarConjunto.mock.calls[0][0];
            expect(sha256Modelo).toMatch(/^[0-9a-f]{64}$/);
            expect(etiquetas.equals(ETIQUETAS)).toBe(true);
        });

        it("rechaza un archivo que no es un modelo", async () => {
            await expect(subir({ modelo: Buffer.from("%PDF-1.4") })).rejects.toBeInstanceOf(BadRequestException);
            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("acepta el .tflite solo: queda en borrador, sin firma y sin poder publicarse", async () => {
            const vista = await subir({ etiquetas: null, calibracion: null });

            expect(vista).toMatchObject({
                canal: "borrador",
                formato: "tflite",
                firmado: false,
                artefactosCompletos: false,
                numeroClases: null,
            });
            expect(guardarPrivado).toHaveBeenCalledTimes(1);
            expect(firmarConjunto).not.toHaveBeenCalled();
        });

        it("con labels.txt guarda las clases en el orden del archivo", async () => {
            const vista = await new SubirModeloService(repositorio, firmador(), almacenamiento).ejecutar({
                adminUsuarioId: "u-admin",
                version: "1.0.0",
                versionMinApp: "2.0.0",
                modelo: archivo("model_coffee_int8.tflite", TFLITE),
                etiquetasTexto: archivo("labels.txt", Buffer.from("Cerscospora\r\nHealthy\n\nLeaf rust\n")),
            });

            // El .tflite y su labels.txt bastan: se arman labels.json y calibration.json de un modelo
            // simple, el modelo queda firmado y la app lo puede instalar
            expect(vista).toMatchObject({
                numeroClases: 3,
                clases: ["Cerscospora", "Healthy", "Leaf rust"],
                firmado: true,
                artefactosCompletos: true,
            });
            expect(guardarPrivado).toHaveBeenCalledTimes(3);
            const { etiquetas, calibracion } = firmarConjunto.mock.calls[0][0];
            const labels = JSON.parse(etiquetas.toString()) as {
                classes: { class_id: string; pest_id: string | null }[];
            };
            expect(labels.classes.map((c) => c.pest_id)).toEqual([
                "Enfermedad_ManchadeHierro",
                null,
                "Enfermedad_Roya",
            ]);
            expect(JSON.parse(calibracion.toString())).toMatchObject({ class_centroids: [], precision_matrix: [] });
        });

        it("rechaza un labels.txt con clases repetidas", async () => {
            await expect(
                new SubirModeloService(repositorio, firmador(), almacenamiento).ejecutar({
                    adminUsuarioId: "u-admin",
                    version: "1.0.0",
                    versionMinApp: "2.0.0",
                    modelo: archivo("modelo.tflite", TFLITE),
                    etiquetasTexto: archivo("labels.txt", Buffer.from("Sana\nSana\n")),
                }),
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("rechaza una calibración sin labels.json con que validarla", async () => {
            await expect(subir({ etiquetas: null })).rejects.toBeInstanceOf(BadRequestException);
        });

        it("guarda un .keras como referencia, reconocido por su extensión", async () => {
            const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32)]);
            const vista = await new SubirModeloService(repositorio, firmador(), almacenamiento).ejecutar({
                adminUsuarioId: "u-admin",
                version: "1.0.0",
                versionMinApp: "2.0.0",
                modelo: archivo("modelo.keras", zip),
            });

            expect(vista).toMatchObject({ formato: "keras", canal: "borrador", firmado: false });
        });

        it("rechaza una calibración incoherente con las etiquetas", async () => {
            const json = JSON.parse(CALIBRACION.toString()) as Record<string, unknown>;
            json.class_centroids = [[0.1, 0.2]];

            await expect(subir({ calibracion: Buffer.from(JSON.stringify(json)) })).rejects.toBeInstanceOf(
                BadRequestException,
            );
        });

        it("no sobrescribe una versión existente", async () => {
            repositorio.findByVersion.mockResolvedValue(modeloEn("borrador", "m-0", "1.2.0"));

            await expect(subir()).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("borra los archivos si la versión se registró al mismo tiempo", async () => {
            crear.mockResolvedValue(false);

            await expect(subir()).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(eliminarPrivado).toHaveBeenCalledTimes(3);
        });
    });

    describe("CompletarArtefactosService", () => {
        const completar = (archivos: { etiquetas?: Buffer; calibracion?: Buffer; texto?: Buffer }) =>
            new CompletarArtefactosService(repositorio, { firmarConjunto }, almacenamiento).ejecutar({
                adminUsuarioId: "u-admin",
                modeloId: "m-1",
                etiquetas: archivos.etiquetas && archivo("labels.json", archivos.etiquetas),
                calibracion: archivos.calibracion && archivo("calibration.json", archivos.calibracion),
                etiquetasTexto: archivos.texto && archivo("labels.txt", archivos.texto),
            });

        const soloModelo = (): ModeloIa =>
            ModeloIa.registrar({
                id: "m-1",
                version: "1.0.0",
                formato: "tflite",
                versionMinApp: "2.0.0",
                artefactos: { ...ARTEFACTOS, rutaEtiquetas: null, rutaCalibracion: null, firma: null, clases: null },
                creadoPor: "u-admin",
            });

        it("con labels.json y calibration.json firma el conjunto y lo deja listo para publicar", async () => {
            repositorio.findById.mockResolvedValue(soloModelo());

            const vista = await completar({ etiquetas: ETIQUETAS, calibracion: CALIBRACION });

            expect(vista).toMatchObject({ firmado: true, artefactosCompletos: true, numeroClases: 2 });
            expect(guardarCambios.mock.calls[0][1][0]).toMatchObject({ accion: "artefactos" });
        });

        it("con solo labels.json guarda las etiquetas y sigue sin firma", async () => {
            repositorio.findById.mockResolvedValue(soloModelo());

            const vista = await completar({ etiquetas: ETIQUETAS });

            expect(vista).toMatchObject({
                firmado: false,
                artefactosCompletos: false,
                clases: ["Enfermedad_Roya", "Sana"],
            });
            expect(firmarConjunto).not.toHaveBeenCalled();
        });

        it("la calibración llega después: toma las etiquetas ya guardadas", async () => {
            const modelo = soloModelo();
            modelo.artefactos.rutaEtiquetas = "modelos/1.0.0/etiquetas";
            repositorio.findById.mockResolvedValue(modelo);
            (almacenamiento.leerPrivado as jest.Mock).mockResolvedValue(ETIQUETAS);

            const vista = await completar({ calibracion: CALIBRACION });

            expect(vista).toMatchObject({ firmado: true, artefactosCompletos: true });
        });

        it("un modelo publicado no admite cambios de archivos", async () => {
            repositorio.findById.mockResolvedValue(modeloEn("canario", "m-1", "1.0.0"));

            await expect(completar({ etiquetas: ETIQUETAS, calibracion: CALIBRACION })).rejects.toBeInstanceOf(
                ReglaNegocioError,
            );
            expect(guardarPrivado).not.toHaveBeenCalled();
        });

        it("con labels.txt arma los archivos de un modelo simple y lo firma", async () => {
            repositorio.findById.mockResolvedValue(soloModelo());

            const vista = await completar({ texto: Buffer.from("Healthy\nLeaf rust\n") });

            expect(vista).toMatchObject({ firmado: true, artefactosCompletos: true, numeroClases: 2 });
        });

        it("sin archivos usa las clases que el modelo guardó al subirse", async () => {
            const modelo = soloModelo();
            modelo.artefactos.clases = ["Healthy", "Miner"];
            modelo.artefactos.numeroClases = 2;
            repositorio.findById.mockResolvedValue(modelo);

            const vista = await completar({});

            expect(vista).toMatchObject({ firmado: true, artefactosCompletos: true });
        });

        it("exige algún archivo cuando el modelo no tiene clases, y que el modelo exista", async () => {
            repositorio.findById.mockResolvedValue(soloModelo());
            await expect(completar({})).rejects.toBeInstanceOf(BadRequestException);

            repositorio.findById.mockResolvedValue(null);
            await expect(completar({ etiquetas: ETIQUETAS })).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe("RegistrarMetricasService (RF-09.2)", () => {
        it("guarda las métricas con su auditoría", async () => {
            const modelo = modeloEn("interno", "m-1", "1.2.0");
            repositorio.findById.mockResolvedValue(modelo);

            const vista = await new RegistrarMetricasService(repositorio).ejecutar({
                adminUsuarioId: "u-admin",
                modeloId: "m-1",
                global: { precision: 0.9924, recall: 0.99, f1: 0.9828 },
                porClase: [{ clase: "Sana", precision: 1, recall: 0.9963, f1: 0.9982 }],
            });

            expect(vista.metricas).toHaveLength(2);
            expect(repositorio.guardarMetricas.mock.calls[0][1]).toMatchObject({ accion: "metricas" });
        });
    });

    describe("CambiarCanalService (RF-09.5)", () => {
        const cambiar = (modeloId: string, canal: Canal, porcentajeCanario?: number) =>
            new CambiarCanalService(repositorio).ejecutar({
                adminUsuarioId: "u-admin",
                modeloId,
                canal,
                porcentajeCanario,
            });

        it("al promover a producción retira la vigente en la misma operación", async () => {
            const vigente = modeloEn("produccion", "m-vieja", "1.1.0");
            const canario = modeloEn("canario", "m-nueva", "1.2.0");
            porCanal = { produccion: vigente, canario };
            repositorio.findById.mockResolvedValue(canario);

            const { modelo, retirado } = await cambiar("m-nueva", "produccion");

            expect(modelo.canal).toBe("produccion");
            expect(retirado?.canal).toBe("descontinuado");
            // El retirado va primero: libera la producción antes de que la ocupe el nuevo
            const [modelos, auditorias] = guardarCambios.mock.calls[0];
            expect(modelos.map((m) => m.id)).toEqual(["m-vieja", "m-nueva"]);
            expect(auditorias).toHaveLength(2);
        });

        it("no lanza un segundo canario mientras hay uno en curso", async () => {
            porCanal = { canario: modeloEn("canario", "m-otro", "1.3.0") };
            repositorio.findById.mockResolvedValue(modeloEn("interno", "m-1", "1.4.0"));

            await expect(cambiar("m-1", "canario", 10)).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(guardarCambios).not.toHaveBeenCalled();
        });

        it("no publica una versión menor que la de producción", async () => {
            porCanal = { produccion: modeloEn("produccion", "m-prod", "2.0.0") };
            repositorio.findById.mockResolvedValue(modeloEn("interno", "m-1", "1.9.0"));

            await expect(cambiar("m-1", "canario", 10)).rejects.toThrow("mayor que la de producción");
        });

        it("responde 409 si otro administrador cambió el pipeline al mismo tiempo", async () => {
            repositorio.findById.mockResolvedValue(modeloEn("interno", "m-1", "1.2.0"));
            guardarCambios.mockResolvedValue(false);

            await expect(cambiar("m-1", "canario", 10)).rejects.toBeInstanceOf(ConflictException);
        });

        it("devuelve 404 si el modelo no existe", async () => {
            await expect(cambiar("m-x", "interno")).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe("ActivarKillSwitchService (RF-09.3, RF-09.4)", () => {
        it("guarda la justificación como causa en el registro de auditoría", async () => {
            repositorio.findById.mockResolvedValue(modeloEn("produccion", "m-1", "1.2.0"));
            const justificacion = "Confunde Phoma con Minador en fotos reales de campo";

            const vista = await new ActivarKillSwitchService(repositorio).ejecutar({
                adminUsuarioId: "u-admin",
                modeloId: "m-1",
                justificacion,
            });

            expect(vista.killSwitch).toBe(true);
            expect(guardarCambios.mock.calls[0][1][0]).toMatchObject({
                accion: "kill_switch",
                actorUsuarioId: "u-admin",
                motivo: justificacion,
            });
        });

        it("sin justificación suficiente no toca nada", async () => {
            repositorio.findById.mockResolvedValue(modeloEn("produccion", "m-1", "1.2.0"));

            await expect(
                new ActivarKillSwitchService(repositorio).ejecutar({
                    adminUsuarioId: "u-admin",
                    modeloId: "m-1",
                    justificacion: "falla",
                }),
            ).rejects.toBeInstanceOf(ReglaNegocioError);
            expect(guardarCambios).not.toHaveBeenCalled();
        });
    });

    describe("ObtenerManifiestoService (contrato de la app)", () => {
        const urls: IUrlsArtefactos = { urlDe: (version, artefacto) => `https://api/${version}/${artefacto}` };
        const manifiesto = () =>
            new ObtenerManifiestoService(repositorio, urls).ejecutar({ deviceId: "telefono-1", appVersion: "2.1.0" });

        it("entrega el modelo de producción con sus URLs y su firma", async () => {
            porCanal = { produccion: modeloEn("produccion", "m-1", "1.2.0") };

            expect(await manifiesto()).toEqual({
                version: "1.2.0",
                channel: "PRODUCTION",
                minAppVersion: "2.0.0",
                sizeBytes: 24,
                sha256: "ab".repeat(32),
                signature: "firma-base64",
                artifacts: {
                    model: "https://api/1.2.0/model",
                    labels: "https://api/1.2.0/labels",
                    calibration: "https://api/1.2.0/calibration",
                },
                releaseNotes: "",
                killSwitch: false,
            });
        });

        it("con kill-switch en producción avisa a la app para que se revierta", async () => {
            const modelo = modeloEn("produccion", "m-1", "1.2.0");
            modelo.activarKillSwitch("Confunde Phoma con Minador en fotos reales");
            porCanal = { produccion: modelo };

            expect((await manifiesto())?.killSwitch).toBe(true);
        });

        it("sin modelo publicado responde null (la app sigue con el de fábrica)", async () => {
            expect(await manifiesto()).toBeNull();
        });
    });

    describe("DescargarArtefactoService", () => {
        const descargar = () =>
            new DescargarArtefactoService(repositorio, almacenamiento).ejecutar({
                version: "1.2.0",
                artefacto: "labels",
            });

        it("entrega el archivo de un modelo publicado", async () => {
            repositorio.findByVersion.mockResolvedValue(modeloEn("produccion", "m-1", "1.2.0"));

            const { nombre, tipoMime } = await descargar();

            expect(nombre).toBe("labels.json");
            expect(tipoMime).toBe("application/json");
        });

        it("no distribuye borradores: responde 404 como si no existiera", async () => {
            repositorio.findByVersion.mockResolvedValue(modeloEn("interno", "m-1", "1.2.0"));

            await expect(descargar()).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
