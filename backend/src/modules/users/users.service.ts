import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../../common/security.util';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserListResponseDto } from './dto/user.dto';

function toResponse(u: {
  id: string;
  username: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: Date | null;
}): UserResponseDto {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    phone: u.phone,
    role: u.role,
    is_active: u.is_active,
    created_at: u.created_at,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.users.findFirst({ where: { username: dto.username } });
    if (existing) {
      throw new BadRequestException('Username already exists');
    }
    const created = await this.prisma.users.create({
      data: {
        username: dto.username,
        password_hash: hashPassword(dto.password),
        role: dto.role,
        full_name: dto.full_name ?? null,
        phone: dto.phone ?? null,
      },
    });
    return toResponse(created);
  }

  async list(page: number, pageSize: number, keyword: string): Promise<UserListResponseDto> {
    const where = keyword
      ? { username: { contains: keyword, mode: 'insensitive' as const } }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.users.count({ where }),
    ]);
    return { items: items.map(toResponse), total };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const u = await this.prisma.users.findFirst({ where: { id } });
    console.log('[DEBUG findOne]', id, '→', u ? `${u.username} (deleted_at=${u.deleted_at})` : 'null');
    if (!u) throw new NotFoundException('User not found');
    return toResponse(u);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const u = await this.prisma.users.findFirst({ where: { id } });
    if (!u) throw new NotFoundException('User not found');

    const data: Record<string, unknown> = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined) data.password_hash = hashPassword(dto.password);
    if (dto.full_name !== undefined) data.full_name = dto.full_name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    const updated = await this.prisma.users.update({ where: { id: u.id }, data });
    return toResponse(updated);
  }

  async resetPassword(id: string, newPassword: string): Promise<UserResponseDto> {
    const u = await this.prisma.users.findFirst({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    const updated = await this.prisma.users.update({
      where: { id: u.id },
      data: { password_hash: hashPassword(newPassword) },
    });
    return toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const u = await this.prisma.users.findFirst({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    // Soft delete: the Prisma middleware auto-filters deleted_at.
    await this.prisma.users.update({
      where: { id: u.id },
      data: { deleted_at: new Date() },
    });
  }
}
