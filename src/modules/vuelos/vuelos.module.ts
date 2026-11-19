import { CorrelacionAppService } from "./application/use-cases/correlacion-app.service";
import { LECTURA_CORRELACION_APP } from "./domain/ports/out/correlacion-app.port";
import { TypeOrmCorrelacionAppAdapter } from "./infrastructure/adapters/out/persistence/typeorm-correlacion-app.adapter";
import { CORRELACION_APP } from "./domain/ports/in/correlacion-app.port";
import { Module } from "@nestjs/common";
import { GESTION_VUELOS } from "./domain/ports/in/vuelos.port";
import { LEER_MEDIO_VUELO } from "./domain/ports/in/medios.port";
import { VUELOS_REPOSITORY } from "./domain/ports/out/vuelos.repository";
import { ALMACENAMIENTO_VUELOS } from "./domain/ports/out/almacenamiento-vuelos.port";
import { EXTRACTOR_METADATOS_VUELOS } from "./domain/ports/out/extractor-metadatos.port";
import { FIRMADOR_MEDIOS_VUELOS } from "./domain/ports/out/firmador-medios.port";
import { AUDITORIA_VUELOS } from "./domain/ports/out/auditoria-vuelos.port";
import { GestionVuelosService } from "./application/use-cases/gestion-vuelos.service";
import { LeerMedioVueloService } from "./application/use-cases/leer-medio-vuelo.service";
import { TypeOrmVuelosRepository } from "./infrastructure/adapters/out/persistence/typeorm-vuelos.repository";
import { TypeOrmAuditoriaVuelosAdapter } from "./infrastructure/adapters/out/persistence/typeorm-auditoria-vuelos.adapter";
import { LocalVuelosAdapter } from "./infrastructure/adapters/out/storage/local-vuelos.adapter";
import { ExifrMetadatosAdapter } from "./infrastructure/adapters/out/metadata/exifr-metadatos.adapter";
import { HmacMediosAdapter } from "./infrastructure/adapters/out/firmador/hmac-medios.adapter";
import { VuelosController } from "./infrastructure/adapters/in/http/vuelos.controller";
import { MediosVuelosController } from "./infrastructure/adapters/in/http/medios-vuelos.controller";
import { VuelosServicioController } from "./infrastructure/adapters/in/http/vuelos-servicio.controller";
import { LlaveServicioGuard } from "./infrastructure/adapters/in/http/guards/llave-servicio.guard";
import { SubidaVueloInterceptor } from "./infrastructure/adapters/in/http/subida-vuelo.interceptor";
import { VueloExistenteGuard } from "./infrastructure/adapters/in/http/guards/vuelo-existente.guard";

@Module({
    controllers: [MediosVuelosController, VuelosController, VuelosServicioController],
    providers: [
        { provide: LECTURA_CORRELACION_APP, useClass: TypeOrmCorrelacionAppAdapter },
        { provide: CORRELACION_APP, useClass: CorrelacionAppService },
        { provide: GESTION_VUELOS, useClass: GestionVuelosService },
        { provide: LEER_MEDIO_VUELO, useClass: LeerMedioVueloService },
        { provide: VUELOS_REPOSITORY, useClass: TypeOrmVuelosRepository },
        { provide: ALMACENAMIENTO_VUELOS, useClass: LocalVuelosAdapter },
        { provide: EXTRACTOR_METADATOS_VUELOS, useClass: ExifrMetadatosAdapter },
        { provide: FIRMADOR_MEDIOS_VUELOS, useClass: HmacMediosAdapter },
        TypeOrmAuditoriaVuelosAdapter,
        { provide: AUDITORIA_VUELOS, useExisting: TypeOrmAuditoriaVuelosAdapter },
        SubidaVueloInterceptor,
        VueloExistenteGuard,
        LlaveServicioGuard,
    ],
})
export class VuelosModule {}
