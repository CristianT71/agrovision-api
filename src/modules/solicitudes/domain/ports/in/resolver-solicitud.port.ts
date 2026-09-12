export interface ResolverSolicitudCommand {
  solicitudId: string;
  respuestaProfesional: string;
  tipoResultado: string;
}

export interface IResolverSolicitudUseCase {
  ejecutar(comando: ResolverSolicitudCommand): Promise<void>;
}