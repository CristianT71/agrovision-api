import { Inject, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmModeloIaEntity } from "../modelos-ia/infrastructure/adapters/out/persistence/typeorm-modelo-ia.entity";
import { TypeOrmSolicitudEntity } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.entity";
import { TypeOrmFotoSolicitudEntity } from "./infrastructure/adapters/out/persistence/typeorm-foto-solicitud.entity";
import { TypeOrmAuditoriaUbicacionEntity } from "./infrastructure/adapters/out/persistence/typeorm-auditoria-ubicacion.entity";
import { TypeOrmAuditoriaUbicacionesAdapter } from "./infrastructure/adapters/out/persistence/typeorm-auditoria-ubicaciones.adapter";
import { elevacionProvider } from "./infrastructure/adapters/out/elevacion/elevacion.provider";
import { AUDITORIA_UBICACIONES } from "./domain/ports/out/auditoria-ubicaciones.port";
import { ObtenerUbicacionSolicitudService } from "./application/use-cases/obtener-ubicacion-solicitud.service";
import { ListarMapaSolicitudesService } from "./application/use-cases/listar-mapa-solicitudes.service";
import { TypeOrmAnexoResolucionEntity } from "./infrastructure/adapters/out/persistence/typeorm-anexo-resolucion.entity";
import { TypeOrmDeteccionEntity } from "../detecciones/infrastructure/adapters/out/persistence/typeorm-deteccion.entity";
import { TypeOrmSolicitudRepository } from "./infrastructure/adapters/out/persistence/typeorm-solicitud.repository";
import { TypeOrmSolicitudAppRepository } from "./infrastructure/adapters/out/persistence/typeorm-solicitud-app.repository";
import { TypeOrmLecturaSolicitudesAdapter } from "./infrastructure/adapters/out/persistence/typeorm-lectura-solicitudes.adapter";
import { SolicitudesController } from "./infrastructure/adapters/in/http/solicitudes.controller";
import { AppSolicitudesController } from "./infrastructure/adapters/in/app-movil/app-solicitudes.controller";
import { SubidasController } from "./infrastructure/adapters/in/app-movil/subidas.controller";
import { crearLectorFotoBinaria } from "./infrastructure/adapters/in/app-movil/leer-foto-binaria.middleware";
import { NotificacionesSolicitudesAdapter } from "./infrastructure/adapters/out/notificaciones/notificaciones.adapter";
import { HmacFirmadorUrlsSubidaAdapter } from "./infrastructure/adapters/out/firmador/hmac-firmador-urls-subida.adapter";

import { SOLICITUD_REPOSITORY } from "./domain/ports/out/solicitud.repository";
import { SOLICITUD_APP_REPOSITORY } from "./domain/ports/out/solicitud-app.repository";
import { LECTURA_SOLICITUDES } from "./domain/ports/out/lectura-solicitudes.port";
import { NOTIFICADOR_SOLICITUDES } from "./domain/ports/out/notificador-solicitudes.port";
import { CAPTURA_MODELO_REPOSITORY } from "./domain/ports/out/captura-modelo.repository";
import { FIRMADOR_URLS_SUBIDA, type IFirmadorUrlsSubida } from "./domain/ports/out/firmador-urls-subida.port";
import { AgronomosModule } from "../agronomos/agronomos.module";
import { NotificacionesModule } from "../notificaciones/notificaciones.module";
import { ProductoresModule } from "../productores/productores.module";
import { AlmacenamientoModule } from "../../common/almacenamiento/almacenamiento.module";

