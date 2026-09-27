// RF-04.6: documento (imagen o PDF) que el agrónomo adjunta a su resolución.
// El archivo vive en el almacenamiento privado; aquí solo queda su ruta y sus datos.
export const MAX_ANEXOS_RESOLUCION = 5;

export class AnexoResolucion {
    constructor(
        public readonly id: string,
        public readonly solicitudId: string,
        public readonly ruta: string,
        public readonly nombreOriginal: string,
        public readonly tipoMime: string,
        public readonly tamanoBytes: number,
        public readonly fechaSubida: Date,
    ) {}
}
