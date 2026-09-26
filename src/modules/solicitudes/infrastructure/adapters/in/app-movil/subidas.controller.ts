import { Controller, HttpCode, HttpStatus, Param, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { SubirFotoSolicitudService } from "../../../../application/use-cases/subir-foto-solicitud.service";

// Destino de las URLs firmadas que recibe la app en imageUploads.
// Sin JwtAuthGuard a propósito: el token de la URL es la autorización y vence en una hora.
// El cuerpo binario lo interpreta express.raw, registrado solo para esta ruta en el módulo.
@Controller("v1/uploads")
export class SubidasController {
    constructor(private readonly subirFotoService: SubirFotoSolicitudService) {}

    @Put(":token")
    @HttpCode(HttpStatus.NO_CONTENT)
    async subir(@Param("token") token: string, @Req() request: Request): Promise<void> {
        // Si no llega como image/* express.raw no lo lee y el cuerpo no es un Buffer: se pasa
        // vacío para que el caso de uso revise primero el token (403) y luego el archivo (400)
        const cuerpo = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);

        await this.subirFotoService.ejecutar({
            token,
            archivo: {
                originalname: "foto",
                mimetype: request.headers["content-type"] ?? "",
                size: cuerpo.length,
                buffer: cuerpo,
            },
        });
    }
}
