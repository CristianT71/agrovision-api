import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import type { IEnviadorCorreo } from "../../../../domain/ports/out/enviador-correo.port";

// Gmail por defecto: smtp.gmail.com:465 con una contraseña de aplicación (no la de la cuenta)
export class SmtpCorreoAdapter implements IEnviadorCorreo {
    private readonly transporte: Transporter;
    private readonly remitente: string;

    constructor(config: ConfigService) {
        const usuario = config.getOrThrow<string>("MAIL_USER");
        this.remitente = config.get<string>("MAIL_FROM") || `AgroVision <${usuario}>`;
        this.transporte = createTransport({
            host: config.get<string>("MAIL_HOST") || "smtp.gmail.com",
            port: Number(config.get<string>("MAIL_PORT") || 465),
            secure: (config.get<string>("MAIL_SECURE") ?? "true") !== "false",
            auth: { user: usuario, pass: config.getOrThrow<string>("MAIL_PASSWORD") },
        });
    }

    async enviar(destino: string, asunto: string, texto: string): Promise<void> {
        await this.transporte.sendMail({ from: this.remitente, to: destino, subject: asunto, text: texto });
    }
}
