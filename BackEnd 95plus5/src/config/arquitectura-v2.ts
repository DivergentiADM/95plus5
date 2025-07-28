// ========== ESTRUCTURA DEL PROYECTO ==========
/*
/src
  /auth                    ← Autenticación con Google OAuth
  /users                   ← Gestión de usuarios y perfiles
  /habits                  ← Tracking de hábitos saludables
  /garmin                  ← Integración con dispositivos Garmin
  /laboratory              ← Integración con Examedi y laboratorios
  /analytics               ← Motor de análisis y recomendaciones
  /ai-insights             ← Generación de insights personalizados
  /notifications           ← Sistema de alertas y notificaciones
  /database               
    /migrations            ← Migraciones de esquema
    /seeds                 ← Datos iniciales
  /common
    /decorators            ← Decoradores personalizados
    /guards                ← Guards de autenticación
    /interceptors          ← Interceptores globales
    /pipes                 ← Pipes de validación
  /config                  ← Configuración por ambiente
  /events                  ← Sistema de eventos
  /health                  ← Health checks
*/

// ========== src/main.ts - Punto de entrada ==========
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
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
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
  
  await app.listen(process.env.PORT || 3000);
}
bootstrap();

// ========== src/app.module.ts - Módulo principal ==========
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HabitsModule } from './habits/habits.module';
import { GarminModule } from './garmin/garmin.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiInsightsModule } from './ai-insights/ai-insights.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    HabitsModule,
    GarminModule,
    LaboratoryModule,
    AnalyticsModule,
    AiInsightsModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}

// ========== src/database/schema.sql - Esquema completo de Turso ==========
/*
-- Usuarios
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  birth_date DATE,
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  preferences JSON DEFAULT '{}',
  motivation_level INTEGER DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  deleted_at DATETIME
);

-- Hábitos saludables ampliados
CREATE TABLE user_habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  habit_type TEXT NOT NULL CHECK(habit_type IN (
    'agua', 'sueño', 'crioterapia', 'ayuno', 'alimentación', 
    'meditación', 'ejercicio', 'luz_solar', 'contacto_social',
    'sauna', 'masajes', 'respiración', 'journaling', 'grounding',
    'suplementos', 'cafeína', 'alcohol', 'otros'
  )),
  value JSON NOT NULL,
  duration_minutes INTEGER,
  quality_score INTEGER CHECK(quality_score BETWEEN 1 AND 10),
  energy_level INTEGER CHECK(energy_level BETWEEN 1 AND 10),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, date, habit_type)
);

-- Datos de Garmin mejorados
CREATE TABLE garmin_readings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  device TEXT,
  activity_type TEXT,
  -- Métricas de actividad
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
  -- Métricas de salud
  hrv_average INTEGER,
  hrv_sdrr INTEGER,
  stress_level INTEGER,
  body_battery INTEGER,
  -- Datos de sueño
  sleep_start DATETIME,
  sleep_end DATETIME,
  deep_sleep_minutes INTEGER,
  rem_sleep_minutes INTEGER,
  light_sleep_minutes INTEGER,
  awake_minutes INTEGER,
  sleep_score INTEGER,
  -- Datos adicionales
  power_data JSON,
  gps_data JSON,
  raw_data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabla para screenshots y archivos de actividad
CREATE TABLE activity_screenshots (
  id TEXT PRIMARY KEY,
  garmin_reading_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  screenshot_url TEXT,
  screenshot_thumbnail_url TEXT,
  file_type TEXT CHECK(file_type IN ('screenshot', 'gpx', 'fit', 'tcx')),
  file_size INTEGER,
  metadata JSON,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (garmin_reading_id) REFERENCES garmin_readings(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Resultados de laboratorio
CREATE TABLE lab_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  order_id TEXT,
  test_date DATE NOT NULL,
  test_type TEXT NOT NULL,
  pack_id TEXT,
  results JSON NOT NULL,
  pdf_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Biomarcadores individuales para búsquedas optimizadas
CREATE TABLE biomarkers (
  id TEXT PRIMARY KEY,
  lab_result_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  biomarker_name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  reference_min REAL,
  reference_max REAL,
  status TEXT CHECK(status IN ('low', 'normal', 'high', 'critical')),
  test_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lab_result_id) REFERENCES lab_results(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insights generados por IA
CREATE TABLE ai_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  insight_type TEXT NOT NULL CHECK(insight_type IN (
    'daily', 'weekly', 'monthly', 'alert', 'achievement', 'recommendation'
  )),
  category TEXT CHECK(category IN (
    'sleep', 'stress', 'exercise', 'nutrition', 'recovery', 'biomarkers', 'general'
  )),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendations JSON NOT NULL,
  priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  action_items JSON,
  tags JSON,
  read_at DATETIME,
  dismissed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Alertas de cortisol acumulado y otros indicadores
CREATE TABLE health_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK(alert_type IN (
    'cortisol_elevated', 'poor_sleep_pattern', 'low_hrv_trend',
    'missing_habits', 'biomarker_abnormal', 'recovery_needed'
  )),
  severity TEXT CHECK(severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  data JSON,
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME,
  resolved_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Objetivos personalizados
CREATE TABLE user_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  target_value JSON NOT NULL,
  current_value JSON,
  deadline DATE,
  status TEXT CHECK(status IN ('active', 'completed', 'paused', 'failed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Índices para optimización
CREATE INDEX idx_habits_user_date ON user_habits(user_id, date);
CREATE INDEX idx_garmin_user_timestamp ON garmin_readings(user_id, timestamp);
CREATE INDEX idx_biomarkers_user_name ON biomarkers(user_id, biomarker_name);
CREATE INDEX idx_insights_user_type ON ai_insights(user_id, insight_type);
CREATE INDEX idx_alerts_user_type ON health_alerts(user_id, alert_type);
*/

