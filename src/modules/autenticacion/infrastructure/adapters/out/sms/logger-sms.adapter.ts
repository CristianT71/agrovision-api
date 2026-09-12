import { Injectable, Logger } from "@nestjs/common";
import type { ISmsService } from "../../../../domain/ports/out/sms.service";

@Injectable()
export class LoggerSmsAdapter implements ISmsService {
    private readonly logger = new Logger(LoggerSmsAdapter.name);

    enviarOtp(telefono: string, codigo: string): Promise<boolean> {
        this.logger.log(`[SMS DEV] Código OTP generado para ${telefono}: ${codigo}`);
        return Promise.resolve(true);
    }
}
