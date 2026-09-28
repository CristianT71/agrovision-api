import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TypeOrmPermisoContactoEntity } from "./infrastructure/adapters/out/persistence/typeorm-permiso-contacto.entity";
import { TypeOrmPermisoContactoRepository } from "./infrastructure/adapters/out/persistence/typeorm-permiso-contacto.repository";
import { SolicitudesConsultaAdapter } from "./infrastructure/adapters/out/solicitudes/solicitudes-consulta.adapter";
import { AgronomosConsultaAdapter } from "./infrastructure/adapters/out/agronomos/agronomos-consulta.adapter";
import { PermisosContactoController } from "./infrastructure/adapters/in/http/permisos-contacto.controller";

import { PERMISO_CONTACTO_REPOSITORY } from "./domain/ports/out/permiso-contacto.repository";
import { CONSULTA_SOLICITUDES } from "./domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS } from "./domain/ports/out/consulta-agronomos.port";

import { SolicitudesModule } from "../solicitudes/solicitudes.module";
import { AgronomosModule } from "../agronomos/agronomos.module";

// Casos de uso
import { ObtenerPermisoContactoService } from "./application/use-cases/obtener-permiso-contacto.service";
import { OtorgarPermisoContactoService } from "./application/use-cases/otorgar-permiso-contacto.service";
import { RevocarPermisoContactoService } from "./application/use-cases/revocar-permiso-contacto.service";

@Module({
    // El permiso consulta solicitudes y agrónomos por sus puertos; nunca escribe en ellos
    imports: [TypeOrmModule.forFeature([TypeOrmPermisoContactoEntity]), SolicitudesModule, AgronomosModule],
    controllers: [PermisosContactoController],
    providers: [
        ObtenerPermisoContactoService,
        OtorgarPermisoContactoService,
        RevocarPermisoContactoService,
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
    ],
})
export class PermisosContactoModule {}
