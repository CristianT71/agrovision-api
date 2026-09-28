import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
    IOtorgarPermisoContactoUseCase,
    PermisoContactoVista,
} from "../../domain/ports/in/gestionar-permisos-contacto.port";
import {
    PERMISO_CONTACTO_REPOSITORY,
    type IPermisoContactoRepository,
} from "../../domain/ports/out/permiso-contacto.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { PermisoContacto } from "../../domain/entities/permiso-contacto.entity";
import { obtenerContexto } from "./resolver-acceso";
import { aPermisoContactoVista } from "./permiso-contacto-vista";

@Injectable()
export class OtorgarPermisoContactoService implements IOtorgarPermisoContactoUseCase {
    constructor(
        @Inject(PERMISO_CONTACTO_REPOSITORY)
        private readonly permisoRepository: IPermisoContactoRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
    ) {}

    async ejecutar(comando: { adminUsuarioId: string; solicitudId: string }): Promise<PermisoContactoVista> {
        // 1. La solicitud debe existir
        const contexto = await obtenerContexto(comando.solicitudId, this.consultaSolicitudes);

        // 2. Una fila por solicitud: se reutiliza la que exista
        const permiso =
            (await this.permisoRepository.findBySolicitudId(comando.solicitudId)) ??
            PermisoContacto.sinOtorgar(uuidv4(), comando.solicitudId);

        // 3. Regla de negocio pura del dominio (RF-08.8)
        permiso.otorgar(contexto, comando.adminUsuarioId);

        const guardado = await this.permisoRepository.guardar(permiso);

        return aPermisoContactoVista(guardado, contexto);
    }
}
