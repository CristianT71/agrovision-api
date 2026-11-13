import { Module } from "@nestjs/common";
import { GESTION_REGLAS_ZONA, REGLAS_ZONA_PUBLICAS } from "./domain/ports/in/reglas-zona.port";
import { REGLAS_ZONA_REPOSITORY } from "./domain/ports/out/reglas-zona.repository";
import { AUDITORIA_REGLAS_ZONA } from "./domain/ports/out/auditoria-reglas-zona.port";
import { APROBADORES_REGLAS_ZONA } from "./domain/ports/out/aprobadores.port";
import { GestionReglasZonaService } from "./application/use-cases/gestion-reglas-zona.service";
import { ReglasZonaPublicasService } from "./application/use-cases/reglas-zona-publicas.service";
import { TypeOrmReglasZonaRepository } from "./infrastructure/adapters/out/persistence/typeorm-reglas-zona.repository";
import { TypeOrmAuditoriaReglasZonaAdapter } from "./infrastructure/adapters/out/persistence/typeorm-auditoria-reglas-zona.adapter";
import { TypeOrmAprobadoresAdapter } from "./infrastructure/adapters/out/persistence/typeorm-aprobadores.adapter";
import { ReglasZonaController } from "./infrastructure/adapters/in/http/reglas-zona.controller";
import { ReglasZonaPublicasController } from "./infrastructure/adapters/in/http/reglas-zona-publicas.controller";

@Module({
    controllers: [ReglasZonaController, ReglasZonaPublicasController],
    providers: [
        { provide: GESTION_REGLAS_ZONA, useClass: GestionReglasZonaService },
        { provide: REGLAS_ZONA_PUBLICAS, useClass: ReglasZonaPublicasService },
        { provide: REGLAS_ZONA_REPOSITORY, useClass: TypeOrmReglasZonaRepository },
        { provide: AUDITORIA_REGLAS_ZONA, useClass: TypeOrmAuditoriaReglasZonaAdapter },
        { provide: APROBADORES_REGLAS_ZONA, useClass: TypeOrmAprobadoresAdapter },
    ],
})
export class ReglasZonaModule {}
