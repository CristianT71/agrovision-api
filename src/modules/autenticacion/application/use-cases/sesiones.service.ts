import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
    SESION_USUARIO_REPOSITORY,
    type ISesionUsuarioRepository,
} from "../../domain/ports/out/sesion-usuario.repository";
import { POLITICA_SESION, type IPoliticaSesion } from "../../domain/ports/out/politica-sesion.port";
import type { MotivoSesionInvalida } from "../../domain/entities/sesion-usuario.entity";

const MENSAJES: Record<MotivoSesionInvalida | "desconocida", string> = {
    cerrada: "La sesión fue cerrada. Inicia sesión de nuevo.",
    inactividad: "Tu sesión expiró por inactividad. Inicia sesión de nuevo.",
    vencida: "Tu sesión expiró. Inicia sesión de nuevo.",
    desconocida: "La sesión no es válida. Inicia sesión de nuevo.",
};

@Injectable()
export class SesionesService {
    constructor(
        @Inject(SESION_USUARIO_REPOSITORY)
        private readonly sesionRepository: ISesionUsuarioRepository,
        @Inject(POLITICA_SESION)
        private readonly politicaSesion: IPoliticaSesion,
    ) {}

    // La usa la estrategia JWT en cada petición autenticada (RNF-02.2).
    // Una petición de sondeo (el panel consulta solo, sin que el usuario haga nada) se valida igual,
    // pero no cuenta como actividad: si no, una pestaña abierta y desatendida nunca caducaría.
    async verificar(sesionId: string | undefined, { esSondeo = false }: { esSondeo?: boolean } = {}): Promise<void> {
        const sesion = sesionId ? await this.sesionRepository.findById(sesionId) : null;
        if (!sesion) {
            throw new UnauthorizedException(MENSAJES.desconocida);
        }

        const ahora = new Date();
        // El tiempo de inactividad del panel lo fija el administrador; el productor no lo usa, así que no se consulta
        const minutosPanel =
            sesion.rol === "productor" ? undefined : await this.politicaSesion.minutosInactividadPanel();
        const motivo = sesion.motivoInvalida(ahora, minutosPanel);
        if (motivo) {
            throw new UnauthorizedException(MENSAJES[motivo]);
        }

        if (!esSondeo && sesion.necesitaRegistrarActividad(ahora)) {
            await this.sesionRepository.registrarActividad(sesion.id, ahora);
        }
    }

    // RF-01.8: invalida el token en el servidor al cerrar sesión
    async cerrar(sesionId: string): Promise<void> {
        await this.sesionRepository.revocar(sesionId, new Date());
    }
}
