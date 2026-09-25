// Soporte documental entregado en el alta del agrónomo (RF-10.4): tarjeta profesional,
// diplomas, etc. El archivo se guarda en almacenamiento privado y aquí solo queda su ruta.
export class DocumentoAcreditacion {
    constructor(
        public readonly id: string,
        public readonly agronomoId: string,
        public readonly ruta: string,
        public readonly nombreOriginal: string,
        public readonly tipoMime: string,
        public readonly tamanoBytes: number,
        public readonly fechaSubida: Date,
    ) {}
}
