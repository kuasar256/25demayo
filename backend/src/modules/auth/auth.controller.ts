import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/roles.decorator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class RecoverDto {
  @IsEmail()
  email: string;
}

class ResetDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @MinLength(6)
  newPassword: string;
}

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria.' })
  currentPassword: string;

  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres.' })
  newPassword: string;
}

class GoogleLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El token de Google es obligatorio.' })
  idToken: string;
}

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto.email, dto.password, req.ip);
  }

  @Public()
  @HttpCode(200)
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto, @Req() req: any) {
    return this.auth.googleLogin(dto.idToken, req.ip);
  }

  @Public()
  @HttpCode(200)
  @Post('recover')
  recover(@Body() dto: RecoverDto) {
    return this.auth.requestRecovery(dto.email);
  }

  @Public()
  @HttpCode(200)
  @Post('reset')
  reset(@Body() dto: ResetDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @HttpCode(200)
  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword, req.ip);
  }

  @Get('me')
  async me(@Req() req: any) {
    const user = await this.auth.getUserById(req.user.id);
    return user;
  }
}

