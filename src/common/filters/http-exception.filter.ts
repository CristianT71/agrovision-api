import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import type { ErrorResponse } from "../http-exception-response.interface";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

        let mensaje: string | string[] = "Error interno del servidor";

        if (typeof exceptionResponse === "string") {
            mensaje = exceptionResponse;
        } else if (
            typeof exceptionResponse === "object" &&
            exceptionResponse !== null &&
            "message" in exceptionResponse
        ) {
            mensaje = (exceptionResponse as { message: string | string[] }).message;
        } else if (exception instanceof Error) {
            mensaje = exception.message;
        }

        const cuerpoError: ErrorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            metodo: request.method,
            mensaje,
        };

        this.logger.error(`${request.method} ${request.url} [${status}] - ${JSON.stringify(mensaje)}`);

        response.status(status).json(cuerpoError);
    }
}
