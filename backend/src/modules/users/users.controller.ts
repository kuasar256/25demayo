import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { UsersService } from './users.service';

class CreateUserDto {
  @IsEmail() email: string;
  @IsNotEmpty() fullName: string;
  @MinLength(6) password: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsInt() branchId?: number;
}

class UpdateUserDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsNotEmpty() fullName?: string;
  @IsOptional() @MinLength(6) password?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsInt() branchId?: number;
}

class ActivateDto {
  @IsBoolean() isActive: boolean;
}

class UpdateAvatarDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}

@ApiTags('Usuarios')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const isActive = status === 'active' ? true : status === 'inactive' ? false : undefined;
    return this.users.list({
      search: typeof search === 'string' ? search.trim().slice(0, 100) : undefined,
      isActive,
      pagination: parsePagination(page, pageSize),
    });
  }

  @Patch('me')
  updateMe(@Body() dto: UpdateAvatarDto, @Req() req: any) {
    return this.users.updateAvatar(req.user.id, dto.avatarUrl);
  }


  @Post()
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.users.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.users.update(id, dto, req.user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: ActivateDto, @Req() req: any) {
    return this.users.setStatus(id, dto.isActive, req.user);
  }
}
