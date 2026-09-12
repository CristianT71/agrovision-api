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
            entity.codigo,
            entity.expiraEn,
            entity.usado,
            entity.creadoEn,
        );
    }

    async guardar(sesionOtp: SesionOtp): Promise<void> {
        await this.repository.save({
            id: sesionOtp.id,
            usuarioId: sesionOtp.usuarioId,
            codigo: sesionOtp.codigo,
            expiraEn: sesionOtp.expiraEn,
            usado: sesionOtp.usado,
            creadoEn: sesionOtp.creadoEn,
        });
    }
}
