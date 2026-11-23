import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import type { ErrorResponse } from "../http-exception-response.interface";
import { ReglaNegocioError } from "../errors/regla-negocio.error";

export const MENSAJE_ERROR_INTERNO = "Error interno del servidor";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : exception instanceof ReglaNegocioError
                  ? HttpStatus.CONFLICT
                  : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

        // Por defecto el cliente solo ve un mensaje genérico. Los mensajes que escribimos a propósito
        // (HttpException y ReglaNegocioError) sí se entregan; el de un error inesperado (una consulta SQL
        // que falla, una librería) trae nombres de tablas, restricciones o rutas internas y se queda en el log.
        let mensaje: string | string[] = MENSAJE_ERROR_INTERNO;

        if (exception instanceof ReglaNegocioError) {
            mensaje = exception.message;
        } else if (typeof exceptionResponse === "string") {
            mensaje = exceptionResponse;
        } else if (
            typeof exceptionResponse === "object" &&
            exceptionResponse !== null &&
            "message" in exceptionResponse
        ) {
            mensaje = (exceptionResponse as { message: string | string[] }).message;
        }

        const cuerpoError: ErrorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            metodo: request.method,
            mensaje,
        };

        if (
            exception instanceof Error &&
            !(exception instanceof HttpException) &&
            !(exception instanceof ReglaNegocioError)
        ) {
            // El detalle real, con su traza, solo para quien administra el servidor
            this.logger.error(`${request.method} ${request.url} [${status}] - ${exception.message}`, exception.stack);
        } else {
            this.logger.error(`${request.method} ${request.url} [${status}] - ${JSON.stringify(mensaje)}`);
        }

        response.status(status).json(cuerpoError);
    }
}
