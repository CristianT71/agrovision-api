import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    CompletarArtefactosCommand,
    ICompletarArtefactosUseCase,
    ModeloVista,
} from "../../domain/ports/in/gestionar-modelos.port";
import { MODELO_IA_REPOSITORY, type IModeloIaRepository } from "../../domain/ports/out/modelo-ia.repository";
import { FIRMADOR_MODELOS, type IFirmadorModelos } from "../../domain/ports/out/firmador-modelos.port";
import {
    ALMACENAMIENTO_ARCHIVOS,
    type IAlmacenamientoArchivos,
} from "../../../../common/almacenamiento/almacenamiento.port";
import type { ArchivoSubido } from "../../../../common/almacenamiento/validar-archivo";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import { RegistroAuditoria } from "../../domain/entities/registro-auditoria.entity";
import { normalizarJson, validarCalibracion, validarEtiquetas } from "../../domain/services/artefactos-modelo";
import { MAX_BYTES_JSON_MODELO } from "./subir-modelo.service";
import { aModeloVista } from "./modelo-vista";

// El modelo se sube con lo que haya a mano; labels.json y calibration.json llegan después, juntos o
// por separado. Cuando ya están los dos se valida el conjunto y se firma, y el modelo puede publicarse.
@Injectable()
export class CompletarArtefactosService implements ICompletarArtefactosUseCase {
    constructor(
        @Inject(MODELO_IA_REPOSITORY)
        private readonly modeloRepository: IModeloIaRepository,
        @Inject(FIRMADOR_MODELOS)
        private readonly firmador: IFirmadorModelos,
        @Inject(ALMACENAMIENTO_ARCHIVOS)
        private readonly almacenamiento: IAlmacenamientoArchivos,
    ) {}

    async ejecutar(comando: CompletarArtefactosCommand): Promise<ModeloVista> {
        if (!comando.etiquetas && !comando.calibracion) {
            throw new BadRequestException("Adjunta labels.json, calibration.json o ambos.");
        }

        const modelo = await this.modeloRepository.findById(comando.modeloId);
        if (!modelo) throw new NotFoundException("El modelo no existe.");

        // Falla antes de tocar el almacenamiento si el modelo ya no admite cambios
        modelo.exigirArtefactosEditables();

        // Lo que llega ahora reemplaza a lo que hubiera; lo que no, se conserva
        const { artefactos } = modelo;
        const etiquetas = comando.etiquetas
            ? this.leerJson(comando.etiquetas)
            : artefactos.rutaEtiquetas
              ? await this.almacenamiento.leerPrivado(artefactos.rutaEtiquetas)
              : null;
        const calibracion = comando.calibracion
            ? this.leerJson(comando.calibracion)
            : artefactos.rutaCalibracion
              ? await this.almacenamiento.leerPrivado(artefactos.rutaCalibracion)
              : null;

        if (!etiquetas) {
            throw new BadRequestException("La calibración se valida contra las etiquetas: sube también labels.json.");
        }

        const validacion = validarEtiquetas(etiquetas);
        if ("error" in validacion) throw new BadRequestException(validacion.error);
        const resumen = validacion.resumen;

        if (calibracion) {
            const error = validarCalibracion(calibracion, resumen);
            if (error) throw new BadRequestException(error);
        }

        // Si ya había clases (de labels.txt) deben coincidir en número con las nuevas
        if (artefactos.numeroClases !== null && artefactos.numeroClases !== resumen.numeroClases) {
            throw new ReglaNegocioError(
                `El modelo se subió con ${artefactos.numeroClases} clases y las etiquetas nuevas traen ${resumen.numeroClases}.`,
            );
        }

        const carpeta = `modelos/${modelo.version}`;
        const guardados: string[] = [];
        try {
            const rutaEtiquetas = comando.etiquetas
                ? await this.guardar(carpeta, "labels.json", etiquetas, guardados)
                : artefactos.rutaEtiquetas;
            const rutaCalibracion =
                comando.calibracion && calibracion
                    ? await this.guardar(carpeta, "calibration.json", calibracion, guardados)
                    : artefactos.rutaCalibracion;

            const firma = calibracion
                ? this.firmador.firmarConjunto({ sha256Modelo: artefactos.sha256, etiquetas, calibracion })
                : null;

            const reemplazadas = [
                comando.etiquetas ? artefactos.rutaEtiquetas : null,
                comando.calibracion ? artefactos.rutaCalibracion : null,
            ].filter((ruta): ruta is string => ruta !== null);

            // Solo con labels.json se guarda lo que hay y el modelo sigue sin poder publicarse
            modelo.completarArtefactos({
                rutaEtiquetas: rutaEtiquetas as string,
                rutaCalibracion,
                firma,
                numeroClases: resumen.numeroClases,
                clases: resumen.clases,
            });

            const auditoria = RegistroAuditoria.registrar({
                id: uuidv4(),
                modeloId: modelo.id,
                accion: "artefactos",
                actorUsuarioId: comando.adminUsuarioId,
                detalle: {
                    etiquetas: comando.etiquetas !== undefined,
                    calibracion: comando.calibracion !== undefined,
                    firmado: modelo.artefactos.firma !== null,
                    artefactosCompletos: modelo.tieneArtefactosCompletos(),
                },
            });

            await this.modeloRepository.guardarCambios([modelo], [auditoria]);

            // Los archivos anteriores ya no los referencia nadie
            await Promise.all(reemplazadas.map((ruta) => this.almacenamiento.eliminarPrivado(ruta)));

            return aModeloVista(modelo);
        } catch (error) {
            await Promise.all(guardados.map((ruta) => this.almacenamiento.eliminarPrivado(ruta)));
            throw error;
        }
    }

    private leerJson(archivo: ArchivoSubido): Buffer {
        if (archivo.size > MAX_BYTES_JSON_MODELO) {
            throw new BadRequestException(`El archivo "${archivo.originalname}" supera el límite de 5 MB.`);
        }
        return normalizarJson(archivo.buffer);
    }

    private async guardar(carpeta: string, nombre: string, contenido: Buffer, guardados: string[]): Promise<string> {
        const ruta = await this.almacenamiento.guardarPrivado(carpeta, {
            nombreOriginal: nombre,
            tipoMime: "application/json",
            contenido,
        });
        guardados.push(ruta);
        return ruta;
    }
}
