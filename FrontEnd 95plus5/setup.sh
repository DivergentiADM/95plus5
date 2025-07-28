#!/bin/bash
# Script para crear la estructura completa del frontend 95plus5

# Crear estructura de carpetas
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(auth\)/auth/success
mkdir -p src/app/\(dashboard\)/habits
mkdir -p src/app/\(dashboard\)/activities
mkdir -p src/app/\(dashboard\)/labs
mkdir -p src/app/\(dashboard\)/insights
mkdir -p src/app/\(dashboard\)/metrics
mkdir -p src/app/\(dashboard\)/settings
mkdir -p src/components/ui
mkdir -p src/components/charts
mkdir -p src/components/forms
mkdir -p src/components/widgets
mkdir -p src/components/auth
mkdir -p src/components/layout
mkdir -p src/hooks
mkdir -p src/lib
mkdir -p src/store
mkdir -p src/types

# Crear archivos de configuración base
# ===========================================
# .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://95plus5.vercel.app/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# ===========================================
# .gitignore
cat > .gitignore << 'EOF'
# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
EOF

# ===========================================
# src/lib/api.ts
cat > src/lib/api.ts << 'EOF'
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await api.post('/auth/refresh', { refreshToken });
        
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        
        originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Redirigir a login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
EOF

# ===========================================
# src/lib/utils.ts
cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

# ===========================================
# src/types/index.ts
cat > src/types/index.ts << 'EOF'
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other';
}

export interface HealthScore {
  overall: number;
  trend: 'improving' | 'stable' | 'declining';
  components: {
    habits: number;
    sleep: number;
    stress: number;
    activity: number;
  };
}

export interface Habit {
  id: string;
  date: string;
  habit_type: string;
  value: any;
  quality_score?: number;
  energy_level?: number;
  note?: string;
}

export interface GarminActivity {
  id: string;
  timestamp: string;
  activity_type: string;
  duration: number;
  distance: number;
  calories: number;
  avg_heart_rate: number;
  screenshots: Array<{
    url: string;
    thumbnail: string;
    metadata: any;
  }>;
  files: Array<{
    type: string;
    url: string;
    size: number;
  }>;
}

export interface DashboardData {
  user: User;
  healthScore: HealthScore;
  habits: {
    summary: any[];
    streaks: Record<string, number>;
    consistency: number;
    recommendations: any[];
  };
  fitness: any;
  labTests: {
    available: any[];
    recent: any[];
  };
  insights: any[];
  alerts: {
    cortisol: any;
  };
}
EOF

# ===========================================
# src/store/auth.store.ts
cat > src/store/auth.store.ts << 'EOF'
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (idToken: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (idToken: string) => {
        try {
          const response = await api.post('/auth/google/token', { idToken });
          
          localStorage.setItem('access_token', response.data.access_token);
          localStorage.setItem('refresh_token', response.data.refresh_token);
          
          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      checkAuth: async () => {
        try {
          const token = localStorage.getItem('access_token');
          if (!token) {
            set({ isLoading: false });
            return;
          }

          const response = await api.get('/auth/me');
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
EOF

# ===========================================
# src/app/layout.tsx
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '95plus5 - Optimiza tu Salud y Longevidad',
  description: 'Plataforma integral de salud personalizada con IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
EOF

# ===========================================
# src/app/globals.css
cat > src/app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
EOF

# ===========================================
# src/components/providers.tsx
cat > src/components/providers.tsx << 'EOF'
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
EOF

# ===========================================
# src/middleware.ts
cat > src/middleware.ts << 'EOF'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/auth');

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
EOF

# ===========================================
# package.json - Actualizar scripts
cat > package.json << 'EOF'
{
  "name": "frontend-95plus5",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-query-devtools": "^5.0.0",
    "axios": "^1.6.0",
    "clsx": "^2.0.0",
    "date-fns": "^3.0.0",
    "framer-motion": "^10.0.0",
    "lucide-react": "^0.300.0",
    "next": "14.0.4",
    "react": "^18",
    "react-circular-progressbar": "^2.1.0",
    "react-dom": "^18",
    "react-hook-form": "^7.48.0",
    "recharts": "^2.10.0",
    "tailwind-merge": "^2.2.0",
    "zod": "^3.22.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.0.4",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "typescript": "^5"
  }
}
EOF

# ===========================================
# README.md
cat > README.md << 'EOF'
# Frontend 95plus5

Frontend para la plataforma de salud y longevidad personalizada 95plus5.

## 🚀 Tecnologías

- **Next.js 14** - Framework React con App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query** - Data fetching y caching
- **Zustand** - State management
- **React Hook Form + Zod** - Formularios y validación
- **Axios** - HTTP client
- **Lucide Icons** - Iconos

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Rutas de autenticación
│   └── (dashboard)/       # Rutas protegidas del dashboard
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes UI base
│   ├── charts/           # Gráficos
│   ├── forms/            # Formularios
│   └── widgets/          # Widgets del dashboard
├── hooks/                # Custom hooks
├── lib/                  # Utilidades y configuraciones
├── store/               # Estado global con Zustand
└── types/               # TypeScript types
```

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Iniciar en desarrollo
npm run dev
```

## 🔧 Variables de Entorno

```env
NEXT_PUBLIC_API_URL=https://95plus5.vercel.app/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📝 Scripts

- `npm run dev` - Iniciar en desarrollo
- `npm run build` - Build de producción
- `npm run start` - Iniciar servidor de producción
- `npm run lint` - Linting

## 🚀 Deploy

El proyecto está configurado para deploy automático en Vercel.

## 📄 Licencia

MIT
EOF

echo "✅ Estructura de carpetas y archivos creada exitosamente!"
echo "📝 Próximos pasos:"
echo "1. Ejecuta: npm install"
echo "2. Ejecuta: npm run dev"
echo "3. Abre http://localhost:3000"