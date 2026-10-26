import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const MAX_IP_FAILED_ATTEMPTS = 15;
const IP_LOCK_MINUTES = 10;

interface IpRateRecord {
  failedAttempts: number;
  blockedUntil: number | null;
}

const ipRateLimits = new Map<string, IpRateRecord>();

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  private recordIpFailure(clientIp: string) {
    const now = Date.now();
    const record = ipRateLimits.get(clientIp) || { failedAttempts: 0, blockedUntil: null };
    record.failedAttempts += 1;
    if (record.failedAttempts >= MAX_IP_FAILED_ATTEMPTS) {
      record.blockedUntil = now + IP_LOCK_MINUTES * 60 * 1000;
      record.failedAttempts = 0;
    }
    ipRateLimits.set(clientIp, record);
  }

  async login(email: string, password: string, ip?: string) {
    const clientIp = ip || 'unknown';
    const now = Date.now();
    const ipRecord = ipRateLimits.get(clientIp);

    if (ipRecord?.blockedUntil && ipRecord.blockedUntil > now) {
      const waitSeconds = Math.ceil((ipRecord.blockedUntil - now) / 1000);
      throw new ForbiddenException(
        `Demasiados intentos fallidos desde esta dirección IP. Bloqueo temporal por seguridad. Intente de nuevo en ${waitSeconds} segundos.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { branch: { select: { name: true } } },
    });
    if (!user) {
      this.recordIpFailure(clientIp);
      await this.prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          module: 'auth',
          detail: `Intento de acceso fallido: correo no registrado (${email})`,
          ip,
        },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_BLOCKED',
          module: 'auth',
          detail: 'Intento de acceso a cuenta actualmente bloqueada por seguridad.',
          ip,
        },
      });
      throw new ForbiddenException(
        'Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.',
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      this.recordIpFailure(clientIp);
      const failed = user.failedAttempts + 1;
      const lockedUntil =
        failed >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
          : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: lockedUntil ? 0 : failed,
          lockedUntil,
        },
      });
      if (lockedUntil) {
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'USUARIO_BLOQUEADO',
            title: 'Cuenta bloqueada por seguridad',
            message: `Se bloqueó la cuenta por ${LOCK_MINUTES} minutos tras ${MAX_FAILED_ATTEMPTS} intentos fallidos de acceso.`,
          },
        });
        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'ACCOUNT_LOCKED',
            module: 'auth',
            detail: `Cuenta bloqueada por ${LOCK_MINUTES} minutos tras ${MAX_FAILED_ATTEMPTS} intentos fallidos.`,
            ip,
          },
        });
      } else {
        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN_FAILED',
            module: 'auth',
            detail: `Contraseña incorrecta (intento fallido ${failed}/${MAX_FAILED_ATTEMPTS})`,
            ip,
          },
        });
      }
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_INACTIVE',
          module: 'auth',
          detail: 'Intento de inicio de sesión de usuario desactivado.',
          ip,
        },
      });
      throw new ForbiddenException('Usuario desactivado. Contacte al administrador.');
    }

    // Limpiar bloqueo de IP tras login exitoso
    ipRateLimits.delete(clientIp);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', module: 'auth', ip },
    });


    const payload = { sub: user.id, email: user.email, role: user.role, branchId: user.branchId };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        branchId: user.branchId,
        branchName: user.branch?.name ?? null,
      },
    };
  }

  async changePassword(userId: number, currentPass: string, newPass: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');

    const ok = await bcrypt.compare(currentPass, user.password);
    if (!ok) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGE_FAILED',
          module: 'auth',
          detail: 'Intento fallido de cambio de contraseña: la contraseña actual no coincide.',
          ip,
        },
      });
      throw new BadRequestException('La contraseña actual es incorrecta.');
    }

    if (currentPass === newPass) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la contraseña actual.');
    }

    const hashed = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, failedAttempts: 0, lockedUntil: null },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGED',
        module: 'auth',
        detail: 'Cambio de contraseña exitoso por el usuario.',
        ip,
      },
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  async requestRecovery(email: string) {
    const genericResponse = {
      message: 'Si la cuenta está registrada, la solicitud será revisada por el administrador.',
    };
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.isActive) return genericResponse;

    const message = `Solicitud de nueva contraseña para ${user.fullName} (${user.email}).`;
    const admins = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN_GENERAL, Role.ADMIN] },
      },
      select: { id: true },
    });
    if (admins.length === 0) return genericResponse;

    const recentNotifications = await this.prisma.notification.findMany({
      where: {
        type: 'PASSWORD_RESET_REQUEST',
        message,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      select: { userId: true },
    });
    const alreadyNotified = new Set(recentNotifications.map(({ userId }) => userId));
    const targets = admins.filter(({ id }) => !alreadyNotified.has(id));
    if (targets.length > 0) {
      await this.prisma.notification.createMany({
        data: targets.map(({ id }) => ({
          userId: id,
          type: 'PASSWORD_RESET_REQUEST',
          title: 'Solicitud de nueva contraseña',
          message,
        })),
      });
    }

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwt.verify(token);
      if (payload?.type !== 'pwd_reset' || !payload?.sub) {
        throw new BadRequestException('Token no válido para restablecimiento de contraseña.');
      }
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new BadRequestException('Usuario no válido o cuenta desactivada.');
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, failedAttempts: 0, lockedUntil: null },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET',
          module: 'auth',
          detail: 'Restablecimiento de contraseña completado mediante token JWT.',
        },
      });
      return { message: 'Contraseña restablecida correctamente.' };
    } catch (e: any) {
      if (e.name === 'TokenExpiredError') {
        throw new BadRequestException('El token de restablecimiento ha expirado.');
      }
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Token de restablecimiento inválido.');
    }
  }

  async getUserById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        branchId: true,
        branch: { select: { name: true } },
      },
    });
  }

  /* ────────────────── GOOGLE OAUTH ────────────────── */

  /**
   * Verifica un ID token de Google usando la API de Google.
   * Retorna el payload del token si es válido.
   */
  private verifyGoogleToken(idToken: string): Promise<{
    email: string;
    name: string;
    picture?: string;
    sub: string;
  }> {
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (!expectedClientId || expectedClientId === 'tu-client-id-de-google.apps.googleusercontent.com') {
      return Promise.reject(new UnauthorizedException('El acceso con Google no está configurado.'));
    }
    return new Promise((resolve, reject) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const payload = JSON.parse(data);

              if (res.statusCode !== 200 || payload.error) {
                return reject(
                  new UnauthorizedException('Token de Google inválido o expirado.'),
                );
              }

              // Verificar que el token fue emitido para nuestro Client ID
              if (payload.aud !== expectedClientId) {
                return reject(
                  new UnauthorizedException(
                    'Token de Google no corresponde a esta aplicación.',
                  ),
                );
              }

              resolve({
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                sub: payload.sub,
              });
            } catch {
              reject(new UnauthorizedException('Error al verificar token de Google.'));
            }
          });
        })
        .on('error', () => {
          reject(new UnauthorizedException('No se pudo conectar con Google para verificar el token.'));
        });
    });
  }

  /**
   * Inicia sesión con un ID token de Google.
   * Solo permite el acceso si el email de Google coincide con un usuario existente y activo.
   */
  async googleLogin(idToken: string, ip?: string) {
    const clientIp = ip || 'unknown';

    // Verificar rate limit por IP
    const now = Date.now();
    const ipRecord = ipRateLimits.get(clientIp);
    if (ipRecord?.blockedUntil && ipRecord.blockedUntil > now) {
      const waitSeconds = Math.ceil((ipRecord.blockedUntil - now) / 1000);
      throw new ForbiddenException(
        `Demasiados intentos fallidos desde esta dirección IP. Intente de nuevo en ${waitSeconds} segundos.`,
      );
    }

    // Verificar el token con Google
    const googleUser = await this.verifyGoogleToken(idToken);

    // Buscar usuario por email en la base de datos
    const user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
      include: { branch: { select: { name: true } } },
    });

    if (!user) {
      this.recordIpFailure(clientIp);
      await this.prisma.auditLog.create({
        data: {
          action: 'GOOGLE_LOGIN_FAILED',
          module: 'auth',
          detail: `Intento de acceso con Google: correo no registrado (${googleUser.email})`,
          ip,
        },
      });
      throw new UnauthorizedException(
        'No existe una cuenta asociada a este correo de Google. Contacte al administrador.',
      );
    }

    if (!user.isActive) {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'GOOGLE_LOGIN_INACTIVE',
          module: 'auth',
          detail: 'Intento de acceso con Google de usuario desactivado.',
          ip,
        },
      });
      throw new ForbiddenException('Usuario desactivado. Contacte al administrador.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'GOOGLE_LOGIN_BLOCKED',
          module: 'auth',
          detail: 'Intento de acceso con Google a cuenta bloqueada.',
          ip,
        },
      });
      throw new ForbiddenException(
        'Cuenta bloqueada temporalmente. Intente más tarde.',
      );
    }

    // Limpiar bloqueos
    ipRateLimits.delete(clientIp);

    // Actualizar avatar de Google si el usuario no tiene uno
    const updateData: any = {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    };
    if (!user.avatarUrl && googleUser.picture) {
      updateData.avatarUrl = googleUser.picture;
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'GOOGLE_LOGIN',
        module: 'auth',
        detail: `Inicio de sesión exitoso con Google (${googleUser.email})`,
        ip,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl || googleUser.picture || null,
        role: user.role,
        branchId: user.branchId,
        branchName: user.branch?.name ?? null,
      },
    };
  }
}
