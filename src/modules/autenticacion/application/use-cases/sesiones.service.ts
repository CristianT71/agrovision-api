import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
    SESION_USUARIO_REPOSITORY,
    type ISesionUsuarioRepository,
} from "../../domain/ports/out/sesion-usuario.repository";
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
    ) {}

    // La usa la estrategia JWT en cada petición autenticada (RNF-02.2)
    async verificar(sesionId: string | undefined): Promise<void> {
        const sesion = sesionId ? await this.sesionRepository.findById(sesionId) : null;
        if (!sesion) {
            throw new UnauthorizedException(MENSAJES.desconocida);
        }

        const ahora = new Date();
        const motivo = sesion.motivoInvalida(ahora);
        if (motivo) {
            throw new UnauthorizedException(MENSAJES[motivo]);
        }

        if (sesion.necesitaRegistrarActividad(ahora)) {
            await this.sesionRepository.registrarActividad(sesion.id, ahora);
        }
    }

    // RF-01.8: invalida el token en el servidor al cerrar sesión
    async cerrar(sesionId: string): Promise<void> {
        await this.sesionRepository.revocar(sesionId, new Date());
    }
}
