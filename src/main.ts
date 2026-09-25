import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "node:path";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { directorioArchivos, PREFIJO_URL_PUBLICA } from "./common/almacenamiento/local-almacenamiento.adapter";

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.setGlobalPrefix("api");

    // Solo la carpeta pública (fotos del catálogo) se sirve directo; las acreditaciones no
    app.useStaticAssets(join(directorioArchivos(), "publico"), { prefix: PREFIJO_URL_PUBLICA });

    app.enableCors({ origin: "http://localhost:5173" });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
