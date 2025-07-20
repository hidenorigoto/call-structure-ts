import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CacheService } from '../../common/services/cache.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if email already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password if provided
    if (createUserDto.password) {
      createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
    }

    // Create user
    const user = this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(user);

    // Invalidate cache
    await this.cacheService.del('users:count');

    return this.sanitizeUser(savedUser);
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Try to get from cache
    const cacheKey = `users:page:${page}:limit:${limit}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get from database
    const [users, total] = await this.userRepository.findAndCount({
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt', 'lastLogin'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const result = {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, result, 300);

    return result;
  }

  async findOne(id: string): Promise<User> {
    // Try to get from cache
    const cacheKey = `user:${id}`;
    const cached = await this.cacheService.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get from database
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt', 'lastLogin'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, user, 3600);

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Update user
    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    // Invalidate cache
    await this.cacheService.del(`user:${id}`);
    await this.cacheService.invalidatePattern('users:page:*');

    return this.sanitizeUser(updatedUser);
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(id, { password: hashedPassword });
    await this.cacheService.del(`user:${id}`);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLogin: new Date() });
    await this.cacheService.del(`user:${id}`);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    // Invalidate cache
    await this.cacheService.del(`user:${id}`);
    await this.cacheService.invalidatePattern('users:*');
  }

  async activate(id: string): Promise<User> {
    await this.userRepository.update(id, { isActive: true });
    await this.cacheService.del(`user:${id}`);
    return this.findOne(id);
  }

  async deactivate(id: string): Promise<User> {
    await this.userRepository.update(id, { isActive: false });
    await this.cacheService.del(`user:${id}`);
    return this.findOne(id);
  }

  async getUserStats() {
    // Try to get from cache
    const cached = await this.cacheService.get('users:stats');
    if (cached) {
      return cached;
    }

    // Calculate stats
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { isActive: true } });
    const adminUsers = await this.userRepository.count({ where: { role: 'admin' } });
    
    const recentUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt > :date', { 
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
      })
      .getCount();

    const stats = {
      total: totalUsers,
      active: activeUsers,
      admins: adminUsers,
      newThisWeek: recentUsers,
      percentActive: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
    };

    // Cache for 10 minutes
    await this.cacheService.set('users:stats', stats, 600);

    return stats;
  }

  private sanitizeUser(user: User): User {
    const { password, ...sanitized } = user;
    return sanitized as User;
  }
}