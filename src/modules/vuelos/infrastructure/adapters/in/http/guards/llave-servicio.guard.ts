import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";

export const LLAVE_SERVICIO_MIN_CARACTERES = 32;

// Acceso de máquina a máquina, de solo lectura, para la automatización de n8n: no hay un usuario con
// sesión (el login es por OTP al celular y n8n no puede recibirlo). La llave viaja en la cabecera
// X-Api-Key y se compara en tiempo constante. Si N8N_API_KEY no está configurada o es demasiado corta,
// la ruta queda cerrada para todos.
@Injectable()
export class LlaveServicioGuard implements CanActivate {
    private readonly esperada: Buffer | null;

    constructor(config: ConfigService) {
        const llave = config.get<string>("N8N_API_KEY")?.trim();
        this.esperada = llave && llave.length >= LLAVE_SERVICIO_MIN_CARACTERES ? this.huella(llave) : null;
    }

    // Se comparan huellas SHA-256 (siempre del mismo largo) para poder usar timingSafeEqual
    private huella(valor: string): Buffer {
        return createHash("sha256").update(valor, "utf8").digest();
    }

    canActivate(contexto: ExecutionContext): boolean {
        const req = contexto.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
        const recibida = req.headers["x-api-key"];

        // Mismo mensaje para todos los fallos: no se revela si la llave existe o qué le falta
        if (!this.esperada || typeof recibida !== "string" || recibida === "") {
            throw new UnauthorizedException("Llave de servicio inválida.");
        }
        if (!timingSafeEqual(this.huella(recibida), this.esperada)) {
            throw new UnauthorizedException("Llave de servicio inválida.");
        }

        return true;
    }
}
