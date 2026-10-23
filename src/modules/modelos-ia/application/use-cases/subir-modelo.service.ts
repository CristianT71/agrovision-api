import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type {
    ISubirModeloUseCase,
    ModeloVista,
    SubirModeloCommand,
} from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { FIRMADOR_MODELOS, type IFirmadorModelos } from "../../domain/ports/out/firmador-modelos.port";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type ArchivoParaGuardar,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { ArchivoSubido } from "../../../../common/almacenamiento/validar-archivo";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import { ModeloIa } from "../../domain/entities/modelo-ia.entity";
import { RegistroAuditoria } from "../../domain/entities/registro-auditoria.entity";
import {
    detectarFormatoModelo,
    leerEtiquetasTexto,
    normalizarJson,
    validarCalibracion,
    validarEtiquetas,
    type ResumenEtiquetas,
} from "../../domain/services/artefactos-modelo";
import { aModeloVista } from "./modelo-vista";

// Un .keras de entrenamiento con el modelo grande (teacher) pesa más: ese no se sube, el que llega
// a la app es el .tflite
export const MAX_BYTES_MODELO = 100 * 1024 * 1024;
export const MAX_BYTES_JSON_MODELO = 5 * 1024 * 1024;

@Injectable()
export class SubirModeloService implements ISubirModeloUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
        @Inject(FIRMADOR_MODELOS)
        private readonly firmador: IFirmadorModelos,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(comando: SubirModeloCommand): Promise<ModeloVista> {
        // 1. Una versión publicada no se sobrescribe: los dispositivos la identifican por ese número
        if (await this.modeloRepository.findByVersion(comando.version)) {
            throw new ReglaNegocioError(`Ya existe un modelo con la versión ${comando.version}.`);
        }

        // 2. RF-09.5: .tflite, .keras o .pt, reconocidos por su contenido
        this.revisarTamano(comando.modelo, MAX_BYTES_MODELO);
        const formato = detectarFormatoModelo(comando.modelo.buffer, comando.modelo.originalname);
        if (!formato) {
            throw new BadRequestException("El modelo debe ser un archivo .tflite, .keras o .pt válido.");
        }

        // 3. Basta con el modelo: las etiquetas (labels.txt o labels.json) y la calibración se pueden
        //    completar después. Sin ellas el modelo queda en borrador y no puede publicarse.
        const etiquetas = comando.etiquetas ? this.leerJson(comando.etiquetas) : null;
        const calibracion = comando.calibracion ? this.leerJson(comando.calibracion) : null;
        if (calibracion && !etiquetas) {
            throw new BadRequestException("La calibración se valida contra las etiquetas: sube también labels.json.");
        }
        const resumen = etiquetas ? this.validarConjunto(etiquetas, calibracion) : null;
        const clasesTexto = this.leerClasesTexto(comando.etiquetasTexto);
        if (resumen && clasesTexto.length > 0 && clasesTexto.length !== resumen.numeroClases) {
            throw new BadRequestException(
                `labels.txt tiene ${clasesTexto.length} clases y labels.json declara ${resumen.numeroClases}.`,
            );
        }
        const clases = resumen?.clases ?? clasesTexto;

        // 4. Huella del modelo y firma del conjunto que verifica la app
        const sha256 = createHash("sha256").update(comando.modelo.buffer).digest("hex");
        const firma =
            formato === "tflite" && etiquetas && calibracion
                ? this.firmador.firmarConjunto({ sha256Modelo: sha256, etiquetas, calibracion })
                : null;

        // 5. Archivos en almacenamiento privado: solo se descargan por la API
        const carpeta = `modelos/${comando.version}`;
        const guardados: string[] = [];
        try {
            const rutaModelo = await this.guardar(
                carpeta,
                comando.modelo.originalname,
                comando.modelo.buffer,
                guardados,
            );
            const rutaEtiquetas = etiquetas ? await this.guardar(carpeta, "labels.json", etiquetas, guardados) : null;
            const rutaCalibracion = calibracion
                ? await this.guardar(carpeta, "calibration.json", calibracion, guardados)
                : null;

            const modelo = ModeloIa.registrar({
                id: uuidv4(),
                version: comando.version,
                formato,
                versionMinApp: comando.versionMinApp,
                notas: comando.notas,
                creadoPor: comando.adminUsuarioId,
                artefactos: {
                    rutaModelo,
                    rutaEtiquetas,
                    rutaCalibracion,
                    tamanoBytes: comando.modelo.size,
                    sha256,
                    firma,
                    numeroClases: clases.length > 0 ? clases.length : null,
                    clases: clases.length > 0 ? clases : null,
                },
            });

            // RF-09.4: la subida queda auditada en la misma transacción
            const auditoria = RegistroAuditoria.registrar({
                id: uuidv4(),
                modeloId: modelo.id,
                accion: "subida",
                actorUsuarioId: comando.adminUsuarioId,
                detalle: {
                    version: modelo.version,
                    formato,
                    sha256,
                    firmado: firma !== null,
                    artefactosCompletos: modelo.tieneArtefactosCompletos(),
                },
            });

            if (!(await this.modeloRepository.crear(modelo, auditoria))) {
                throw new ReglaNegocioError(`Ya existe un modelo con la versión ${comando.version}.`);
            }

            return aModeloVista(modelo);
        } catch (error) {
            // Si algo falla no quedan archivos huérfanos de un modelo que no existe
            await Promise.all(guardados.map((ruta) => this.almacenamiento.eliminarPrivado(ruta)));
            throw error;
        }
    }

    private leerClasesTexto(archivo: ArchivoSubido | undefined): string[] {
        if (!archivo) return [];

        this.revisarTamano(archivo, MAX_BYTES_JSON_MODELO);
        const resultado = leerEtiquetasTexto(archivo.buffer);
        if ("error" in resultado) throw new BadRequestException(resultado.error);

        return resultado.clases;
    }

    private validarConjunto(etiquetas: Buffer, calibracion: Buffer | null): ResumenEtiquetas {
        const resultado = validarEtiquetas(etiquetas);
        if ("error" in resultado) throw new BadRequestException(resultado.error);

        if (calibracion) {
            const error = validarCalibracion(calibracion, resultado.resumen);
            if (error) throw new BadRequestException(error);
        }

        return resultado.resumen;
    }

    private leerJson(archivo: ArchivoSubido): Buffer {
        this.revisarTamano(archivo, MAX_BYTES_JSON_MODELO);
        return normalizarJson(archivo.buffer);
    }

    private revisarTamano(archivo: ArchivoSubido, maxBytes: number): void {
        if (archivo.size > maxBytes) {
            const maxMb = Math.floor(maxBytes / (1024 * 1024));
            throw new BadRequestException(`El archivo "${archivo.originalname}" supera el límite de ${maxMb} MB.`);
        }
    }

    private async guardar(carpeta: string, nombre: string, contenido: Buffer, guardados: string[]): Promise<string> {
        const archivo: ArchivoParaGuardar = {
            nombreOriginal: nombre,
            tipoMime: nombre.endsWith(".json") ? "application/json" : "application/octet-stream",
            contenido,
        };
        const ruta = await this.almacenamiento.guardarPrivado(carpeta, archivo);
        guardados.push(ruta);
        return ruta;
    }
}
