jest.mock('./db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({}) }));

import request from 'supertest';
import app from './app';
import jwt from 'jsonwebtoken';
import pool from './db';

const mockPool = pool as jest.Mocked<typeof pool>;

const TOKEN_ADMIN = 'Bearer token_admin';
const TOKEN_USER  = 'Bearer token_user';

describe('User Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET / — lista de usuarios (solo ADMIN)', () => {
    it('devuelve lista de usuarios si el rol es ADMIN', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'u1', username: 'admin', email: 'admin@test.com', rol: 'ADMIN', activo: true },
          { id: 'u2', username: 'user1', email: 'user1@test.com', rol: 'USER', activo: true },
        ],
      } as any);

      const res = await request(app).get('/').set('Authorization', TOKEN_ADMIN);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('devuelve 403 si el rol es USER', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });

      const res = await request(app).get('/').set('Authorization', TOKEN_USER);

      expect(res.status).toBe(403);
    });

    it('devuelve 403 si no hay token', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(403);
    });

    it('devuelve 500 si la DB falla', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });
      mockPool.query.mockRejectedValueOnce(new Error('DB caída'));

      const res = await request(app).get('/').set('Authorization', TOKEN_ADMIN);

      expect(res.status).toBe(500);
    });
  });

  describe('GET /perfil/:id', () => {
    it('devuelve el perfil del usuario por ID', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'uuid-user', username: 'usuario1', email: 'u1@test.com', rol: 'USER' }],
      } as any);

      const res = await request(app).get('/perfil/uuid-user').set('Authorization', TOKEN_USER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('username', 'usuario1');
    });

    it('devuelve 404 si el usuario no existe', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app).get('/perfil/no-existe').set('Authorization', TOKEN_USER);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /admin/status', () => {
    it('ADMIN puede deshabilitar un usuario', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .put('/admin/status')
        .set('Authorization', TOKEN_ADMIN)
        .send({ usuario_id: 'uuid-user', activo: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('desactivado');
    });

    it('ADMIN puede activar un usuario', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .put('/admin/status')
        .set('Authorization', TOKEN_ADMIN)
        .send({ usuario_id: 'uuid-user', activo: true });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('activado');
    });

    it('USER no puede cambiar estado', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });

      const res = await request(app)
        .put('/admin/status')
        .set('Authorization', TOKEN_USER)
        .send({ usuario_id: 'uuid-otro', activo: false });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /admin/role', () => {
    it('ADMIN puede cambiar rol de usuario', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .put('/admin/role')
        .set('Authorization', TOKEN_ADMIN)
        .send({ usuario_id: 'uuid-user', rol: 'ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('ADMIN');
    });

    it('USER no puede cambiar roles', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });

      const res = await request(app)
        .put('/admin/role')
        .set('Authorization', TOKEN_USER)
        .send({ usuario_id: 'uuid-otro', rol: 'ADMIN' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /health', () => {
    it('responde 200 con status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});
