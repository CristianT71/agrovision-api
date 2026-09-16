export interface ErrorResponse {
    statusCode: number;
    timestamp: string;
    path: string;
    metodo: string;
    mensaje: string | string[];
}
