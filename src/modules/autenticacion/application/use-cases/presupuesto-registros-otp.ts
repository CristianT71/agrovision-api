import { HttpException, HttpStatus } from "@nestjs/common";

const MS_VENTANA = 60 * 60 * 1000;
const PREFIJO_LOCAL = "+57"; // Colombia: el mercado real de la app

function leerEntero(valor: string | undefined, porDefecto: number): number {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : porDefecto;
}

// Tope GLOBAL de cuentas nuevas (y por tanto de SMS a números nunca vistos) por hora. Los límites por IP
// y por número no frenan a quien rota IP y recorre números distintos: eso cuesta dinero en SMS y llena
// la tabla de usuarios. Los números de fuera de Colombia tienen un cupo mucho menor.
// Vive en memoria: con varias instancias de la API cada una aplica su propio tope.
export class PresupuestoRegistrosOtp {
    private readonly registros: { instante: number; local: boolean }[] = [];

    constructor(
        private readonly maxPorHora = leerEntero(process.env.OTP_MAX_REGISTROS_HORA, 300),
        private readonly maxExtranjerosPorHora = leerEntero(process.env.OTP_MAX_REGISTROS_EXTRANJEROS_HORA, 30),
        private readonly ahora: () => number = Date.now,
    ) {}

    // Reserva un cupo para registrar este número o lanza 429 si ya se agotó
    consumir(telefono: string): void {
        const ahora = this.ahora();
        while (this.registros.length > 0 && ahora - this.registros[0].instante >= MS_VENTANA) {
            this.registros.shift();
        }

        const local = telefono.startsWith(PREFIJO_LOCAL);
        const extranjeros = this.registros.filter((registro) => !registro.local).length;

        if (this.registros.length >= this.maxPorHora || (!local && extranjeros >= this.maxExtranjerosPorHora)) {
            throw new HttpException(
                "Hay demasiados registros nuevos en este momento. Inténtalo de nuevo en un rato.",
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        this.registros.push({ instante: ahora, local });
    }
}
