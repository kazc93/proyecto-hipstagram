/**
 * PRUEBAS DE INTEGRACIÓN — Auth Service
 *
 * A diferencia de las pruebas unitarias (que testean una función aislada),
 * estas pruebas lanzan requests HTTP reales contra la aplicación Express completa:
 *
 *   Supertest → Router → Middleware → Controlador → (DB mockeada) → Respuesta JSON
 *
 * Se mockea únicamente la base de datos y los helpers externos (bcrypt, jwt, audit)
 * para no depender de infraestructura real en CI/CD.
 */

jest.mock('./config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('bcryptjs', () => ({ genSalt: jest.fn(), hash: jest.fn(), compare: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('tok_integración'), verify: jest.fn() }));
jest.mock('./services/auditHelper', () => ({ sendToAudit: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import app from './app';
import pool from './config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const mockPool = pool as jest.Mocked<typeof pool>;

const usuarioMock = {
  id: 'uuid-integ-1',
  username: 'integracion',
  email: 'integ@test.com',
  password_hash: 'hash_seguro',
  rol: 'USER',
  activo: true,
};

describe('Auth API — Integración', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── GET /health ─────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('responde 200 con status UP', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  // ── CORS ─────────────────────────────────────────────────────────────────
  describe('CORS', () => {
    it('permite requests desde orígenes autorizados', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://main.dyer5iztb0u8h.amplifyapp.com');
      expect(res.status).toBe(200);
    });

    it('rechaza requests desde orígenes no autorizados', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://sitio-malicioso.com');
      expect(res.status).toBe(500);
    });
  });

  // ── POST /register ──────────────────────────────────────────────────────
  describe('POST /register', () => {
    it('registra un usuario y devuelve 201 con los datos creados', async () => {
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash_seguro');
      const creado = { id: 'uuid-nuevo', username: 'nuevo', email: 'nuevo@test.com', rol: 'USER' };
      mockPool.query.mockResolvedValueOnce({ rows: [creado] } as any);

      const res = await request(app)
        .post('/register')
        .send({ username: 'nuevo', email: 'nuevo@test.com', password: 'pass123' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ username: 'nuevo', email: 'nuevo@test.com' });
    });

    it('devuelve 500 si la base de datos falla', async () => {
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      mockPool.query.mockRejectedValueOnce(new Error('DB caída'));

      const res = await request(app)
        .post('/register')
        .send({ username: 'x', email: 'x@x.com', password: '123' });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── POST /login ─────────────────────────────────────────────────────────
  describe('POST /login', () => {
    it('devuelve token y refreshToken con credenciales correctas (email)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [usuarioMock] } as any)  // SELECT usuario
        .mockResolvedValueOnce({ rows: [] } as any);             // UPDATE refresh_token
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/login')
        .send({ identifier: 'integ@test.com', password: 'pass123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toMatchObject({ username: 'integracion', rol: 'USER' });
    });

    it('devuelve token y refreshToken usando username como identifier', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [usuarioMock] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/login')
        .send({ identifier: 'integracion', password: 'pass123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('devuelve 401 si el usuario no existe', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/login')
        .send({ identifier: 'noexiste@test.com', password: '123' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('devuelve 401 si la contraseña es incorrecta', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [usuarioMock] } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const res = await request(app)
        .post('/login')
        .send({ identifier: 'integ@test.com', password: 'mal' });

      expect(res.status).toBe(401);
    });

    it('devuelve 403 si la cuenta está deshabilitada', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ ...usuarioMock, activo: false }] } as any);

      const res = await request(app)
        .post('/login')
        .send({ identifier: 'integ@test.com', password: '123' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('deshabilitada');
    });
  });

  // ── POST /refresh ────────────────────────────────────────────────────────
  describe('POST /refresh', () => {
    it('devuelve 401 si no se envía refreshToken', async () => {
      const res = await request(app).post('/refresh').send({});
      expect(res.status).toBe(401);
    });

    it('devuelve nuevo accessToken con refreshToken válido', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-integ-1' });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ refresh_token: 'rt_valido', rol: 'USER' }]
      } as any);

      const res = await request(app)
        .post('/refresh')
        .send({ refreshToken: 'rt_valido' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('devuelve 403 si el refreshToken expiró', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => { throw new Error('expired'); });

      const res = await request(app)
        .post('/refresh')
        .send({ refreshToken: 'token_expirado' });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /reset-password ─────────────────────────────────────────────────
  describe('POST /reset-password', () => {
    it('actualiza la contraseña y devuelve 200', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'uuid-integ-1' }] } as any)  // SELECT
        .mockResolvedValueOnce({ rows: [] } as any);                         // UPDATE
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('nueva_hash');

      const res = await request(app)
        .post('/reset-password')
        .send({ email: 'integ@test.com', username: 'integracion', nuevaPassword: 'nueva123' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('actualizada');
    });

    it('devuelve 404 si email y username no coinciden', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/reset-password')
        .send({ email: 'malo@test.com', username: 'nadie', nuevaPassword: '123' });

      expect(res.status).toBe(404);
    });
  });
});
