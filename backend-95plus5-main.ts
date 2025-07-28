// src/app.module.ts - Módulo principal con NestJS
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HabitsModule } from './habits/habits.module';
import { GarminModule } from './garmin/garmin.module';
import { LabModule } from './laboratory/laboratory.module';
import { HealthAnalyticsModule } from './analytics/health-analytics.module';
import { DatabaseModule } from './database/database.module';
import { EventBusModule } from './events/event-bus.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    SecurityModule,
    EventBusModule,
    AuthModule,
    UsersModule,
    HabitsModule,
    GarminModule,
    LabModule,
    HealthAnalyticsModule,
  ],
})
export class AppModule {}

// src/database/database.module.ts - Configuración de Turso/LibSQL
import { Module, Global } from '@nestjs/common';
import { createClient } from '@libsql/client';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async () => {
        const client = createClient({
          url: process.env.TURSO_DATABASE_URL,
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        
        // Inicializar esquema si es necesario
        await client.execute(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            google_id TEXT UNIQUE,
            name TEXT,
            avatar_url TEXT,
            birth_date DATE,
            gender TEXT CHECK(gender IN ('male', 'female', 'other')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
          );
          
          CREATE TABLE IF NOT EXISTS user_habits (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            date DATE NOT NULL,
            habit_type TEXT NOT NULL,
            value TEXT NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, date, habit_type)
          );
          
          CREATE TABLE IF NOT EXISTS garmin_readings (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            device TEXT,
            activity_type TEXT,
            duration INTEGER,
            distance REAL,
            elevation_gain REAL,
            avg_speed REAL,
            max_speed REAL,
            avg_heart_rate INTEGER,
            max_heart_rate INTEGER,
            calories INTEGER,
            vo2_max REAL,
            recovery_time INTEGER,
            training_effect REAL,
            hrv_data TEXT,
            stress_level INTEGER,
            body_battery INTEGER,
            sleep_data TEXT,
            power_data TEXT,
            gps_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
          
          CREATE TABLE IF NOT EXISTS lab_results (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            test_date DATE NOT NULL,
            test_type TEXT NOT NULL,
            results TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
          
          CREATE TABLE IF NOT EXISTS ai_insights (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            insight_type TEXT NOT NULL,
            summary TEXT NOT NULL,
            recommendations TEXT NOT NULL,
            tags TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
        `);
        
        return client;
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}

// src/auth/auth.service.ts - Autenticación con Google OAuth
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  async validateGoogleToken(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      
      const payload = ticket.getPayload();
      
      if (!payload) {
        throw new UnauthorizedException('Invalid token');
      }

      // Buscar o crear usuario
      let user = await this.usersService.findByGoogleId(payload.sub);
      
      if (!user) {
        user = await this.usersService.create({
          id: uuidv4(),
          email: payload.email,
          google_id: payload.sub,
          name: payload.name,
          avatar_url: payload.picture,
        });
      } else {
        // Actualizar última conexión
        await this.usersService.updateLastLogin(user.id);
      }

      // Generar JWT
      const tokens = this.generateTokens(user);
      
      return {
        user,
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };
    
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
}

// src/garmin/garmin.service.ts - Integración con Garmin
import { Injectable, Logger } from '@nestjs/common';
import { GarminConnect } from 'garmin-connect';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { S3Service } from '../common/services/s3.service';
import * as crypto from 'crypto';
import * as sharp from 'sharp';

@Injectable()
export class GarminService {
  private readonly logger = new Logger(GarminService.name);
  private garminClients = new Map<string, GarminConnect>();

  constructor(
    @InjectRepository('DATABASE_CONNECTION')
    private db: any,
    private eventEmitter: EventEmitter2,
    private s3Service: S3Service,
  ) {}

  async connectUserAccount(userId: string, email: string, password: string) {
    try {
      const encryptedPassword = this.encryptPassword(password);
      
      const gcClient = new GarminConnect({
        username: email,
        password,
      });
      
      await gcClient.login();
      
      // Guardar credenciales encriptadas para sincronización automática
      await this.db.execute({
        sql: `INSERT OR REPLACE INTO user_garmin_credentials 
              (user_id, email, encrypted_password, last_sync) 
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [userId, email, encryptedPassword],
      });
      
      this.garminClients.set(userId, gcClient);
      
      // Sincronización inicial
      await this.syncUserData(userId);
      
      return { success: true, message: 'Garmin account connected successfully' };
    } catch (error) {
      this.logger.error(`Failed to connect Garmin account: ${error.message}`);
      throw new Error('Failed to connect to Garmin');
    }
  }

  async syncUserData(userId: string) {
    const client = await this.getClientForUser(userId);
    
    if (!client) {
      throw new Error('Garmin not connected for user');
    }

    try {
      // Implementar rate limiting
      await this.rateLimiter.checkLimit(userId);
      
      // Obtener datos de las últimas 24 horas
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      // Actividades
      const activities = await client.getActivities(0, 10);
      for (const activity of activities) {
        const savedActivity = await this.saveActivity(userId, activity);
        
        // Intentar capturar screenshot de la actividad
        if (activity.activityId) {
          await this.captureActivityScreenshot(userId, savedActivity.id, activity.activityId, client);
        }
      }
      
      // Métricas de salud
      const [heartRate, sleep, stress, bodyBattery, hrv] = await Promise.all([
        client.getHeartRate(today),
        client.getSleepData(today),
        client.getStress(today),
        client.getBodyBattery(today),
        client.getHRV(today),
      ]);
      
      // Guardar métricas
      await this.saveHealthMetrics(userId, {
        heartRate,
        sleep,
        stress,
        bodyBattery,
        hrv,
        timestamp: today,
      });
      
      // Emitir evento para procesamiento
      this.eventEmitter.emit('garmin.data.synced', {
        userId,
        timestamp: new Date(),
        metricsCount: activities.length + 5,
      });
      
    } catch (error) {
      this.logger.error(`Sync failed for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  private async captureActivityScreenshot(
    userId: string, 
    readingId: string, 
    activityId: string, 
    client: GarminConnect
  ) {
    try {
      // Obtener datos detallados de la actividad
      const activityDetails = await client.getActivity({ activityId });
      
      // Si hay URL de mapa o gráficos, capturarlos
      if (activityDetails.mapPolylineUrl || activityDetails.summaryPolylineUrl) {
        const mapUrl = activityDetails.mapPolylineUrl || activityDetails.summaryPolylineUrl;
        
        // Generar screenshot del mapa
        const screenshotBuffer = await this.generateMapScreenshot(mapUrl, activityDetails);
        
        // Crear thumbnail
        const thumbnailBuffer = await sharp(screenshotBuffer)
          .resize(300, 200, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        // Subir a S3
        const screenshotKey = `users/${userId}/activities/${readingId}/screenshot.jpg`;
        const thumbnailKey = `users/${userId}/activities/${readingId}/thumbnail.jpg`;
        
        const [screenshotUrl, thumbnailUrl] = await Promise.all([
          this.s3Service.uploadFile(screenshotBuffer, screenshotKey, 'image/jpeg'),
          this.s3Service.uploadFile(thumbnailBuffer, thumbnailKey, 'image/jpeg'),
        ]);
        
        // Guardar en base de datos
        await this.saveActivityScreenshot({
          id: uuidv4(),
          garmin_reading_id: readingId,
          user_id: userId,
          screenshot_url: screenshotUrl,
          screenshot_thumbnail_url: thumbnailUrl,
          file_type: 'screenshot',
          file_size: screenshotBuffer.length,
          metadata: JSON.stringify({
            activity_id: activityId,
            activity_type: activityDetails.activityType?.typeKey,
            capture_date: new Date().toISOString(),
            has_map: !!activityDetails.mapPolylineUrl,
            has_graphs: !!activityDetails.metricDescriptors,
          }),
        });
      }
      
      // También guardar archivos GPX/FIT si están disponibles
      if (activityDetails.hasPolyline) {
        await this.downloadActivityFile(userId, readingId, activityId, client, 'gpx');
      }
      
    } catch (error) {
      this.logger.error(`Failed to capture activity screenshot: ${error.message}`);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  private async generateMapScreenshot(mapUrl: string, activityDetails: any): Promise<Buffer> {
    // Aquí podrías usar puppeteer o una API de mapas para generar el screenshot
    // Por ahora, simulamos con un placeholder
    
    // En producción, usarías algo como:
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // await page.goto(mapUrl);
    // const screenshot = await page.screenshot();
    // await browser.close();
    // return screenshot;
    
    // Placeholder temporal
    return Buffer.from('placeholder-image-data');
  }

  private async downloadActivityFile(
    userId: string, 
    readingId: string, 
    activityId: string, 
    client: GarminConnect,
    fileType: 'gpx' | 'fit' | 'tcx'
  ) {
    try {
      let fileData;
      let mimeType;
      
      switch (fileType) {
        case 'gpx':
          fileData = await client.getGPX({ activityId });
          mimeType = 'application/gpx+xml';
          break;
        case 'fit':
          fileData = await client.downloadOriginalActivityData({ activityId });
          mimeType = 'application/fit';
          break;
        case 'tcx':
          fileData = await client.getTCX({ activityId });
          mimeType = 'application/tcx+xml';
          break;
      }
      
      if (fileData) {
        const fileKey = `users/${userId}/activities/${readingId}/${fileType}_file.${fileType}`;
        const fileUrl = await this.s3Service.uploadFile(
          Buffer.from(fileData), 
          fileKey, 
          mimeType
        );
        
        await this.saveActivityScreenshot({
          id: uuidv4(),
          garmin_reading_id: readingId,
          user_id: userId,
          screenshot_url: fileUrl,
          screenshot_thumbnail_url: null,
          file_type: fileType,
          file_size: fileData.length,
          metadata: JSON.stringify({
            activity_id: activityId,
            file_format: fileType,
            download_date: new Date().toISOString(),
          }),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to download ${fileType} file: ${error.message}`);
    }
  }

  private async saveActivity(userId: string, activity: any) {
    const activityData = {
      id: uuidv4(),
      user_id: userId,
      timestamp: activity.startTimeLocal,
      device: activity.deviceName,
      activity_type: activity.activityType?.typeKey,
      duration: activity.duration,
      distance: activity.distance,
      elevation_gain: activity.elevationGain,
      avg_speed: activity.averageSpeed,
      max_speed: activity.maxSpeed,
      avg_heart_rate: activity.averageHR,
      max_heart_rate: activity.maxHR,
      calories: activity.calories,
      vo2_max: activity.vO2MaxValue,
      recovery_time: activity.recoveryTimeInMinutes,
      training_effect: activity.trainingEffect,
      power_data: JSON.stringify(activity.powerData || {}),
      gps_data: JSON.stringify(activity.gpsData || {}),
    };
    
    await this.db.execute({
      sql: `INSERT OR REPLACE INTO garmin_readings 
            (id, user_id, timestamp, device, activity_type, duration, distance, 
             elevation_gain, avg_speed, max_speed, avg_heart_rate, max_heart_rate, 
             calories, vo2_max, recovery_time, training_effect, power_data, gps_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: Object.values(activityData),
    });
    
    return activityData;
  }

  private async saveActivityScreenshot(data: any) {
    await this.db.execute({
      sql: `INSERT INTO activity_screenshots 
            (id, garmin_reading_id, user_id, screenshot_url, screenshot_thumbnail_url, 
             file_type, file_size, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: Object.values(data),
    });
  }

  // Método para obtener actividades con screenshots
  async getUserActivitiesWithScreenshots(userId: string, limit: number = 10) {
    const results = await this.db.execute({
      sql: `
        SELECT 
          gr.*,
          as.screenshot_url,
          as.screenshot_thumbnail_url,
          as.file_type,
          as.metadata as screenshot_metadata
        FROM garmin_readings gr
        LEFT JOIN activity_screenshots as ON gr.id = as.garmin_reading_id
        WHERE gr.user_id = ? AND gr.activity_type IS NOT NULL
        ORDER BY gr.timestamp DESC
        LIMIT ?
      `,
      args: [userId, limit],
    });
    
    // Agrupar screenshots por actividad
    const activities = {};
    
    for (const row of results.rows) {
      const activityId = row.id;
      
      if (!activities[activityId]) {
        activities[activityId] = {
          ...row,
          screenshots: [],
          files: [],
        };
        delete activities[activityId].screenshot_url;
        delete activities[activityId].screenshot_thumbnail_url;
        delete activities[activityId].file_type;
        delete activities[activityId].screenshot_metadata;
      }
      
      if (row.screenshot_url) {
        if (row.file_type === 'screenshot') {
          activities[activityId].screenshots.push({
            url: row.screenshot_url,
            thumbnail: row.screenshot_thumbnail_url,
            metadata: JSON.parse(row.screenshot_metadata || '{}'),
          });
        } else {
          activities[activityId].files.push({
            type: row.file_type,
            url: row.screenshot_url,
            size: row.file_size,
            metadata: JSON.parse(row.screenshot_metadata || '{}'),
          });
        }
      }
    }
    
    return Object.values(activities);
  }

  private async saveHealthMetrics(userId: string, metrics: any) {
    const metricsData = {
      id: uuidv4(),
      user_id: userId,
      timestamp: metrics.timestamp,
      hrv_data: JSON.stringify(metrics.hrv || {}),
      stress_level: metrics.stress?.stressLevel,
      body_battery: metrics.bodyBattery?.charged,
      sleep_data: JSON.stringify(metrics.sleep || {}),
    };
    
    await this.db.execute({
      sql: `INSERT INTO garmin_readings 
            (id, user_id, timestamp, hrv_data, stress_level, body_battery, sleep_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: Object.values(metricsData),
    });
  }

  private encryptPassword(password: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  private decryptPassword(encryptedData: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// src/habits/habits.service.ts - Gestión de hábitos
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

export enum HabitType {
  WATER = 'agua',
  SLEEP = 'sueño',
  CRYOTHERAPY = 'crioterapia',
  FASTING = 'ayuno',
  NUTRITION = 'alimentación',
  MEDITATION = 'meditación',
  EXERCISE = 'ejercicio',
  SUNLIGHT = 'luz_solar',
  SOCIAL = 'contacto_social',
  SUPPLEMENTS = 'suplementos',
  STRESS_MANAGEMENT = 'manejo_estres',
  OTHER = 'otros',
}

@Injectable()
export class HabitsService {
  constructor(
    @InjectRepository('DATABASE_CONNECTION')
    private db: any,
    private eventEmitter: EventEmitter2,
  ) {}

  async createHabit(userId: string, habitData: any) {
    const habit = {
      id: uuidv4(),
      user_id: userId,
      date: habitData.date || new Date().toISOString().split('T')[0],
      habit_type: habitData.habitType,
      value: JSON.stringify(habitData.value),
      note: habitData.note,
    };
    
    await this.db.execute({
      sql: `INSERT OR REPLACE INTO user_habits 
            (id, user_id, date, habit_type, value, note)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: Object.values(habit),
    });
    
    // Emitir evento para análisis
    this.eventEmitter.emit('habit.created', {
      userId,
      habitType: habit.habit_type,
      date: habit.date,
    });
    
    return habit;
  }

  async getUserHabits(userId: string, startDate?: Date, endDate?: Date) {
    const query = {
      sql: `SELECT * FROM user_habits 
            WHERE user_id = ? 
            ${startDate ? 'AND date >= ?' : ''} 
            ${endDate ? 'AND date <= ?' : ''}
            ORDER BY date DESC`,
      args: [userId, startDate, endDate].filter(Boolean),
    };
    
    const results = await this.db.execute(query);
    
    return results.rows.map(row => ({
      ...row,
      value: JSON.parse(row.value),
    }));
  }

  async getHabitStreak(userId: string, habitType: HabitType) {
    const results = await this.db.execute({
      sql: `SELECT date FROM user_habits 
            WHERE user_id = ? AND habit_type = ?
            ORDER BY date DESC`,
      args: [userId, habitType],
    });
    
    if (results.rows.length === 0) return 0;
    
    let streak = 0;
    let currentDate = new Date();
    
    for (const row of results.rows) {
      const habitDate = new Date(row.date);
      const dayDiff = Math.floor((currentDate - habitDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === streak) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  async getHabitAnalytics(userId: string, habitType: HabitType, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const results = await this.db.execute({
      sql: `SELECT date, value FROM user_habits 
            WHERE user_id = ? AND habit_type = ? AND date >= ?
            ORDER BY date ASC`,
      args: [userId, habitType, startDate.toISOString().split('T')[0]],
    });
    
    // Calcular estadísticas
    const values = results.rows.map(r => JSON.parse(r.value));
    const analytics = {
      totalDays: results.rows.length,
      completionRate: (results.rows.length / days) * 100,
      streak: await this.getHabitStreak(userId, habitType),
      trend: this.calculateTrend(values),
      lastEntry: results.rows[results.rows.length - 1]?.date,
    };
    
    return analytics;
  }

  private calculateTrend(values: any[]): string {
    if (values.length < 2) return 'neutral';
    
    // Simplificado: comparar primera mitad con segunda mitad
    const midpoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midpoint);
    const secondHalf = values.slice(midpoint);
    
    const avgFirst = this.calculateAverage(firstHalf);
    const avgSecond = this.calculateAverage(secondHalf);
    
    if (avgSecond > avgFirst * 1.1) return 'improving';
    if (avgSecond < avgFirst * 0.9) return 'declining';
    return 'stable';
  }

  private calculateAverage(values: any[]): number {
    // Implementar según el tipo de valor (booleano, numérico, etc.)
    if (values.length === 0) return 0;
    
    if (typeof values[0] === 'boolean') {
      return values.filter(v => v).length / values.length;
    }
    
    if (typeof values[0] === 'number') {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    
    return 0;
  }
}