// Casos de uso
import { ResolverSolicitudService } from "./application/use-cases/resolver-solicitud.service";
import { ListarSolicitudesService } from "./application/use-cases/listar-solicitudes.service";
import { ObtenerSolicitudPorIdService } from "./application/use-cases/obtener-solicitud-por-id.service";
import { AsignarSolicitudService } from "./application/use-cases/asignar-solicitud.service";
import { RecibirLoteSolicitudesService } from "./application/use-cases/recibir-lote-solicitudes.service";
import { SubirFotoSolicitudService } from "./application/use-cases/subir-foto-solicitud.service";
import { ListarMisSolicitudesService } from "./application/use-cases/listar-mis-solicitudes.service";
import { ListarFotosSolicitudService } from "./application/use-cases/listar-fotos-solicitud.service";
import { DescargarFotoSolicitudService } from "./application/use-cases/descargar-foto-solicitud.service";
import { AnexosResolucionService } from "./application/use-cases/anexos-resolucion.service";
import { CasosSimilaresService } from "./application/use-cases/casos-similares.service";
import { VerificarAccesoSolicitudService } from "./application/use-cases/verificar-acceso-solicitud.service";
import { ContarSolicitudesService } from "./application/use-cases/contar-solicitudes.service";
import { ResumirResolucionesService } from "./application/use-cases/resumir-resoluciones.service";
import { TypeOrmCapturaModeloRepository } from "./infrastructure/adapters/out/persistence/typeorm-captura-modelo.repository";

@Module({
    // Se necesita el agrónomo del usuario autenticado para resolver y filtrar (RF-03.3)
    // y avisarle cuando se le asigna un caso (RF-02.5).
    // La app móvil necesita el productor del token, el almacenamiento privado para sus fotos
    // y el secreto con el que se firman las URLs de subida
    imports: [
        TypeOrmModule.forFeature([
            TypeOrmModeloIaEntity,
            TypeOrmSolicitudEntity,
            TypeOrmFotoSolicitudEntity,
            TypeOrmAnexoResolucionEntity,
            TypeOrmAuditoriaUbicacionEntity,
            TypeOrmDeteccionEntity,
        ]),
        AgronomosModule,
        NotificacionesModule,
        ProductoresModule,
        AlmacenamientoModule,
        ConfigModule,
    ],
    controllers: [SolicitudesController, AppSolicitudesController, SubidasController],
    providers: [
        ResolverSolicitudService,
        ListarSolicitudesService,
        ObtenerSolicitudPorIdService,
        AsignarSolicitudService,
        RecibirLoteSolicitudesService,
        SubirFotoSolicitudService,
        ListarMisSolicitudesService,
        ListarFotosSolicitudService,
        DescargarFotoSolicitudService,
        AnexosResolucionService,
        CasosSimilaresService,
        VerificarAccesoSolicitudService,
        ContarSolicitudesService,
        ResumirResolucionesService,
        ObtenerUbicacionSolicitudService,
        ListarMapaSolicitudesService,
        elevacionProvider,
        {
            provide: AUDITORIA_UBICACIONES,
            useClass: TypeOrmAuditoriaUbicacionesAdapter,
        },
        {
            provide: SOLICITUD_REPOSITORY,
            useClass: TypeOrmSolicitudRepository,
        },
        {
            provide: LECTURA_SOLICITUDES,
            useClass: TypeOrmLecturaSolicitudesAdapter,
        },
        {
            provide: SOLICITUD_APP_REPOSITORY,
            useClass: TypeOrmSolicitudAppRepository,
        },
        {
            provide: NOTIFICADOR_SOLICITUDES,
            useClass: NotificacionesSolicitudesAdapter,
        },
        {
            provide: CAPTURA_MODELO_REPOSITORY,
            useClass: TypeOrmCapturaModeloRepository,
        },
        {
            provide: FIRMADOR_URLS_SUBIDA,
            useClass: HmacFirmadorUrlsSubidaAdapter,
        },
    ],
    exports: [ResolverSolicitudService, ListarSolicitudesService, ObtenerSolicitudPorIdService],
})
export class SolicitudesModule implements NestModule {
    constructor(
        @Inject(FIRMADOR_URLS_SUBIDA)
        private readonly firmador: IFirmadorUrlsSubida,
    ) {}

    // La subida de fotos llega como binario (image/jpeg) con express.raw: solo esa ruta lo
    // acepta, con el mismo límite de 10 MB del caso de uso. El resto de la API sigue en JSON.
    configure(consumer: MiddlewareConsumer): void {
        // Se verifica el token de la URL antes de leer el cuerpo: así un token inventado no cuesta memoria
        consumer
            .apply(crearLectorFotoBinaria((token) => this.firmador.verificar(token) !== null))
            .forRoutes(SubidasController);
    }
}
