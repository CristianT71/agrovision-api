// RF-09.1: penetración instalada de cada versión. Se mide con la versión de la última detección de
// cada productor activo en la ventana: la app no reporta qué modelo tiene instalado, pero cada
// captura dice con qué versión se hizo.
export interface AdopcionModelo {
    porcentaje: number;
    productores: number;
}

export interface IConsultaAdopcion {
    // Clave: id del modelo. Los productores con versiones fuera del inventario cuentan en el total.
    adopcionPorModelo(desde: Date): Promise<Map<string, AdopcionModelo>>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_ADOPCION = "CONSULTA_ADOPCION";
