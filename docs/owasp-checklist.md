# Checklist de Seguridad OWASP — Hipstagram

Fecha de revisión: 2026-06-04  
Revisado por: Equipo de desarrollo

---

## A01 — Control de Acceso Roto

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Endpoints privados protegidos con JWT (`verificarToken`) | ✅ OK | `authMiddleware.ts` en auth, post e interactions service |
| Auditoría solo accesible por rol ADMIN | ✅ OK | `admin.component.html` + guard en backend |
| Usuarios solo pueden modificar sus propios recursos | ✅ OK | `req.user?.id` validado en cada mutación |
| No se expone información de otros usuarios en respuestas | ✅ OK | Queries filtran por `usuario_id` |

---

## A02 — Fallas Criptográficas

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Contraseñas almacenadas con hash bcrypt + salt | ✅ OK | `bcrypt.genSalt` + `bcrypt.hash` en `authController.ts` |
| No se almacenan contraseñas en texto plano | ✅ OK | Solo se guarda `password_hash` en DB |
| JWT firmado con secret de entorno (`JWT_SECRET`) | ✅ OK | `process.env.JWT_SECRET` en `authController.ts` |
| Comunicación HTTPS en producción | ✅ OK | Nginx con certificado SSL (nip.io) |

---

## A03 — Inyección

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Queries parametrizadas con `$1, $2...` (no concatenación) | ✅ OK | Todas las queries en pool.query usan parámetros |
| Validación de input en comentarios (longitud, vacío) | ✅ OK | `commentValidation.ts` en interactions-service |
| Sanitización de hashtags en descripción de post | ✅ OK | `hashtagParser.ts` en post-service |
| No se ejecutan comandos del sistema con input del usuario | ✅ OK | No se usa `exec` ni `spawn` con datos externos |

---

## A04 — Diseño Inseguro

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Límite de tamaño de archivo en uploads (10MB) | ✅ OK | `multer limits` en post-service |
| Moderación de contenido antes de publicar | ✅ OK | Llamada a `moderation-service` antes de INSERT |
| Roles diferenciados (USER / ADMIN) | ✅ OK | Campo `rol` en tabla usuarios |

---

## A05 — Configuración de Seguridad Incorrecta

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Header `X-Powered-By` deshabilitado | ✅ OK | `app.disable('x-powered-by')` en auth-service |
| Variables sensibles en `.env` (no en código) | ✅ OK | Uso de `dotenv` + `.env` fuera del repo |
| CORS configurado (acepta app móvil Capacitor) | ✅ OK | `capacitor://localhost` permitido en auth-service |

---

## A07 — Fallas de Autenticación

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Cuenta deshabilitada no puede hacer login | ✅ OK | Validación `activo === false` devuelve 403 |
| Token de acceso con expiración corta | ✅ OK | `expiresIn: '1h'` en JWT |
| Refresh token para renovar sesión | ✅ OK | Endpoint `POST /refresh` implementado |
| Reset de contraseña requiere email + username | ✅ OK | Doble validación en `POST /reset-password` |

---

## A09 — Fallas en Registro y Monitoreo

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Auditoría de eventos: login, posts, votos, comentarios | ✅ OK | `audit-service` recibe logs de todos los microservicios |
| Logs con IP de origen | ✅ OK | `ip_origen: req.ip` en cada llamada a auditoría |
| Correlation ID para trazabilidad entre servicios | ✅ OK | Header `x-correlation-id` en post-service |
| Panel de auditoría accesible solo para ADMIN | ✅ OK | Guard de rol en frontend y backend |

---

## Hallazgos y Recomendaciones

| # | Severidad | Descripción | Recomendación |
|---|-----------|-------------|---------------|
| 1 | Baja | CORS abierto a todos los orígenes en post e interactions service | Restringir a dominios conocidos en producción |
| 2 | Baja | No hay rate limiting en endpoints de login/registro | Agregar `express-rate-limit` para prevenir fuerza bruta |
| 3 | Info | El search-service no requiere autenticación para buscar | Evaluar si es intencional o debe requerir token |

---

**Conclusión:** La aplicación cumple los controles básicos de OWASP para los riesgos más críticos (A01–A05, A07, A09). Los hallazgos identificados son de severidad baja/informativa y no bloquean la operación del sistema.
