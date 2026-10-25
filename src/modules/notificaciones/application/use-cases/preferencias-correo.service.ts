import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
    PREFERENCIAS_CORREO,
    type IPreferenciasCorreo,
    type PreferenciaCorreo,
} from "../../domain/ports/out/preferencias-correo.port";

@Injectable()
export class PreferenciasCorreoService {
    constructor(@Inject(PREFERENCIAS_CORREO) private readonly preferencias: IPreferenciasCorreo) {}

    async obtener(usuarioId: string): Promise<PreferenciaCorreo> {
        return await this.preferencias.obtener(usuarioId);
    }

    async guardar(usuarioId: string, activo: boolean, correo: string | null): Promise<PreferenciaCorreo> {
        const limpio = correo?.trim().toLowerCase() || null;
        // Sin dirección no hay a dónde enviar: se rechaza en vez de dejar un aviso que nunca sale
        if (activo && !limpio) {
            throw new BadRequestException("Indica el correo al que quieres recibir las notificaciones.");
        }
        const preferencia = { activo, correo: limpio };
        await this.preferencias.guardar(usuarioId, preferencia);
        return preferencia;
    }
}
