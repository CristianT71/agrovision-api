// Datos de contacto del productor: solo salen de la API cuando el permiso lo autoriza (RF-04.10)
export interface ContactoProductor {
    nombre: string;
    telefono: string;
}

export interface IConsultaProductores {
    obtenerContacto(productorId: string): Promise<ContactoProductor | null>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_PRODUCTORES = "CONSULTA_PRODUCTORES";
