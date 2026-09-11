export class SesionOtp {
    constructor(
        public readonly id: string,
        public readonly usuarioId: string,
        public readonly codigo: string,
        public readonly expiraEn: Date,
        public usado: boolean,
        public readonly creadoEn: Date,
    ) {}

    // Regla RF-01.5: Validar si pasaron al menos 30 segundos para solicitar otro OTP
    public puedeSolicitarNuevoOtp(segundosEspera = 30): boolean {
        const ahora = new Date().getTime();
        const tiempoCreacion = this.creadoEn.getTime();
        const diferenciaSegundos = (ahora - tiempoCreacion) / 1000;

        return diferenciaSegundos >= segundosEspera;
    }

    // Regla RF-01.4: Validar código de 6 dígitos y expiración
    public esValido(codigoIngresado: string): boolean {
        if (this.usado) return false;

        const ahora = new Date();
        if (ahora > this.expiraEn) return false;

        return this.codigo === codigoIngresado;
    }

    public marcarComoUsado(): void {
        this.usado = true;
    }
}
