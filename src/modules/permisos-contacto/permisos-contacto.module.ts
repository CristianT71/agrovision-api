import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmPermisoContactoEntity } from "./infrastructure/adapters/out/persistence/typeorm-permiso-contacto.entity";
import { TypeOrmPermisoContactoRepository } from "./infrastructure/adapters/out/persistence/typeorm-permiso-contacto.repository";
import { SolicitudesConsultaAdapter } from "./infrastructure/adapters/out/solicitudes/solicitudes-consulta.adapter";
import { AgronomosConsultaAdapter } from "./infrastructure/adapters/out/agronomos/agronomos-consulta.adapter";
import { ProductoresConsultaAdapter } from "./infrastructure/adapters/out/productores/productores-consulta.adapter";
import { PermisosContactoController } from "./infrastructure/adapters/in/http/permisos-contacto.controller";

import { PERMISO_CONTACTO_REPOSITORY } from "./domain/ports/out/permiso-contacto.repository";
import { CONSULTA_SOLICITUDES } from "./domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS } from "./domain/ports/out/consulta-agronomos.port";
import { CONSULTA_PRODUCTORES } from "./domain/ports/out/consulta-productores.port";

import { SolicitudesModule } from "../solicitudes/solicitudes.module";
import { AgronomosModule } from "../agronomos/agronomos.module";
import { ProductoresModule } from "../productores/productores.module";

// Casos de uso
import { ObtenerPermisoContactoService } from "./application/use-cases/obtener-permiso-contacto.service";
import { OtorgarPermisoContactoService } from "./application/use-cases/otorgar-permiso-contacto.service";
import { RevocarPermisoContactoService } from "./application/use-cases/revocar-permiso-contacto.service";
import { ObtenerContactoProductorService } from "./application/use-cases/obtener-contacto-productor.service";

@Module({
    // El permiso consulta solicitudes, agrónomos y productores por sus puertos; nunca escribe en ellos
    imports: [
        TypeOrmModule.forFeature([TypeOrmPermisoContactoEntity]),
        SolicitudesModule,
        AgronomosModule,
        ProductoresModule,
    ],
    controllers: [PermisosContactoController],
    providers: [
        ObtenerPermisoContactoService,
        OtorgarPermisoContactoService,
        RevocarPermisoContactoService,
        ObtenerContactoProductorService,
        {
            provide: PERMISO_CONTACTO_REPOSITORY,
            useClass: TypeOrmPermisoContactoRepository,
        },
        {
            provide: CONSULTA_SOLICITUDES,
            useClass: SolicitudesConsultaAdapter,
        },
        {
            provide: CONSULTA_AGRONOMOS,
            useClass: AgronomosConsultaAdapter,
        },
        {
            provide: CONSULTA_PRODUCTORES,
            useClass: ProductoresConsultaAdapter,
        },
    ],
})
export class PermisosContactoModule {}
