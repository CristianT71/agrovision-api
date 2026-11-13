import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import {
    ArchivoVueloNoEncontradoError,
    FormatoVueloError,
    TokenMedioError,
    VueloNoEncontradoError,
} from "../../../../domain/errors/vuelos.error";
import { ReglaNegocioError } from "../../../../../../common/errors/regla-negocio.error";

@Catch()
export class VuelosExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(VuelosExceptionFilter.name);
    catch(error: unknown, host: ArgumentsHost) {
        const req = host.switchToHttp().getRequest<Request>(),
            res = host.switchToHttp().getResponse<Response>();
        let status = 500,
            mensaje: string | string[] = "Error interno del servidor";
        if (error instanceof HttpException) {
            status = error.getStatus();
            const cuerpo = error.getResponse();
            mensaje = typeof cuerpo === "string" ? cuerpo : (cuerpo as { message: string | string[] }).message;
            // El ValidationPipe global usa 400; este contrato pide 422 para DTOs inválidos.
            if (status === 400 && Array.isArray(mensaje)) status = 422;
        } else if (error instanceof FormatoVueloError) {
            status = error.estado;
            mensaje = error.message;
        } else if (error instanceof TokenMedioError) {
            status = error.vencido ? 410 : 403;
            mensaje = error.message;
        } else if (error instanceof VueloNoEncontradoError || error instanceof ArchivoVueloNoEncontradoError) {
            status = 404;
            mensaje = error.message;
        } else if (error instanceof ReglaNegocioError) {
            status = 409;
            mensaje = error.message;
        }
        // No registra tokens, coordenadas, nombres del cliente ni rutas internas, ni siquiera al fallar un stream.
        if (status >= 500) this.logger.error("Falló una operación de vuelos.");
        const path = req.originalUrl.includes("/vuelos/medios/") ? "/api/vuelos/medios/[token]" : req.path;
        res.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path,
            metodo: req.method,
            mensaje,
        });
    }
}
