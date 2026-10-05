import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
    IRevocarPermisoContactoUseCase,
    PermisoContactoVista,
} from "../../domain/ports/in/gestionar-permisos-contacto.port";
import {
    PERMISO_CONTACTO_REPOSITORY,
    type IPermisoContactoRepository,
} from "../../domain/ports/out/permiso-contacto.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import { NOTIFICADOR_PERMISOS, type INotificadorPermisos } from "../../domain/ports/out/notificador-permisos.port";
import type { PermisoContacto } from "../../domain/entities/permiso-contacto.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";
import { obtenerContexto } from "./resolver-acceso";
import { aPermisoContactoVista } from "./permiso-contacto-vista";

@Injectable()
export class RevocarPermisoContactoService implements IRevocarPermisoContactoUseCase {
    private readonly logger = new Logger(RevocarPermisoContactoService.name);

    constructor(
        @Inject(PERMISO_CONTACTO_REPOSITORY)
        private readonly permisoRepository: IPermisoContactoRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
        @Inject(CONSULTA_AGRONOMOS)
        private readonly consultaAgronomos: IConsultaAgronomos,
        @Inject(NOTIFICADOR_PERMISOS)
        private readonly notificador: INotificadorPermisos,
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

        // 4. Avisar al agrónomo que tenía el permiso; si el aviso falla, la revocación no se deshace
        await this.notificar(guardado);

        return aPermisoContactoVista(guardado, contexto);
    }

    private async notificar(permiso: PermisoContacto): Promise<void> {
        try {
            const agronomoUsuarioId = permiso.agronomoId
                ? await this.consultaAgronomos.obtenerUsuarioIdPorAgronomo(permiso.agronomoId)
                : null;
            if (!agronomoUsuarioId) return;

            await this.notificador.notificarPermisoRevocado({ solicitudId: permiso.solicitudId, agronomoUsuarioId });
        } catch (error) {
            this.logger.warn(
                `No se pudo notificar la revocación del contacto de la solicitud ${permiso.solicitudId}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
