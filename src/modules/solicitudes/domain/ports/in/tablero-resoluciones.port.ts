// RF-06.6, RF-06.7: un caso de "Plaga nueva" tal como lo revisa el administrador
export interface CasoPlagaNueva {
    id: string;
    plagaIdentificada: string | null;
    fechaResolucion: Date | null;
    productorNombre: string | null;
    finca: string;
    vereda: string;
    municipio: string;
    respuestaProfesional: string | null;
}

// RF-06.5 a RF-06.7: resoluciones y plagas nuevas para el tablero del administrador
export interface ResumenResoluciones {
    desde: Date;
    hasta: Date;
    // Solicitudes "Resuelta" con fecha de resolución en la ventana
    total: number;
    porTipo: { tipo: string; casos: number }[];
    plagasNuevas: {
        umbral: number;
        // Siempre los últimos 7 días, sin importar la ventana pedida
        casosUltimaSemana: number;
        alertaActiva: boolean;
        // Por día en hora de Colombia, solo los días con casos
        serie: { dia: string; casos: number }[];
        casos: CasoPlagaNueva[];
    };
}

export interface IResumirResolucionesUseCase {
    ejecutar(
        usuario: { id: string; rol: string },
        consulta: { desde?: Date; hasta?: Date },
    ): Promise<ResumenResoluciones>;
}
