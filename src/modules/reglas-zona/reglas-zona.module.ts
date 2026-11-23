import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { GESTION_REGLAS_ZONA, REGLAS_ZONA_PUBLICAS } from "./domain/ports/in/reglas-zona.port";
import { REGLAS_ZONA_REPOSITORY } from "./domain/ports/out/reglas-zona.repository";
import { UNIDAD_TRABAJO_REGLAS_ZONA } from "./domain/ports/out/unidad-trabajo.port";
import { APROBADORES_REGLAS_ZONA } from "./domain/ports/out/aprobadores.port";
import { GestionReglasZonaService } from "./application/use-cases/gestion-reglas-zona.service";
import { ReglasZonaPublicasService } from "./application/use-cases/reglas-zona-publicas.service";
import { TypeOrmReglasZonaRepository } from "./infrastructure/adapters/out/persistence/typeorm-reglas-zona.repository";
import { TypeOrmUnidadTrabajoReglasZona } from "./infrastructure/adapters/out/persistence/typeorm-unidad-trabajo-reglas-zona";
import { TypeOrmAprobadoresAdapter } from "./infrastructure/adapters/out/persistence/typeorm-aprobadores.adapter";
import { ReglasZonaController } from "./infrastructure/adapters/in/http/reglas-zona.controller";
import { ReglasZonaPublicasController } from "./infrastructure/adapters/in/http/reglas-zona-publicas.controller";

@Module({
    controllers: [ReglasZonaController, ReglasZonaPublicasController],
    providers: [
        { provide: GESTION_REGLAS_ZONA, useClass: GestionReglasZonaService },
        { provide: REGLAS_ZONA_PUBLICAS, useClass: ReglasZonaPublicasService },
        // Lecturas con el gestor global; las escrituras pasan por la unidad de trabajo (regla + auditoría atómicas).
        {
            provide: REGLAS_ZONA_REPOSITORY,
            useFactory: (db: DataSource) => new TypeOrmReglasZonaRepository(db.manager),
            inject: [DataSource],
        },
        { provide: UNIDAD_TRABAJO_REGLAS_ZONA, useClass: TypeOrmUnidadTrabajoReglasZona },
        { provide: APROBADORES_REGLAS_ZONA, useClass: TypeOrmAprobadoresAdapter },
    ],
})
export class ReglasZonaModule {}
