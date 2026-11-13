import type { Plaga } from "../../../../domain/entities/plaga.entity";
import { CLASES_CATALOGO } from "../../../../domain/catalogo-clases";

// Lo que la API pública del catálogo entrega de cada ficha. Es una lista blanca: lo que no está aquí
// no sale (ni los avales con el nombre del agrónomo, ni nada de solicitudes o productores).
export interface FichaPublica {
    id: string;
    clave: string;
    nombreComun: string;
    nombreCientifico: string | null;
    sinonimos: string[];
    tipo: string;
    cultivo: string;
    descripcion: string;
    sintomas: string;
    organosAfectados: string[];
    hospederos: string[];
    fotoUrl: string | null;
    // Si un agrónomo avaló la ficha. Sin aval, las medidas y el protocolo químico no se publican.
    avalada: boolean;
    medidasContencion: string | null;
    protocoloQuimico: string | null;
    // Clase del modelo de reconocimiento que corresponde a la ficha (null si el modelo no la reconoce)
    modelo: { clase: string; desdeVersion: string } | null;
}

// "Roya de Café" -> "Roya_de_Cafe": para las fichas que no están en el mapa de clases del modelo
export function claveDesdeNombre(nombre: string): string {
    return nombre
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// Las fotos se guardan como ruta relativa (/archivos/...): quien consume la API necesita la URL completa
function urlAbsoluta(ruta: string | null, base: string): string | null {
    if (!ruta) return null;
    if (/^https?:\/\//i.test(ruta)) return ruta;

    return `${base.replace(/\/+$/, "")}${ruta}`;
}

export function aFichaPublica(plaga: Plaga, urlBase: string): FichaPublica {
    const mapeada = CLASES_CATALOGO[plaga.id];
    const avalada = plaga.tieneAval();

    return {
        id: plaga.id,
        clave: mapeada?.clave ?? claveDesdeNombre(plaga.nombreComun),
        nombreComun: plaga.nombreComun,
        nombreCientifico: plaga.nombreCientifico,
        sinonimos: plaga.sinonimos,
        tipo: plaga.tipo,
        cultivo: plaga.cultivo,
        descripcion: plaga.descripcion,
        sintomas: plaga.sintomas,
        organosAfectados: plaga.organosAfectados,
        hospederos: plaga.hospederos,
        fotoUrl: urlAbsoluta(plaga.fotoUrl, urlBase),
        avalada,
        medidasContencion: avalada ? plaga.medidasContencion : null,
        protocoloQuimico: avalada ? plaga.protocoloQuimico : null,
        modelo:
            mapeada?.clase && mapeada.desdeVersion
                ? { clase: mapeada.clase, desdeVersion: mapeada.desdeVersion }
                : null,
    };
}
