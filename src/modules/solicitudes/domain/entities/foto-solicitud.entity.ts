import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Ángulos con los que la app toma cada foto; pueden repetirse en una misma solicitud
export const ANGULOS_FOTO = ["GENERAL", "HAZ", "ENVES", "DETALLE"] as const;
export type AnguloFoto = (typeof ANGULOS_FOTO)[number];

export class FotoSolicitud {
    constructor(
        public readonly id: string,
        public readonly solicitudId: string,
        // Id que generó la app: con él sabe a qué foto corresponde cada URL de subida
        public readonly idCliente: string,
        public readonly angulo: AnguloFoto,
        public readonly orden: number,
        // Ruta en el almacenamiento privado: nula hasta que la app sube el archivo
        public ruta: string | null = null,
        public tipoMime: string | null = null,
        public tamanoBytes: number | null = null,
        public subidaEn: Date | null = null,
    ) {}

    public estaSubida(): boolean {
        return this.ruta !== null;
    }

    public marcarSubida(ruta: string, tipoMime: string, tamanoBytes: number): void {
        if (this.estaSubida()) {
            throw new ReglaNegocioError("La foto ya fue subida.");
        }

        this.ruta = ruta;
        this.tipoMime = tipoMime;
        this.tamanoBytes = tamanoBytes;
        this.subidaEn = new Date();
    }
}
