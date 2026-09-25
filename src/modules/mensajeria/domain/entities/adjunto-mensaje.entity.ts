export type TipoAdjunto = "imagen" | "documento";

// Archivo que acompaña a un mensaje del canal de coordinación (RF-08.5).
// El archivo vive en almacenamiento PRIVADO: `ruta` nunca se expone en la API,
// la descarga pasa siempre por el endpoint protegido.
export class AdjuntoMensaje {
    constructor(
        public readonly id: string,
        public readonly mensajeId: string,
        public readonly ruta: string,
        public readonly nombreArchivo: string,
        public readonly tipoMime: string,
        public readonly tamanoBytes: number,
        public readonly tipo: TipoAdjunto,
    ) {}

    public static tipoDesdeMime(tipoMime: string): TipoAdjunto {
        return tipoMime.startsWith("image/") ? "imagen" : "documento";
    }
}
