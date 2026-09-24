import { createHash, timingSafeEqual } from "node:crypto";

// Intentos fallidos permitidos antes de invalidar el código (evita adivinarlo por fuerza bruta)
export const MAX_INTENTOS_OTP = 5;

export class SesionOtp {
    constructor(
        public readonly id: string,
        public readonly usuarioId: string,
        // El código nunca se guarda en claro: solo su hash SHA-256
        public readonly codigoHash: string,
        public readonly expiraEn: Date,
        public usado: boolean,
        public readonly creadoEn: Date,
        public intentos: number,
    ) {}

    public static crear(datos: { id: string; usuarioId: string; codigo: string; minutosVigencia: number }): SesionOtp {
        const ahora = new Date();

        return new SesionOtp(
            datos.id,
            datos.usuarioId,
            SesionOtp.hashear(datos.codigo),
            new Date(ahora.getTime() + datos.minutosVigencia * 60 * 1000),
            false,
            ahora,
            0,
        );
    }

    public static hashear(codigo: string): string {
        return createHash("sha256").update(codigo).digest("hex");
    }

    // Regla RF-01.5: Validar si pasaron al menos 30 segundos para solicitar otro OTP
    public puedeSolicitarNuevoOtp(segundosEspera = 30): boolean {
        return this.segundosRestantesParaNuevoOtp(segundosEspera) === 0;
    }

    public segundosRestantesParaNuevoOtp(segundosEspera = 30): number {
        const transcurridos = (Date.now() - this.creadoEn.getTime()) / 1000;

        return Math.max(0, Math.ceil(segundosEspera - transcurridos));
    }

    // El código sigue disponible si no se usó, no expiró y no agotó los intentos
    public estaDisponible(): boolean {
        if (this.usado) return false;
        if (new Date() > this.expiraEn) return false;

        return this.intentos < MAX_INTENTOS_OTP;
    }

    // Regla RF-01.4: el código de 6 dígitos debe coincidir completo.
    // Se compara en tiempo constante para no filtrar información por tiempos de respuesta.
    public coincide(codigoIngresado: string): boolean {
        const esperado = Buffer.from(this.codigoHash, "hex");
        const recibido = Buffer.from(SesionOtp.hashear(codigoIngresado), "hex");

        return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
    }
}
