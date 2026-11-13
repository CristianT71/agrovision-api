import { ArgumentsHost, Catch, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import { ReglaZonaError, type CodigoErrorReglaZona } from "../../../../domain/errors/reglas-zona.error";

const ESTADO_POR_CODIGO: Record<CodigoErrorReglaZona, number> = {
    REGLA_NO_ENCONTRADA: 404,
    REGLA_INVALIDA: 422,
    REGLA_INMUTABLE: 409,
    SIN_PERMISO_APROBAR: 403,
    REGLA_NO_APROBADA: 409,
    TRANSICION_INVALIDA: 409,
    VERSION_EN_CONFLICTO: 409,
};

// Solo traduce los errores de dominio de este módulo; el resto sigue al filtro global.
// Mismo formato de cuerpo que el filtro global, más el código estable y el detalle de validación.
@Catch(ReglaZonaError)
export class ReglasZonaExceptionFilter implements ExceptionFilter {
    catch(error: ReglaZonaError, host: ArgumentsHost) {
        const req = host.switchToHttp().getRequest<Request>(),
            res = host.switchToHttp().getResponse<Response>();
        const status = ESTADO_POR_CODIGO[error.codigo];
        res.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: req.url,
            metodo: req.method,
            mensaje: error.message,
            codigo: error.codigo,
            ...(error.detalles.length > 0 ? { detalles: error.detalles } : {}),
        });
    }
}
