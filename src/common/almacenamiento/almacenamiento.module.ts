import { Module } from "@nestjs/common";
import { ALMACENAMIENTO_ARCHIVOS } from "./almacenamiento.port";
import { LocalAlmacenamientoAdapter } from "./local-almacenamiento.adapter";

@Module({
    providers: [
        {
            provide: ALMACENAMIENTO_ARCHIVOS,
            useClass: LocalAlmacenamientoAdapter,
        },
    ],
    exports: [ALMACENAMIENTO_ARCHIVOS],
})
export class AlmacenamientoModule {}
