// Versión vigente de la Política de Tratamiento de Datos Personales del SENA (responsable del
// tratamiento). Súbela cada vez que cambie el texto o la finalidad: así la app vuelve a pedir la
// aceptación. Debe coincidir con la versión del texto que publica la app móvil.
export const VERSION_POLITICA_DATOS = "1.0";

export interface EstadoPoliticaDatos {
    versionVigente: string;
    versionAceptada: string | null;
    fechaAceptacion: Date | null;
    // true solo si aceptó exactamente la versión vigente
    aceptada: boolean;
}
