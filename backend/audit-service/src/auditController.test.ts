jest.mock('./config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

import request from 'supertest';
import express from 'express';
import { createAuditLog } from './controllers/auditController';
import pool from './config/db';

const mockPool = pool as jest.Mocked<typeof pool>;

// App mínima para testear el controlador sin levantar el index completo
const app = express();
app.use(express.json());
app.post('/log', createAuditLog);
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

describe('Audit Service — auditController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST /log', () => {
    it('guarda un registro de auditoría y devuelve 201', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app).post('/log').send({
        usuario_id: 'uuid-001',
        accion: 'LOGIN',
        detalles: 'Usuario inició sesión',
        ip_origen: '192.168.1.1',
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('guardado exitosamente');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('guarda registro con campos opcionales nulos', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app).post('/log').send({
        usuario_id: 'uuid-002',
        accion: 'POST_CREADO',
        detalles: 'Publicación creada',
      });

      expect(res.status).toBe(201);
    });

    it('devuelve 500 si la base de datos falla', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB caída'));

      const res = await request(app).post('/log').send({
        usuario_id: 'uuid-003',
        accion: 'VOTO',
        detalles: 'Voto registrado',
      });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('registra evento de COMENTAR_POST correctamente', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app).post('/log').send({
        usuario_id: 'uuid-004',
        accion: 'COMENTAR_POST',
        detalles: 'Usuario comentó en post abc',
        ip_origen: '10.0.0.1',
        actor_role: 'USER',
        entity_type: 'POST',
        entity_id: 'post-abc',
        result: 'EXITO',
      });

      expect(res.status).toBe(201);
    });

    it('registra evento de ADMIN con todos los campos', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app).post('/log').send({
        usuario_id: 'uuid-admin',
        accion: 'DESHABILITAR_USUARIO',
        detalles: 'Admin deshabilitó al usuario xyz',
        ip_origen: '10.0.0.2',
        actor_role: 'ADMIN',
        entity_type: 'USER',
        entity_id: 'uuid-xyz',
        result: 'EXITO',
        request_id: 'req-123',
      });

      expect(res.status).toBe(201);
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
