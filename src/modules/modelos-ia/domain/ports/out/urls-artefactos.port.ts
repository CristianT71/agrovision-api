import type { Artefacto } from "../in/manifiesto-modelos.port";

// URL absoluta con la que la app descarga cada artefacto. Depende de dónde está publicada la API
// (API_PUBLIC_URL), que es un dato de infraestructura y no del dominio.
export interface IUrlsArtefactos {
    urlDe(version: string, artefacto: Artefacto): string;
}

// Token de inyección PARA dependencias de NestJS
export const URLS_ARTEFACTOS = "URLS_ARTEFACTOS";
