import { Inject, Injectable } from "@nestjs/common";
import type {
    IRevocarPermisoContactoUseCase,
    PermisoContactoVista,
} from "../../domain/ports/in/gestionar-permisos-contacto.port";
import {
    PERMISO_CONTACTO_REPOSITORY,
    type IPermisoContactoRepository,
} from "../../domain/ports/out/permiso-contacto.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import { obtenerContexto } from "./resolver-acceso";
import { aPermisoContactoVista } from "./permiso-contacto-vista";

@Injectable()
export class RevocarPermisoContactoService implements IRevocarPermisoContactoUseCase {
    constructor(
        @Inject(PERMISO_CONTACTO_REPOSITORY)
        private readonly permisoRepository: IPermisoContactoRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
    ) {}

    async ejecutar(comando: { adminUsuarioId: string; solicitudId: string }): Promise<PermisoContactoVista> {
        // 1. La solicitud debe existir
        const contexto = await obtenerContexto(comando.solicitudId, this.consultaSolicitudes);

        // 2. Sin fila no hubo nunca permiso que revocar
        const permiso = await this.permisoRepository.findBySolicitudId(comando.solicitudId);

        if (!permiso) {
            throw new ReglaNegocioError("La solicitud no tiene un permiso de contacto habilitado para revocar.");
        }

        // 3. Regla de negocio pura del dominio (RF-08.8)
        permiso.revocar(comando.adminUsuarioId);

        const guardado = await this.permisoRepository.guardar(permiso);

        return aPermisoContactoVista(guardado, contexto);
    }
}
