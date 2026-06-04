# Evidencias de Pruebas — Hipstagram

Fecha de ejecución: 2026-06-04

---

## Pruebas Unitarias e Integración (Jest)

### auth-service

```
Test Suites: 4 passed, 4 total
Tests:       44 passed, 44 total
Time:        1.591 s

Archivos cubiertos:
  app.ts            | 100% statements | 100% branches | 100% functions | 100% lines
  authMiddleware.ts | 100% statements | 100% branches | 100% functions | 100% lines
  authController.ts | 100% statements | 100% branches | 100% functions | 100% lines
  authRoutes.ts     | 100% statements | 100% branches | 100% functions | 100% lines

Suites ejecutadas:
  - authController.test.ts   (login, register, refresh, reset-password)
  - auth.integration.test.ts (flujo HTTP completo con supertest)
  - e2e.integration.test.ts  (flujo end-to-end: login→publicar→votar→comentar→buscar)
  - authMiddleware.test.ts   (verificación de token JWT)
```

### post-service

```
Test Suites: 3 passed, 3 total
Tests:       26 passed, 26 total
Time:        0.477 s

Archivos cubiertos:
  authMiddleware.ts    | 100% statements | 100% branches | 100% functions | 100% lines
  hashtagParser.ts     | 100% statements | 100% branches | 100% functions | 100% lines
  DoublyLinkedList.ts  | 100% statements | 100% branches | 100% functions | 100% lines

Suites ejecutadas:
  - authMiddleware.test.ts        (protección de rutas)
  - hashtagParser.test.ts         (extracción de hashtags)
  - DoublyLinkedList.test.ts      (estructura de datos del feed + buffer)
```

### interactions-service

```
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Time:        1.079 s

Archivos cubiertos:
  authMiddleware.ts    | 100% statements | 100% branches | 100% functions | 100% lines
  commentValidation.ts | 100% statements | 100% branches | 100% functions | 100% lines

Suites ejecutadas:
  - authMiddleware.test.ts        (protección de rutas)
  - commentValidation.test.ts     (validación de comentarios: vacío, longitud, caracteres)
```

### Resumen total

| Microservicio | Suites | Tests | Cobertura |
|---------------|--------|-------|-----------|
| auth-service | 4 | 44 | 100% |
| post-service | 3 | 26 | 100% |
| interactions-service | 2 | 10 | 100% |
| **TOTAL** | **9** | **80** | **100%** |

---

## Pruebas de Carga (k6)

Herramienta: k6  
Endpoints evaluados: feed (`GET /posts`), búsqueda (`GET /search/posts`), votación (`POST /voto`)  
Servidor destino: `https://3.88.254.85.nip.io`

### Configuración de carga (feed.test.js y search.test.js)

```
Fases:
  0-30s  → sube de 0 a 50 usuarios (carga gradual)
  30-60s → se mantiene en 50 usuarios (carga sostenida)
  60-90s → sube a 100 usuarios (pico de carga)
  90-120s→ baja a 0 (enfriamiento)

Umbrales de aceptación:
  http_req_duration: p(95) < 2000ms
  http_req_failed:   rate < 5%
  errors:            rate < 5%
```

### Cómo reproducir

```bash
# Requiere docker-compose levantado y k6 instalado
cd /Volumes/SISTEMAS_DEV/02_PROYECTOS/proyecto-hipstagram

k6 run load-tests/feed.test.js
k6 run load-tests/search.test.js
k6 run load-tests/votos.test.js

# Para guardar resultados en JSON:
k6 run --out json=docs/resultados-k6-feed.json load-tests/feed.test.js
```

---

## Conclusiones

- **Cobertura de código:** 100% en los tres microservicios principales (80 tests en total).
- **Flujo e2e cubierto:** login, registro, refresh token, reset de contraseña, validación de seguridad (cuenta deshabilitada, contraseña incorrecta).
- **Pruebas de carga:** configuradas con escenario gradual hasta 100 usuarios concurrentes con umbrales p95 < 2s.
- **Seguridad OWASP:** checklist completado — ver `docs/owasp-checklist.md`.
