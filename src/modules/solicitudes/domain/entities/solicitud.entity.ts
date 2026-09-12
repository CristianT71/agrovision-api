export type EstadoSolicitud =
  | 'Pendiente'
  | 'Enviada'
  | 'Asignada'
  | 'Resuelta'
  | 'Descartada';

export class Solicitud {
  constructor(
    public readonly id: string,
    public readonly productorId: string,
    public agronomoId: string | null,
    public estado: EstadoSolicitud,
    public readonly fecha: Date,
    public readonly municipio: string,
    public readonly vereda: string,
    public readonly finca: string,
    public readonly confianzaIa: number,
    public readonly modeloVersionId: string,
    public respuestaProfesional?: string,
    public tipoResultado?: string,
  ) {}

  // Regla de Negocioo (RF-04.8): Consultar a estado Resuelta e impedir cambio futuros
  public resolver(respuesta: string, tipoResultado: string): void {
    if (this.estado === 'Resuelta') {
      throw new Error(
        'La solicitud ya se encuentra resuelta y es de solo lectura.',
      );
    }

    if (this.estado === 'Descartada') {
      throw new Error('No se puede resolver una solicitud descartada.');
    }

    this.respuestaProfesional = respuesta;
    this.tipoResultado = tipoResultado;
    this.estado = 'Resuelta';
  }

  // Regla de Negocio (RF-08-3): Delegar o asignar recurso profesional
  public asignarAgronomo(agronomoId: string): void {
    if (this.estado === 'Resuelta') {
      throw new Error(
        'No se puede reasignar una solicitud que ya fue resuelta.',
      );
    }

    this.agronomoId = agronomoId;
    this.estado = 'Asignada';
  }
}