import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { IContarSolicitudesUseCase } from "../../domain/ports/in/consultar-solicitudes.port";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import { armarContadores, type ContadoresBandeja } from "../../domain/services/contadores-bandeja";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";
import { obtenerAgronomoIdDeCuenta } from "./verificar-acceso-solicitud.service";

// RF-03.4, RF-08.2: contadores de la bandeja con la misma regla de acceso que la lista
@Injectable()
export class ContarSolicitudesService implements IContarSolicitudesUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(usuario: { id: string; rol: string }): Promise<ContadoresBandeja> {
        if (usuario.rol === "admin") {
            return armarContadores(await this.lecturaSolicitudes.contarBandeja({}));
        }

        if (usuario.rol !== "agronomo") {
            throw new ForbiddenException("Los contadores de la bandeja son solo para agrónomos y administradores.");
        }

        const agronomoId = await obtenerAgronomoIdDeCuenta(this.agronomoRepository, usuario.id);
        const contadores = armarContadores(await this.lecturaSolicitudes.contarBandeja({ agronomoId }));

        // Lo suyo siempre tiene agrónomo; asignar es tarea del administrador
        return { ...contadores, sinAsignar: 0 };
    }
}
