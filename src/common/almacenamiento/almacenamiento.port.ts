export interface ArchivoParaGuardar {
    nombreOriginal: string;
    // Tipo detectado por el contenido del archivo, no el que declara el cliente
    tipoMime: string;
    contenido: Buffer;
}

export interface IAlmacenamientoArchivos {
    // Archivos públicos (fotos del catálogo): se sirven por URL sin autenticación
    guardarPublico(carpeta: string, archivo: ArchivoParaGuardar): Promise<string>;
    eliminarPublico(url: string): Promise<void>;

    // Archivos privados (acreditaciones): solo se leen a través de un endpoint protegido
    guardarPrivado(carpeta: string, archivo: ArchivoParaGuardar): Promise<string>;
    leerPrivado(ruta: string): Promise<Buffer>;
    eliminarPrivado(ruta: string): Promise<void>;
}

// Token de inyección PARA dependencias de NestJS
export const ALMACENAMIENTO_ARCHIVOS = "ALMACENAMIENTO_ARCHIVOS";
