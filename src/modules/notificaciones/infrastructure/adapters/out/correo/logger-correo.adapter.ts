import { Logger } from "@nestjs/common";
import type { IEnviadorCorreo } from "../../../../domain/ports/out/enviador-correo.port";

// Desarrollo: no sale ningún correo, queda en la consola
export class LoggerCorreoAdapter implements IEnviadorCorreo {
    private readonly logger = new Logger(LoggerCorreoAdapter.name);

    enviar(destino: string, asunto: string): Promise<void> {
        this.logger.log(`[CORREO DEV] Para ${destino}: ${asunto}`);
        return Promise.resolve();
    }
}
