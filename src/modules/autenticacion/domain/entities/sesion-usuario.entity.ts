import type { RolUsuario } from "./usuario.entity";

// RNF-02.2: el panel cierra la sesión tras 30 minutos sin actividad. La app móvil del productor
// trabaja en campo y a veces sin señal: su sesión dura 30 días para no pedirle el código a diario.
const MINUTOS_INACTIVIDAD: Record<RolUsuario, number> = {
    admin: 30,
    agronomo: 30,
    productor: 30 * 24 * 60,
};

// Duración máxima del token aunque haya actividad: obliga a iniciar sesión de nuevo cada cierto tiempo
const HORAS_MAXIMAS: Record<RolUsuario, number> = {
    admin: 12,
    agronomo: 12,
    productor: 30 * 24,
};

export type MotivoSesionInvalida = "cerrada" | "inactividad" | "vencida";

// Sesión de login guardada en el servidor. Su id viaja en el token (jti): así la API puede
// cerrarla por inactividad o al cerrar sesión, aunque el token siga siendo válido en su firma.
export class SesionUsuario {
    constructor(
        public readonly id: string,
        public readonly usuarioId: string,
        public readonly rol: RolUsuario,
        public readonly creadaEn: Date,
        public readonly expiraEn: Date,
        public ultimaActividad: Date,
        public revocadaEn: Date | null = null,
    ) {}

    public static iniciar(datos: { id: string; usuarioId: string; rol: RolUsuario }): SesionUsuario {
        const ahora = new Date();
        const expiraEn = new Date(ahora.getTime() + HORAS_MAXIMAS[datos.rol] * 60 * 60 * 1000);

        return new SesionUsuario(datos.id, datos.usuarioId, datos.rol, ahora, expiraEn, ahora);
    }

    // Segundos de vida del token: coinciden con el vencimiento de la sesión
    public segundosDeVida(): number {
        return Math.round((this.expiraEn.getTime() - this.creadaEn.getTime()) / 1000);
    }

    // Devuelve por qué la sesión ya no sirve, o null si sigue vigente
    public motivoInvalida(ahora = new Date()): MotivoSesionInvalida | null {
        if (this.revocadaEn) return "cerrada";
        if (ahora >= this.expiraEn) return "vencida";

        const inactivoMs = ahora.getTime() - this.ultimaActividad.getTime();
        if (inactivoMs > MINUTOS_INACTIVIDAD[this.rol] * 60 * 1000) return "inactividad";

        return null;
    }

    // Guardar la actividad en cada petición llenaría la base de escrituras: basta cada minuto
    public necesitaRegistrarActividad(ahora = new Date()): boolean {
        return ahora.getTime() - this.ultimaActividad.getTime() >= 60 * 1000;
    }

    public revocar(ahora = new Date()): void {
        if (!this.revocadaEn) this.revocadaEn = ahora;
    }
}
