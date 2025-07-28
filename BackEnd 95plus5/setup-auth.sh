#!/bin/bash
# Script para crear todos los archivos de autenticación en el backend

echo "🚀 Creando estructura de autenticación para el backend..."

# Crear directorios necesarios
mkdir -p src/auth/strategies
mkdir -p src/auth/guards
mkdir -p src/auth/decorators
mkdir -p src/auth/dto
mkdir -p src/users

# ========== Crear archivo: src/auth/strategies/google.strategy.ts ==========
cat > src/auth/strategies/google.strategy.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_REDIRECT_URI'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos, id } = profile;
    
    const user = {
      googleId: id,
      email: emails[0].value,
      name: name.displayName || `${name.givenName} ${name.familyName}`,
      firstName: name.givenName,
      lastName: name.familyName,
      avatar: photos[0].value,
      accessToken,
    };
    
    done(null, user);
  }
}
EOF

# ========== Crear archivo: src/auth/strategies/jwt.strategy.ts ==========
cat > src/auth/strategies/jwt.strategy.ts << 'EOF'
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, name: user.name };
  }
}
EOF

# ========== Crear archivo: src/auth/guards/google-auth.guard.ts ==========
cat > src/auth/guards/google-auth.guard.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
EOF

# ========== Crear archivo: src/auth/guards/jwt-auth.guard.ts ==========
cat > src/auth/guards/jwt-auth.guard.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
EOF

# ========== Crear archivo: src/auth/decorators/current-user.decorator.ts ==========
cat > src/auth/decorators/current-user.decorator.ts << 'EOF'
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
EOF

# ========== Crear archivo: src/auth/dto/refresh-token.dto.ts ==========
cat > src/auth/dto/refresh-token.dto.ts << 'EOF'
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
EOF

# ========== Actualizar archivo: src/auth/auth.service.ts ==========
cat > src/auth/auth.service.ts << 'EOF'
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private configService: ConfigService,
    @Inject('TURSO_CONNECTION') private db: any,
  ) {}

  async validateGoogleUser(googleUser: any) {
    try {
      // Buscar usuario existente
      let user = await this.usersService.findByGoogleId(googleUser.googleId);
      
      if (!user) {
        // Crear nuevo usuario
        user = await this.usersService.create({
          id: uuidv4(),
          email: googleUser.email,
          google_id: googleUser.googleId,
          name: googleUser.name,
          avatar_url: googleUser.avatar,
        });
      } else {
        // Actualizar última conexión y avatar
        await this.usersService.update(user.id, {
          last_login: new Date().toISOString(),
          avatar_url: googleUser.avatar,
        });
      }

      // Generar tokens
      const tokens = this.generateTokens(user);
      
      return {
        user,
        ...tokens,
      };
    } catch (error) {
      console.error('Error validating Google user:', error);
      throw new UnauthorizedException('Failed to authenticate with Google');
    }
  }

  generateTokens(user: any) {
    const payload = { 
      sub: user.id, 
      email: user.email,
      name: user.name,
    };
    
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: '15m',
      }),
      refresh_token: this.jwtService.sign(payload, {
        expiresIn: '7d',
      }),
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findById(payload.sub);
      
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
EOF

# ========== Actualizar archivo: src/auth/auth.controller.ts ==========
cat > src/auth/auth.controller.ts << 'EOF'
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Req, 
  Res, 
  UseGuards,
  UnauthorizedException 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Iniciar autenticación con Google' })
  async googleAuth(@Req() req: any) {
    // Passport maneja la redirección automáticamente
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    try {
      // req.user contiene los datos del usuario de Google
      const authResult = await this.authService.validateGoogleUser(req.user);
      
      // Redirigir al frontend con tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/auth/success?` +
        `access_token=${authResult.access_token}&` +
        `refresh_token=${authResult.refresh_token}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @Post('google/token')
  @ApiOperation({ summary: 'Autenticar con ID token de Google (para mobile/SPA)' })
  async googleTokenAuth(@Body() dto: { idToken: string }) {
    // Este endpoint es para aplicaciones que obtienen el idToken directamente
    // Por ahora, redirigimos al flujo OAuth normal
    throw new UnauthorizedException(
      'Please use /auth/google endpoint for authentication'
    );
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refrescar access token' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario actual' })
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getCurrentUser(user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@Req() req: any) {
    // En una implementación real, podrías invalidar el token aquí
    // Por ahora, el cliente simplemente borra los tokens
    return { message: 'Sesión cerrada exitosamente' };
  }
}
EOF

# ========== Actualizar archivo: src/auth/auth.module.ts ==========
cat > src/auth/auth.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
EOF

# ========== Crear archivo: src/users/users.service.ts ==========
cat > src/users/users.service.ts << 'EOF'
import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
  constructor(
    @Inject('TURSO_CONNECTION') private db: any,
  ) {}

  async findById(id: string) {
    const result = await this.db.execute({
      sql: 'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
      args: [id],
    });
    
    return result.rows[0] || null;
  }

  async findByEmail(email: string) {
    const result = await this.db.execute({
      sql: 'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
      args: [email],
    });
    
    return result.rows[0] || null;
  }

  async findByGoogleId(googleId: string) {
    const result = await this.db.execute({
      sql: 'SELECT * FROM users WHERE google_id = ? AND deleted_at IS NULL',
      args: [googleId],
    });
    
    return result.rows[0] || null;
  }

  async create(userData: any) {
    const user = {
      id: userData.id || uuidv4(),
      email: userData.email,
      google_id: userData.google_id,
      name: userData.name,
      avatar_url: userData.avatar_url,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };

    await this.db.execute({
      sql: `INSERT INTO users (id, email, google_id, name, avatar_url, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: Object.values(user),
    });

    return user;
  }

  async update(id: string, updateData: any) {
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    
    await this.db.execute({
      sql: `UPDATE users SET ${fields} WHERE id = ?`,
      args: [...values, id],
    });
    
    return this.findById(id);
  }

  async updateLastLogin(id: string) {
    return this.update(id, { last_login: new Date().toISOString() });
  }
}
EOF

# ========== Crear archivo: src/users/users.module.ts ==========
cat > src/users/users.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
EOF

# ========== Crear archivo .env.example ==========
cat > .env.example << 'EOF'
# Database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Frontend URL
FRONTEND_URL=http://localhost:3000

# API
PORT=3000
EOF

# ========== Actualizar src/main.ts para incluir CORS ==========
cat > src/main.ts << 'EOF'
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Seguridad
  app.use(helmet());
  app.use(compression());
  
  // CORS - MUY IMPORTANTE para que funcione con el frontend
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://tu-frontend.vercel.app', // Reemplaza con tu URL de producción
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  // Validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  // Documentación API
  const config = new DocumentBuilder()
    .setTitle('95plus5 API')
    .setDescription('Backend para optimización de salud y longevidad')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
EOF

echo "✅ Archivos de autenticación creados exitosamente!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Instalar dependencias: npm install @nestjs/passport passport passport-google-oauth20 @types/passport-google-oauth20 @nestjs/jwt passport-jwt @types/passport-jwt"
echo "2. Configurar variables de entorno en .env"
echo "3. Configurar variables en Vercel Dashboard"
echo "4. Hacer commit y push de los cambios"
echo ""
echo "⚠️  IMPORTANTE: Recuerda actualizar la URL del frontend en main.ts línea 17"