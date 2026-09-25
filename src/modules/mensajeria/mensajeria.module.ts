import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmMensajeEntity } from "./infrastructure/adapters/out/persistence/typeorm-mensaje.entity";
import { TypeOrmAdjuntoMensajeEntity } from "./infrastructure/adapters/out/persistence/typeorm-adjunto-mensaje.entity";
import { TypeOrmMensajeRepository } from "./infrastructure/adapters/out/persistence/typeorm-mensaje.repository";
import { SolicitudesConsultaAdapter } from "./infrastructure/adapters/out/solicitudes/solicitudes-consulta.adapter";
import { AgronomosConsultaAdapter } from "./infrastructure/adapters/out/agronomos/agronomos-consulta.adapter";
import { MensajesController } from "./infrastructure/adapters/in/http/mensajes.controller";

import { MENSAJE_REPOSITORY } from "./domain/ports/out/mensaje.repository";
import { CONSULTA_SOLICITUDES } from "./domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS } from "./domain/ports/out/consulta-agronomos.port";

import { SolicitudesModule } from "../solicitudes/solicitudes.module";
import { AgronomosModule } from "../agronomos/agronomos.module";
import { AlmacenamientoModule } from "../../common/almacenamiento/almacenamiento.module";

// Casos de uso
import { EnviarMensajeService } from "./application/use-cases/enviar-mensaje.service";
import { ListarMensajesService } from "./application/use-cases/listar-mensajes.service";
import { MarcarMensajesLeidosService } from "./application/use-cases/marcar-mensajes-leidos.service";
import { ContarMensajesPendientesService } from "./application/use-cases/contar-mensajes-pendientes.service";
import { DescargarAdjuntoMensajeService } from "./application/use-cases/descargar-adjunto-mensaje.service";

@Module({
    // El canal consulta solicitudes y agrónomos por sus puertos, y custodia los adjuntos
    // en almacenamiento privado (RF-08.5)
    imports: [
        TypeOrmModule.forFeature([TypeOrmMensajeEntity, TypeOrmAdjuntoMensajeEntity]),
        SolicitudesModule,
        AgronomosModule,
        AlmacenamientoModule,
    ],
    controllers: [MensajesController],
    providers: [
        EnviarMensajeService,
        ListarMensajesService,
        MarcarMensajesLeidosService,
        ContarMensajesPendientesService,
        DescargarAdjuntoMensajeService,
        {
            provide: MENSAJE_REPOSITORY,
            useClass: TypeOrmMensajeRepository,
        },
        {
            provide: CONSULTA_SOLICITUDES,
            useClass: SolicitudesConsultaAdapter,
        },
        {
            provide: CONSULTA_AGRONOMOS,
            useClass: AgronomosConsultaAdapter,
        },
    ],
    // El contador de pendientes lo consumirán el tablero y las notificaciones (RF-08.6)
    exports: [ContarMensajesPendientesService],
})
export class MensajeriaModule {}