// ========== src/database/database.module.ts - Configuración Turso ==========
import { Module, Global } from '@nestjs/common';
import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

@Global()
@Module({
  providers: [
    {
      provide: 'TURSO_CONNECTION',
      useFactory: async () => {
        const client = createClient({
          url: process.env.TURSO_DATABASE_URL || 'file:local.db',
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        
        // Ejecutar migraciones al iniciar
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Dividir por statements y ejecutar
        const statements = schema.split(';').filter(s => s.trim());
        for (const statement of statements) {
          await client.execute(statement);
        }
        
        return client;
      },
    },
  ],
  exports: ['TURSO_CONNECTION'],
})
export class DatabaseModule {}

// ========== src/habits/habits.service.ts - Servicio de hábitos mejorado ==========
import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { CreateHabitDto, HabitType } from './dto/create-habit.dto';

@Injectable()
export class HabitsService {
  constructor(
    @Inject('TURSO_CONNECTION') private db: any,
    private eventEmitter: EventEmitter2,
  ) {}

  // Categorías de hábitos ampliadas
  private habitCategories = {
    hydration: ['agua'],
    nutrition: ['alimentación', 'ayuno', 'suplementos'],
    recovery: ['crioterapia', 'sauna', 'masajes', 'descanso_activo'],
    sleep: ['sueño'],
    stress: ['meditación', 'journaling', 'respiración', 'contacto_social'],
    nature: ['luz_solar', 'grounding'],
    stimulants: ['cafeína', 'alcohol'],
  };

  async createHabit(userId: string, habitData: CreateHabitDto) {
    const habit = {
      id: uuidv4(),
      user_id: userId,
      date: habitData.date || new Date().toISOString().split('T')[0],
      habit_type: habitData.habitType,
      value: JSON.stringify(habitData.value),
      duration_minutes: habitData.durationMinutes,
      quality_score: habitData.qualityScore,
      energy_level: habitData.energyLevel,
      note: habitData.note,
    };
    
    await this.db.execute({
      sql: `INSERT OR REPLACE INTO user_habits 
            (id, user_id, date, habit_type, value, duration_minutes, 
             quality_score, energy_level, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: Object.values(habit),
    });
    
    // Analizar patrones de hábitos
    await this.analyzeHabitPatterns(userId, habitData.habitType);
    
    // Emitir evento para análisis en tiempo real
    this.eventEmitter.emit('habit.tracked', {
      userId,
      habit,
      timestamp: new Date(),
    });
    
    return habit;
  }

  async getUserHabitsSummary(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const habits = await this.db.execute({
      sql: `SELECT habit_type, COUNT(*) as count, 
            AVG(quality_score) as avg_quality,
            AVG(energy_level) as avg_energy
            FROM user_habits 
            WHERE user_id = ? AND date >= ?
            GROUP BY habit_type`,
      args: [userId, startDate.toISOString().split('T')[0]],
    });
    
    const streaks = await this.calculateAllStreaks(userId);
    const consistency = await this.calculateConsistencyScore(userId, days);
    
    return {
      summary: habits.rows,
      streaks,
      consistency,
      recommendations: await this.generateHabitRecommendations(userId),
    };
  }

  async analyzeHabitPatterns(userId: string, habitType: string) {
    // Analizar correlaciones entre hábitos y métricas
    const correlations = await this.db.execute({
      sql: `
        SELECT 
          h.habit_type,
          AVG(h.energy_level) as avg_energy,
          AVG(g.hrv_average) as avg_hrv,
          AVG(g.stress_level) as avg_stress,
          AVG(g.sleep_score) as avg_sleep_score
        FROM user_habits h
        LEFT JOIN garmin_readings g 
          ON h.user_id = g.user_id 
          AND DATE(g.timestamp) = h.date
        WHERE h.user_id = ? 
          AND h.date >= date('now', '-30 days')
        GROUP BY h.habit_type
      `,
      args: [userId],
    });
    
    // Si detectamos patrones negativos, generar alerta
    for (const row of correlations.rows) {
      if (row.avg_stress > 70 || row.avg_hrv < 30) {
        await this.createHealthAlert(userId, 'stress_pattern', row);
      }
    }
  }

  private async calculateAllStreaks(userId: string) {
    const streaks = {};
    
    for (const [category, types] of Object.entries(this.habitCategories)) {
      let maxStreak = 0;
      
      for (const type of types) {
        const streak = await this.calculateStreak(userId, type);
        maxStreak = Math.max(maxStreak, streak);
      }
      
      streaks[category] = maxStreak;
    }
    
    return streaks;
  }

  private async calculateStreak(userId: string, habitType: string): Promise<number> {
    const results = await this.db.execute({
      sql: `SELECT date FROM user_habits 
            WHERE user_id = ? AND habit_type = ?
            ORDER BY date DESC`,
      args: [userId, habitType],
    });
    
    if (results.rows.length === 0) return 0;
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const row of results.rows) {
      const habitDate = new Date(row.date);
      habitDate.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((currentDate - habitDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === streak) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (dayDiff > streak) {
        break;
      }
    }
    
    return streak;
  }

  private async calculateConsistencyScore(userId: string, days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const results = await this.db.execute({
      sql: `SELECT COUNT(DISTINCT date) as days_with_habits
            FROM user_habits 
            WHERE user_id = ? AND date >= ?`,
      args: [userId, startDate.toISOString().split('T')[0]],
    });
    
    const daysWithHabits = results.rows[0]?.days_with_habits || 0;
    return Math.round((daysWithHabits / days) * 100);
  }

  private async generateHabitRecommendations(userId: string) {
    // Analizar qué hábitos faltan y cuáles tienen mejor impacto
    const missingHabits = await this.db.execute({
      sql: `
        SELECT habit_type, MAX(date) as last_date
        FROM user_habits
        WHERE user_id = ?
        GROUP BY habit_type
        HAVING last_date < date('now', '-3 days')
      `,
      args: [userId],
    });
    
    const recommendations = [];
    
    for (const habit of missingHabits.rows) {
      recommendations.push({
        type: 'missing_habit',
        habit: habit.habit_type,
        message: `No has registrado ${habit.habit_type} en los últimos 3 días`,
        priority: 'medium',
      });
    }
    
    return recommendations;
  }

  private async createHealthAlert(userId: string, alertType: string, data: any) {
    const alert = {
      id: uuidv4(),
      user_id: userId,
      alert_type: alertType,
      severity: this.calculateSeverity(alertType, data),
      message: this.generateAlertMessage(alertType, data),
      data: JSON.stringify(data),
    };
    
    await this.db.execute({
      sql: `INSERT INTO health_alerts 
            (id, user_id, alert_type, severity, message, data)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: Object.values(alert),
    });
    
    this.eventEmitter.emit('health.alert.created', alert);
  }

  private calculateSeverity(alertType: string, data: any): string {
    // Lógica para determinar severidad según tipo y datos
    if (data.avg_stress > 80) return 'critical';
    if (data.avg_stress > 60) return 'warning';
    return 'info';
  }

  private generateAlertMessage(alertType: string, data: any): string {
    const messages = {
      stress_pattern: `Detectamos niveles elevados de estrés. Tu promedio es ${data.avg_stress}/100`,
      poor_sleep: `Tu calidad de sueño ha disminuido. Promedio: ${data.avg_sleep_score}/100`,
      low_hrv: `Tu variabilidad cardíaca está baja. Promedio: ${data.avg_hrv}ms`,
    };
    
    return messages[alertType] || 'Alerta de salud detectada';
  }

  // Análisis diario automatizado
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async dailyHabitAnalysis() {
    const users = await this.db.execute('SELECT id FROM users WHERE deleted_at IS NULL');
    
    for (const user of users.rows) {
      await this.analyzeUserHabits(user.id);
    }
  }

  private async analyzeUserHabits(userId: string) {
    const summary = await this.getUserHabitsSummary(userId, 7);
    
    // Generar insights basados en el resumen
    if (summary.consistency < 50) {
      await this.createHealthAlert(userId, 'missing_habits', {
        consistency: summary.consistency,
        message: 'Tu consistencia de hábitos está baja esta semana',
      });
    }
    
    // Emitir evento para generar insights de IA
    this.eventEmitter.emit('habits.weekly.analyzed', {
      userId,
      summary,
    });
  }
}
