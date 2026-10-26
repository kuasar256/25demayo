import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '../../common/jwt-secret';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  role: string;
  branchId?: number | null;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido o mal formado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        branchId: true,
        isActive: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o sesión no válida');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta de usuario se encuentra desactivada');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('La cuenta se encuentra temporalmente bloqueada');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
    };
  }
}

