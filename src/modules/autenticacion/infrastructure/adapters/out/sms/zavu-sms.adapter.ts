import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ISmsService } from "../../../../domain/ports/out/sms.service";

interface ZavuPayload {
    to: string;
    text: string;
    channel: "sms" | "auto";
    messageType: "text";
}

@Injectable()
export class ZavuSmsAdapter implements ISmsService {
    private readonly logger = new Logger(ZavuSmsAdapter.name);

    constructor(private readonly configService: ConfigService) {}

    async enviarOtp(telefono: string, codigo: string): Promise<boolean> {
        const url = this.configService.get<string>("ZAVU_API_URL") ?? "https://api.zavu.dev/v1/messages";
        const apiKey = this.configService.get<string>("ZAVU_API_KEY");
        const senderId = this.configService.get<string>("ZAVU_SENDER_ID");

        if (!apiKey) {
            this.logger.error("ZAVU_API_KEY no está configurada en las variables de entorno");
            throw new InternalServerErrorException("Error de configuración en el proveedor SMS.");
        }

        const payload: ZavuPayload = {
            to: telefono,
            text: `Tu código de verificación AgroVision es: ${codigo}. Válido por 5 minutos.`,
            channel: "auto",
            messageType: "text",
        };

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        };

        if (senderId) {
            headers["Zavu-Sender"] = senderId;
        }

        try {
            const response = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Error Zavu SMS [HTTP ${response.status}]: ${errorText}`);
                throw new InternalServerErrorException("No se pudo entregar el mensaje SMS.");
            }

            this.logger.log(`SMS OTP despachado vía Zavu hacia ${telefono}`);
            return true;
        } catch (error) {
            if (error instanceof InternalServerErrorException) {
                throw error;
            }
            this.logger.error("Fallo en la conexión de red con Zavu API", error);
            throw new InternalServerErrorException("Error de comunicación con el servicio SMS.");
        }
    }
}
