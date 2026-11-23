import { Injectable } from "@nestjs/common";
import type { ISmsService } from "../../../../domain/ports/out/sms.service";

// Con códigos fijos no se envía nada (no cuesta) y el código no se escribe en ningún log
@Injectable()
export class FijoSmsAdapter implements ISmsService {
    enviarOtp(): Promise<boolean> {
        return Promise.resolve(true);
    }
}
