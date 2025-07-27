# 🧬 Agente 95+5 - Sistema de Longevidad con IA

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" />
  <img src="https://img.shields.io/badge/status-active-success.svg" />
  <img src="https://img.shields.io/badge/TRL-1-orange.svg" />
  <img src="https://img.shields.io/badge/license-MIT-purple.svg" />
</p>

<p align="center">
  <strong>"Morir joven lo más tarde posible"</strong><br>
  La fusión perfecta entre el esfuerzo humano (95%) y la inteligencia artificial (5%) para vivir hasta los 110 años con vitalidad
</p>

---

## 📋 Tabla de Contenidos

- [Introducción](#introducción)
- [Características](#características)
- [Arquitectura](#arquitectura)
- [Instalación Rápida](#instalación-rápida)
- [Uso](#uso)
- [API Documentation](#api-documentation)
- [Integraciones Wearables](#integraciones-wearables)
- [Desarrollo](#desarrollo)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## 🎯 Introducción

El **Agente 95+5** es un sistema revolucionario desarrollado por Felipe Pacheco fundador de Poweredia que fusiona el potencial humano con la inteligencia artificial para alcanzar una longevidad extraordinaria: vivir hasta los 110 años con una calidad de vida increíble.

### ¿Por qué 95+5?

- **95%**: Humano - Tu esfuerzo, dedicación y decisiones diarias
- **5%**: IA - El poder de la inteligencia artificial optimizando tu camino
- **Resultado**: La combinación perfecta para una vida larga y plena

### 🎯 Nuestra Filosofía

> **"Morir joven lo más tarde posible"**

No se trata solo de agregar años a tu vida, sino de agregar VIDA a tus años. Imagina:
- Escalar montañas a los 80 años
- Hacer mountain bike a los 90
- Mantener tu energía y vitalidad después de los 100
- Disfrutar cada momento con la misma intensidad que en tu juventud

### 🚀 La Fusión Perfecta

El Agente 95+5 representa la unión armoniosa entre:
- **Tu compromiso humano**: Ejercicio, nutrición, descanso, propósito
- **Precisión de la IA**: Análisis de datos, patrones, optimización continua
- **Resultado**: Un camino personalizado hacia los 110 años con vitalidad juvenil

### 🔬 Base Científica

- Hallmarks of Aging (López-Otín et al., 2023)
- Blue Zones Research (Dan Buettner)
- Stanford Longevity Studies
- Harvard Study of Adult Development
- Investigaciones en hormesis y resiliencia celular
- Estudios de centenarios y supercentenarios

### 💪 El Poder del 95% Humano

Tu dedicación diaria es la base de todo:
- **Movimiento**: Desde musculación hasta montañismo
- **Nutrición**: Alimentación consciente y personalizada  
- **Descanso**: Recuperación optimizada
- **Propósito**: Razones poderosas para vivir
- **Conexión**: Relaciones que nutren el alma

### 🤖 La Magia del 5% IA

La inteligencia artificial potencia tu esfuerzo:
- **Análisis preciso**: Procesamiento de miles de biomarcadores
- **Personalización extrema**: Tu plan único basado en tu genética y estilo de vida
- **Ajuste continuo**: Optimización diaria según tus resultados
- **Predicción inteligente**: Anticipando necesidades antes de que surjan
- **Conocimiento actualizado**: Acceso a las últimas investigaciones en longevidad

## ✨ Características

### Core Features

- 🧮 **Calculadora de Edad Biológica**: Evaluación basada en 10 factores clave
- 🤖 **Planes Personalizados con IA**: Generados por Claude 3 (Anthropic)
- 📊 **Dashboard Interactivo**: Visualización de progreso y métricas
- 🔄 **Sincronización con Wearables**: Garmin, Apple Watch, Fitbit, Oura
- 📈 **Tracking Automático**: Métricas de salud en tiempo real
- 🎯 **Ajuste Dinámico**: El plan evoluciona según tu progreso
- 🌎 **100% en Español**: Diseñado para LATAM

### Métricas Trackeadas

- Edad biológica vs cronológica
- VO2 Max y capacidad aeróbica
- Variabilidad cardíaca (HRV)
- Calidad del sueño
- Niveles de estrés
- Carga de entrenamiento
- Body Battery (Garmin)
- Recuperación post-ejercicio

## 🏗️ Arquitectura

```mermaid
graph TB
    subgraph "Frontend - Vercel"
        A[🏠 Landing Page] 
        B[📋 Assessment<br/>10 preguntas]
        C[📊 Dashboard]
        D[📈 Tracking]
        E[⚙️ Settings<br/>Integraciones]
    end
    
    subgraph "API Gateway"
        F[🔌 Express.js<br/>REST API]
    end
    
    subgraph "Backend Services"
        G[🧮 Age Calculator]
        H[🤖 AI Service<br/>Claude 3]
        I[📝 Plan Generator]
        J[📊 Metrics Service]
        K[🔄 Sync Service<br/>Wearables]
    end
    
    subgraph "Database"
        L[(🗄️ SQLite Dev<br/>PostgreSQL Prod)]
    end
    
    subgraph "Wearables APIs"
        M[⌚ Garmin Connect]
        N[🏃 Strava]
        O[💪 Apple Health]
        P[💍 Oura Ring]
    end
    
    subgraph "External APIs"
        Q[🧠 Anthropic<br/>Claude API]
        R[📧 SendGrid]
        S[📈 Google Analytics]
    end
    
    A --> B --> F
    C --> F
    D --> F
    E --> F
    
    F --> G --> L
    F --> H --> Q
    F --> I --> L
    F --> J --> L
    F --> K
    
    K --> M
    K --> N
    K --> O
    K --> P
    
    H --> I --> R
    C --> S
```

## ⚡ Instalación Rápida

### Prerequisitos

- Node.js 16+ 
- Git
- API Key de Anthropic ([obtener aquí](https://console.anthropic.com))
- (Opcional) Cuenta desarrollador Garmin Connect

### Setup en 3 minutos

```bash
# 1. Clonar repositorio
git clone https://github.com/poweredia/agente-95-5.git
cd agente-95-5

# 2. Ejecutar instalador automático
chmod +x setup.sh
./setup.sh

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu ANTHROPIC_API_KEY

# 4. Iniciar desarrollo
npm run dev
```

### Verificación

- 🌐 Frontend: http://localhost:3000
- 🔧 Backend: http://localhost:3001
- 📚 API Docs: http://localhost:3001/api-docs
- ❤️ Health Check: http://localhost:3001/api/health

## 🚀 Uso
## 📁 Código de arquitectura

- [Arquitectura Backend v2 (`NestJS`)](src/config/arquitectura-v2.ts)

### 1. Primera Evaluación

```bash
# Acceder al frontend
open http://localhost:3000

# O usar la API directamente
curl -X POST http://localhost:3001/api/assessment \
  -H "Content-Type: application/json" \
  -d '{
    "age": 35,
    "sleep_hours": 7.5,
    "exercise_frequency": 3,
    "stress_level": 5,
    "fruits_veggies": 5,
    "smoking": false,
    "bmi": 24.5,
    "energy_level": 7
  }'
```

### 2. Conectar Wearable

```javascript
// Ejemplo: Conectar Garmin
const connectGarmin = async () => {
  const response = await fetch('/api/wearables/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_type: 'garmin',
      device_model: 'Fenix 7'
    })
  });
  
  const { auth_url } = await response.json();
  window.location.href = auth_url; // Redirige a Garmin Connect
};
```

### 3. Ver Dashboard

El dashboard muestra automáticamente:
- Tu edad biológica actual
- Plan personalizado del día
- Métricas de wearables
- Progreso hacia objetivos

## 📖 API Documentation

### Endpoints Principales

#### `POST /api/users`
Crear nuevo usuario
```json
{
  "email": "usuario@ejemplo.com"
}
```

#### `POST /api/assessment`
Enviar evaluación inicial
```json
{
  "userId": "uuid",
  "assessment": {
    "chronological_age": 35,
    "sleep_hours": 7.5,
    "exercise_frequency": 3,
    // ... más campos
  }
}
```

#### `GET /api/users/:userId/plan`
Obtener plan personalizado actual

#### `POST /api/metrics`
Registrar métrica manual
```json
{
  "userId": "uuid",
  "metric_type": "sleep_hours",
  "value": 8.5
}
```

#### `POST /api/wearables/sync`
Sincronizar datos de wearables

### Webhooks

El sistema soporta webhooks para actualizaciones en tiempo real:

```javascript
// Configurar webhook
POST /api/webhooks
{
  "url": "https://tu-app.com/webhook",
  "events": ["workout.completed", "metrics.updated"]
}
```

## ⌚ Integraciones Wearables

### Garmin Connect

Perfecto para usuarios con Fenix 7, Forerunner, Edge, etc.

```bash
# Variables de entorno necesarias
GARMIN_CONSUMER_KEY=tu_consumer_key
GARMIN_CONSUMER_SECRET=tu_consumer_secret
```

**Datos sincronizados**:
- Entrenamientos (musculación, cardio, outdoor)
- Métricas de recuperación
- VO2 Max
- Body Battery
- Stress Level
- Sleep tracking

### Apple Health

```bash
# Requiere iOS app companion
APPLE_TEAM_ID=tu_team_id
APPLE_KEY_ID=tu_key_id
```

### Strava

```bash
STRAVA_CLIENT_ID=tu_client_id
STRAVA_CLIENT_SECRET=tu_client_secret
```

## 🛠️ Desarrollo

### Estructura del Proyecto

```
agente-95-5/
├── frontend/               # Next.js + React
│   ├── components/        # Componentes UI
│   ├── pages/            # Páginas de la app
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Utilidades
├── backend/               # Node.js + Express
│   ├── controllers/      # Lógica de negocio
│   ├── services/         # Servicios (IA, wearables)
│   ├── models/           # Modelos de datos
│   └── routes/           # Definición de rutas
├── database/              # Esquemas y migraciones
├── prompts/               # Prompts para Claude
├── tests/                 # Tests unitarios e integración
└── docs/                  # Documentación adicional
```

### Comandos de Desarrollo

```bash
# Desarrollo con hot-reload
npm run dev

# Solo frontend
npm run dev:frontend

# Solo backend
npm run dev:backend

# Ejecutar migraciones
npm run db:migrate

# Generar tipos TypeScript
npm run generate:types

# Linting y formato
npm run lint
npm run format
```

### Variables de Entorno

```bash
# .env.example
NODE_ENV=development
PORT=3001

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-... # Opcional, para comparación

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agente95

# Wearables
GARMIN_CONSUMER_KEY=...
GARMIN_CONSUMER_SECRET=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...

# Email
SENDGRID_API_KEY=...
FROM_EMAIL=hola@agente95.com

# Analytics
GOOGLE_ANALYTICS_ID=G-...
MIXPANEL_TOKEN=...
```

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests con coverage
npm run test:coverage

# Tests de integración
npm run test:integration

# Tests E2E
npm run test:e2e
```

### Ejemplo de Test

```javascript
// tests/age-calculator.test.js
describe('Age Calculator', () => {
  test('calcula edad biológica correctamente', () => {
    const profile = {
      chronological_age: 35,
      sleep_hours: 8,
      exercise_frequency: 4,
      stress_level: 3,
      // ...
    };
    
    const bioAge = calculateBiologicalAge(profile);
    expect(bioAge).toBeLessThan(35); // Perfil saludable
  });
});
```

## 🚀 Deployment

### Opción 1: Vercel + Railway (Recomendado)

```bash
# Frontend en Vercel
vercel --prod

# Backend en Railway
railway up
```

### Opción 2: Docker

```bash
# Build
docker-compose build

# Run
docker-compose up -d

# Scale
docker-compose up -d --scale backend=3
```

### Opción 3: AWS

```bash
# Deploy con Terraform
cd terraform/
terraform init
terraform plan
terraform apply
```

## 📅 Roadmap

### Q1 2025 ✅
- [x] MVP funcional (TRL 1)
- [x] Integración Garmin Connect
- [x] 100 early adopters
- [ ] Aplicación móvil React Native

### Q2 2025
- [ ] Integración con laboratorios (LabCorp, Quest)
- [ ] Recomendaciones de suplementación personalizadas
- [ ] Comunidad de usuarios
- [ ] 1,000 usuarios activos

### Q3 2025
- [ ] ML para predicciones avanzadas
- [ ] Integración con profesionales de salud
- [ ] Marketplace de servicios
- [ ] Serie Seed ($3M)

### Q4 2025
- [ ] Expansión internacional
- [ ] 10,000 usuarios
- [ ] B2B para empresas
- [ ] $100K MRR

## 🤝 Contribuir

¡Contribuciones son bienvenidas! Por favor lee [CONTRIBUTING.md](CONTRIBUTING.md) primero.

### Proceso

1. Fork el proyecto
2. Crea tu Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: nueva funcionalidad asombrosa'`)
4. Push al Branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Estilo de Código

- Usamos ESLint + Prettier
- Commits siguen [Conventional Commits](https://www.conventionalcommits.org/)
- Tests obligatorios para nuevas features

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🙏 Agradecimientos

- [Anthropic](https://anthropic.com) por Claude API
- [Garmin](https://developer.garmin.com) por su excelente API
- Comunidad Poweredia por el feedback continuo
- Y Combinator por la inspiración

## 📞 Contacto

- **Proyecto**: Agente 95+5
- **Empresa**: Poweredia
- **Website**: https://poweredia.com
- **Email**: agente95@poweredia.cl
- **Twitter**: 
- **LinkedIn**: [Poweredia](https://linkedin.com/company/poweredia)

---

<p align="center">
  Hecho con ❤️ por <a href="https://github.com/poweredia">Poweredia</a><br>
  "De la idea al agente en minutos"
</p>

<p align="center">
  <a href="#top">⬆️ Volver al inicio</a>
</p>
