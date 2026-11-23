import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
    IObtenerUbicacionSolicitudUseCase,
    UbicacionSolicitudVista,
} from "../../domain/ports/in/ubicacion-solicitudes.port";
import { SOLICITUD_REPOSITORY, type ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { CONSULTAR_ELEVACION, type IConsultarElevacion } from "../../domain/ports/out/consultar-elevacion.port";
import {
    AUDITORIA_UBICACIONES,
    type AccionAuditoriaUbicacion,
    type IAuditoriaUbicaciones,
} from "../../domain/ports/out/auditoria-ubicaciones.port";
import {
    PRODUCTOR_REPOSITORY,
    type IProductorRepository,
} from "../../../productores/domain/ports/out/productor.repository";
import { construirKml } from "../../domain/services/kml-ubicaciones";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";

type Usuario = { id: string; rol: string };

// Dónde se tomó la foto de una solicitud, con su altitud. Es el único camino (junto al mapa) por el que salen las
// coordenadas hacia el panel: admin siempre, agrónomo solo si es el asignado, y solo con el consentimiento
// del productor vigente. Cada consulta deja rastro antes de devolver nada.
@Injectable()
export class ObtenerUbicacionSolicitudService implements IObtenerUbicacionSolicitudUseCase {
    constructor(
        private readonly verificarAcceso: VerificarAccesoSolicitudService,
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
        @Inject(SOLICITUD_REPOSITORY)
        private readonly solicitudRepository: ISolicitudRepository,
        @Inject(CONSULTAR_ELEVACION)
        private readonly consultarElevacion: IConsultarElevacion,
        @Inject(AUDITORIA_UBICACIONES)
        private readonly auditoria: IAuditoriaUbicaciones,
    ) {}

    async ejecutar(usuario: Usuario, solicitudId: string): Promise<UbicacionSolicitudVista | null> {
        return await this.consultar(usuario, solicitudId, "ubicacion_detalle");
    }

    async ejecutarKml(usuario: Usuario, solicitudId: string): Promise<{ nombreArchivo: string; kml: string }> {
        const ubicacion = await this.consultar(usuario, solicitudId, "ubicacion_kml");
        if (!ubicacion) {
            throw new NotFoundException(`La solicitud con ID ${solicitudId} no tiene ubicación registrada.`);
        }

        const codigo = `SOL-${ubicacion.solicitudId.slice(0, 8).toUpperCase()}`;
        const kml = construirKml(codigo, [
            {
                nombre: codigo,
                descripcion: [
                    `Productor: ${ubicacion.productorNombre ?? "sin nombre"}`,
                    `Finca: ${ubicacion.finca} (${ubicacion.vereda}, ${ubicacion.municipio})`,
                    `Estado: ${ubicacion.estado}`,
                    ubicacion.altitudMsnm === null ? "Altitud: sin dato" : `Altitud: ${ubicacion.altitudMsnm} msnm`,
                    ubicacion.precisionMetros === null ? "" : `Precisión: ${ubicacion.precisionMetros} m`,
                    ubicacion.simulada ? "Atención: ubicación marcada como simulada" : "",
                ]
                    .filter(Boolean)
                    .join("\n"),
                latitud: ubicacion.latitud,
                longitud: ubicacion.longitud,
                altitudMsnm: ubicacion.altitudMsnm,
            },
        ]);

        return { nombreArchivo: `${codigo.toLowerCase()}.kml`, kml };
    }

    private async consultar(
        usuario: Usuario,
        solicitudId: string,
        accion: AccionAuditoriaUbicacion,
    ): Promise<UbicacionSolicitudVista | null> {
        // Admin siempre; el agrónomo solo la suya (una ajena responde 404 igual que una inexistente)
        const { solicitud, productorNombre } = await this.verificarAcceso.ejecutar(usuario, solicitudId);

        if (!solicitud.tieneUbicacion()) return null;

        // Sin consentimiento vigente no se revela dónde está el cultivo, ni siquiera que hay coordenadas
        const productor = await this.productorRepository.findById(solicitud.productorId);
        if (!productor?.consentimiento) {
            throw new NotFoundException(`La solicitud con ID ${solicitudId} no tiene ubicación disponible.`);
        }

        const latitud = solicitud.latitud as number;
        const longitud = solicitud.longitud as number;

        // Altitud perezosa: se pide al servicio una sola vez y queda guardada para las siguientes consultas
        if (solicitud.altitudMsnm === null) {
            const metros = await this.elevacionSegura(latitud, longitud);
            if (metros !== null) {
                solicitud.registrarAltitudDeServicio(metros);
                await this.solicitudRepository.guardarAltitudDeServicio(solicitud.id, metros);
            }
        }

        // Si el rastro no se puede escribir, la consulta falla: no hay lectura sin registro
        await this.auditoria.registrar({
            accion,
            actorUsuarioId: usuario.id,
            solicitudId: solicitud.id,
            filtros: null,
            resultados: null,
        });

        return {
            solicitudId: solicitud.id,
            estado: solicitud.estado,
            fecha: solicitud.fecha,
            productorNombre,
            municipio: solicitud.municipio,
            vereda: solicitud.vereda,
            finca: solicitud.finca,
            latitud,
            longitud,
            precisionMetros: solicitud.precisionMetros,
            altitudMsnm: solicitud.altitudMsnm,
            altitudOrigen: solicitud.altitudOrigen,
            simulada: solicitud.ubicacionSimulada,
        };
    }

    // El puerto promete no lanzar; esto protege a la consulta si un adaptador lo incumple
    private async elevacionSegura(latitud: number, longitud: number): Promise<number | null> {
        try {
            return await this.consultarElevacion.consultar(latitud, longitud);
        } catch {
            return null;
        }
    }
}
