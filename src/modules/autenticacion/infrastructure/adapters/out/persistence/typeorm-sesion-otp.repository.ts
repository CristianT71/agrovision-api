import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ISesionOtpRepository } from "../../../../domain/ports/out/sesion-otp.repository";
import { SesionOtp } from "../../../../domain/entities/sesion-otp.entity";
import { TypeOrmSesionOtpEntity } from "./typeorm-sesion-otp.entity";

@Injectable()
export class TypeOrmSesionOtpRepository implements ISesionOtpRepository {
    constructor(
        @InjectRepository(TypeOrmSesionOtpEntity)
        private readonly repository: Repository<TypeOrmSesionOtpEntity>,
    ) {}

    async findUltimaPorUsuarioId(usuarioId: string): Promise<SesionOtp | null> {
        const entity = await this.repository.findOne({
            where: { usuarioId },
            order: { creadoEn: "DESC" },
        });

        if (!entity) return null;

        return new SesionOtp(
            entity.id,
            entity.usuarioId,
            entity.codigoHash,
            entity.expiraEn,
            entity.usado,
            entity.creadoEn,
            entity.intentos,
        );
    }

    async guardar(sesionOtp: SesionOtp): Promise<void> {
        await this.repository.save({
            id: sesionOtp.id,
            usuarioId: sesionOtp.usuarioId,
            codigoHash: sesionOtp.codigoHash,
            expiraEn: sesionOtp.expiraEn,
            usado: sesionOtp.usado,
            creadoEn: sesionOtp.creadoEn,
            intentos: sesionOtp.intentos,
        });
    }

    async registrarIntentoFallido(id: string): Promise<void> {
        await this.repository.increment({ id }, "intentos", 1);
    }

    async consumir(id: string): Promise<boolean> {
        // UPDATE condicionado: solo una petición puede pasar el código de libre a usado
        const resultado = await this.repository.update({ id, usado: false }, { usado: true });

        return (resultado.affected ?? 0) > 0;
    }
}
