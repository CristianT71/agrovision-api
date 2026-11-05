import { Inject, Injectable } from "@nestjs/common";
import { AsignarSolicitudService } from "./asignar-solicitud.service";
import { Solicitud } from "../../domain/entities/solicitud.entity";
import { POLITICA_ASIGNACION, type IPoliticaAsignacion } from "../../domain/ports/out/politica-asignacion.port";
import { SOLICITUD_REPOSITORY, type ISolicitudRepository } from "../../domain/ports/out/solicitud.repository";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

// RF-08: con la asignación automática activa, una solicitud recién enviada va al agrónomo activo
// con menos casos en curso, siempre que no haya llegado a la carga máxima (RF-08.4).
@Injectable()
export class AsignarAutomaticamenteService {
    constructor(
        @Inject(POLITICA_ASIGNACION) private readonly politica: IPoliticaAsignacion,
        @Inject(SOLICITUD_REPOSITORY) private readonly solicitudRepository: ISolicitudRepository,
        @Inject(AGRONOMO_REPOSITORY) private readonly agronomoRepository: IAgronomoRepository,
        private readonly asignarSolicitudService: AsignarSolicitudService,
    ) {}

    // Devuelve la solicitud asignada, o null si no correspondía o nadie tenía cupo (queda para el administrador)
    async ejecutar(solicitudId: string): Promise<Solicitud | null> {
        const { asignacionAutomatica, cargaMaxima } = await this.politica.obtener();
        if (!asignacionAutomatica) return null;

        const solicitud = await this.solicitudRepository.findById(solicitudId);
        if (!solicitud || solicitud.estado !== "Enviada" || solicitud.agronomoId) return null;

        const activos = await this.agronomoRepository.findAll({ estado: "activo" });
        if (activos.length === 0) return null;

        const carga = await this.agronomoRepository.contarCasosActivos(activos.map((agronomo) => agronomo.id));
        const casosDe = (id: string) => carga.get(id) ?? 0;

        const elegido = activos
            .filter((agronomo) => cargaMaxima === null || casosDe(agronomo.id) < cargaMaxima)
            .sort((a, b) => casosDe(a.id) - casosDe(b.id))[0];
        if (!elegido) return null;

        // Ya se verificó el cupo: no hace falta pedir confirmación de sobrecarga
        return await this.asignarSolicitudService.ejecutar({
            solicitudId,
            agronomoId: elegido.id,
            confirmarSobrecarga: true,
        });
    }
}
