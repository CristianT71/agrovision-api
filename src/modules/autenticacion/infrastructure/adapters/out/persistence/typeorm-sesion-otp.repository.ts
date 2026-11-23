import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, MoreThan, MoreThanOrEqual, Repository } from "typeorm";
import type { ISesionOtpRepository } from "../../../../domain/ports/out/sesion-otp.repository";
import { MAX_INTENTOS_OTP, SesionOtp } from "../../../../domain/entities/sesion-otp.entity";
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

    async contarDesde(usuarioId: string, desde: Date): Promise<number> {
        return await this.repository.count({ where: { usuarioId, creadoEn: MoreThanOrEqual(desde) } });
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

    async reservarIntento(id: string): Promise<boolean> {
        // UPDATE condicionado y atómico: la fila queda bloqueada mientras se evalúa, así que dos
        // peticiones simultáneas no pueden gastar el mismo intento
        const resultado = await this.repository.update(
            { id, usado: false, intentos: LessThan(MAX_INTENTOS_OTP), expiraEn: MoreThan(new Date()) },
            { intentos: () => "intentos + 1" },
        );

        return (resultado.affected ?? 0) > 0;
    }

    async consumir(id: string): Promise<boolean> {
        // UPDATE condicionado: solo una petición puede pasar el código de libre (y vigente) a usado
        const resultado = await this.repository.update(
            { id, usado: false, expiraEn: MoreThan(new Date()) },
            { usado: true },
        );

        return (resultado.affected ?? 0) > 0;
    }
}
