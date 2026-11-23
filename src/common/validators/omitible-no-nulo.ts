import { ValidateIf } from "class-validator";

// Como @IsOptional(), pero solo omite la validación si el campo no llega (undefined).
// @IsOptional() también deja pasar null, y en un campo NOT NULL eso termina en un 500 de la base.
export function OmitibleNoNulo(): PropertyDecorator {
    return ValidateIf((_objeto: object, valor: unknown) => valor !== undefined);
}
