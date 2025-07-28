// ========== src/common/services/s3.service.ts ==========
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET');
  }

  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    });

    await this.s3Client.send(command);
    
    // Retornar URL firmada con expiración de 7 días
    return this.getSignedUrl(key);
  }

  async getSignedUrl(key: string, expiresIn: number = 604800): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }
}

// ========== src/garmin/dto/activity-response.dto.ts ==========
export class ActivityWithScreenshotsDto {
  id: string;
  timestamp: Date;
  activity_type: string;
  duration: number;
  distance: number;
  calories: number;
  avg_heart_rate: number;
  
  screenshots: Array<{
    url: string;
    thumbnail: string;
    metadata: {
      activity_id: string;
      activity_type: string;
      capture_date: string;
      has_map: boolean;
      has_graphs: boolean;
    };
  }>;
  
  files: Array<{
    type: 'gpx' | 'fit' | 'tcx';
    url: string;
    size: number;
    metadata: any;
  }>;
}

// ========== src/garmin/garmin.controller.ts ==========
import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GarminService } from './garmin.service';

@ApiTags('Garmin')
@Controller('api/v1/garmin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GarminController {
  constructor(private garminService: GarminService) {}

  @Post('connect')
  @ApiOperation({ summary: 'Conectar cuenta de Garmin' })
  async connectGarminAccount(
    @CurrentUser() user: any,
    @Body() dto: { email: string; password: string },
  ) {
    return this.garminService.connectUserAccount(user.id, dto.email, dto.password);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar datos de Garmin' })
  async syncGarminData(@CurrentUser() user: any) {
    return this.garminService.syncUserData(user.id);
  }

  @Get('activities')
  @ApiOperation({ summary: 'Obtener actividades con screenshots' })
  async getActivitiesWithScreenshots(
    @CurrentUser() user: any,
    @Query('limit') limit: number = 10,
  ) {
    return this.garminService.getUserActivitiesWithScreenshots(user.id, limit);
  }

  @Get('activity/:id/screenshots')
  @ApiOperation({ summary: 'Obtener screenshots de una actividad específica' })
  async getActivityScreenshots(
    @CurrentUser() user: any,
    @Param('id') activityId: string,
  ) {
    return this.garminService.getActivityScreenshots(user.id, activityId);
  }

  @Get('metrics/latest')
  @ApiOperation({ summary: 'Obtener métricas más recientes' })
  async getLatestMetrics(@CurrentUser() user: any) {
    return this.garminService.getLatestMetrics(user.id);
  }

  @Get('metrics/trends')
  @ApiOperation({ summary: 'Obtener tendencias de métricas' })
  async getMetricsTrends(
    @CurrentUser() user: any,
    @Query('days') days: number = 30,
  ) {
    return this.garminService.getMetricsTrends(user.id, days);
  }
}

// ========== src/controllers/health-dashboard.controller.ts (actualizado) ==========
@Get('activity-gallery')
@ApiOperation({ summary: 'Obtener galería de actividades con visualizaciones' })
async getActivityGallery(
  @CurrentUser() user: any,
  @Query('type') activityType?: string,
  @Query('dateFrom') dateFrom?: string,
  @Query('dateTo') dateTo?: string,
) {
  const activities = await this.garminService.getUserActivitiesWithScreenshots(user.id, 20);
  
  // Filtrar por tipo si se especifica
  let filtered = activities;
  if (activityType) {
    filtered = activities.filter(a => a.activity_type === activityType);
  }
  
  // Filtrar por fechas si se especifican
  if (dateFrom || dateTo) {
    filtered = filtered.filter(a => {
      const actDate = new Date(a.timestamp);
      if (dateFrom && actDate < new Date(dateFrom)) return false;
      if (dateTo && actDate > new Date(dateTo)) return false;
      return true;
    });
  }
  
  // Enriquecer con estadísticas
  const enrichedActivities = filtered.map(activity => ({
    ...activity,
    performance_metrics: this.calculatePerformanceMetrics(activity),
    personal_records: this.checkPersonalRecords(user.id, activity),
  }));
  
  return {
    activities: enrichedActivities,
    summary: {
      total_activities: enrichedActivities.length,
      total_distance: enrichedActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
      total_duration: enrichedActivities.reduce((sum, a) => sum + (a.duration || 0), 0),
      total_calories: enrichedActivities.reduce((sum, a) => sum + (a.calories || 0), 0),
      activity_types: [...new Set(enrichedActivities.map(a => a.activity_type))],
    },
  };
}

@Get('weekly-summary-visual')
@ApiOperation({ summary: 'Resumen visual semanal con gráficos' })
async getWeeklyVisualSummary(@CurrentUser() user: any) {
  const weekData = await this.analyticsService.getWeeklyData(user.id);
  
  return {
    // Datos para gráfico de actividad semanal
    activity_chart: {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [
        {
          label: 'Minutos de Actividad',
          data: weekData.dailyActivityMinutes,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
        {
          label: 'Calorías',
          data: weekData.dailyCalories,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
      ],
    },
    
    // Datos para gráfico de sueño
    sleep_chart: {
      labels: weekData.dates,
      datasets: [
        {
          label: 'Horas de Sueño',
          data: weekData.sleepHours,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
        },
        {
          label: 'Calidad del Sueño',
          data: weekData.sleepQuality,
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
        },
      ],
    },
    
    // Datos para gráfico de estrés/recuperación
    recovery_chart: {
      labels: weekData.dates,
      datasets: [
        {
          label: 'HRV',
          data: weekData.hrvValues,
          borderColor: 'rgb(54, 162, 235)',
        },
        {
          label: 'Body Battery',
          data: weekData.bodyBattery,
          borderColor: 'rgb(255, 206, 86)',
        },
        {
          label: 'Nivel de Estrés',
          data: weekData.stressLevels,
          borderColor: 'rgb(255, 99, 132)',
        },
      ],
    },
    
    // Heatmap de hábitos
    habits_heatmap: {
      data: weekData.habitsHeatmap,
      categories: ['Agua', 'Ejercicio', 'Meditación', 'Sueño', 'Nutrición'],
      colors: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    },
    
    // Screenshots destacados de la semana
    featured_activities: weekData.topActivities.map(activity => ({
      id: activity.id,
      type: activity.activity_type,
      date: activity.timestamp,
      screenshot: activity.screenshots[0]?.url,
      thumbnail: activity.screenshots[0]?.thumbnail,
      highlights: {
        distance: activity.distance,
        duration: activity.duration,
        calories: activity.calories,
        achievement: activity.personal_record ? 'Nuevo Record Personal!' : null,
      },
    })),
    
    // Resumen de logros
    achievements: {
      streaks: weekData.activeStreaks,
      personal_records: weekData.personalRecords,
      goals_completed: weekData.goalsCompleted,
      consistency_score: weekData.overallConsistency,
    },
  };
}

private calculatePerformanceMetrics(activity: any) {
  const metrics = {
    pace: activity.distance && activity.duration 
      ? (activity.duration / 60) / (activity.distance / 1000) 
      : null,
    speed: activity.avg_speed || null,
    heart_rate_zones: this.calculateHeartRateZones(activity),
    efficiency_score: this.calculateEfficiencyScore(activity),
  };
  
  return metrics;
}

private calculateHeartRateZones(activity: any) {
  if (!activity.avg_heart_rate || !activity.max_heart_rate) return null;
  
  // Simplified zone calculation
  const maxHR = 220 - 30; // Assuming age 30, should get from user profile
  
  return {
    zone1: activity.avg_heart_rate < maxHR * 0.5 ? 100 : 0,
    zone2: activity.avg_heart_rate >= maxHR * 0.5 && activity.avg_heart_rate < maxHR * 0.6 ? 100 : 0,
    zone3: activity.avg_heart_rate >= maxHR * 0.6 && activity.avg_heart_rate < maxHR * 0.7 ? 100 : 0,
    zone4: activity.avg_heart_rate >= maxHR * 0.7 && activity.avg_heart_rate < maxHR * 0.8 ? 100 : 0,
    zone5: activity.avg_heart_rate >= maxHR * 0.8 ? 100 : 0,
  };
}

private calculateEfficiencyScore(activity: any): number {
  // Simplified efficiency calculation
  if (!activity.distance || !activity.avg_heart_rate || !activity.calories) return 0;
  
  const distanceKm = activity.distance / 1000;
  const caloriesPerKm = activity.calories / distanceKm;
  const hrPerKm = activity.avg_heart_rate / distanceKm;
  
  // Lower calories and HR per km = more efficient
  const efficiencyScore = Math.max(0, 100 - (caloriesPerKm / 10) - (hrPerKm / 2));
  
  return Math.round(efficiencyScore);
}

private async checkPersonalRecords(userId: string, activity: any) {
  // Check if this activity set any personal records
  // Simplified implementation
  return {
    is_pr: false,
    pr_type: null,
    previous_best: null,
  };
}

// ========== Actualización de configuración de módulos ==========
// En src/garmin/garmin.module.ts
import { Module } from '@nestjs/common';
import { GarminService } from './garmin.service';
import { GarminController } from './garmin.controller';
import { S3Service } from '../common/services/s3.service';

@Module({
  controllers: [GarminController],
  providers: [GarminService, S3Service],
  exports: [GarminService],
})
export class GarminModule {}

// ========== Agregar a .env ==========
/*
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=95plus5-user-data

# O usar almacenamiento local para desarrollo
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
*/