jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({}) }));
jest.mock('aws-sdk', () => ({
  Rekognition: jest.fn().mockImplementation(() => ({
    detectModerationLabels: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ ModerationLabels: [] }),
    }),
  })),
}));
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify(['spam', 'fraude', 'insulto_ejemplo'])),
  writeFileSync: jest.fn(),
}));

import request from 'supertest';
import app from './app';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const TOKEN_ADMIN = 'Bearer token_admin';
const TOKEN_USER  = 'Bearer token_user';

describe('Moderation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(['spam', 'fraude', 'insulto_ejemplo']));
  });

  describe('POST /check — moderación de texto', () => {
    it('aprueba texto limpio', async () => {
      const res = await request(app).post('/check').send({ text: 'Hermosa foto de vacaciones' });

      expect(res.status).toBe(200);
      expect(res.body.clean).toBe(true);
      expect(res.body.details).toHaveLength(0);
    });

    it('bloquea texto con palabra prohibida', async () => {
      const res = await request(app).post('/check').send({ text: 'Esto es spam total' });

      expect(res.status).toBe(200);
      expect(res.body.clean).toBe(false);
      expect(res.body.details[0]).toContain('spam');
    });

    it('bloquea texto con palabra prohibida en mayúsculas', async () => {
      const res = await request(app).post('/check').send({ text: 'Esto es SPAM' });

      expect(res.status).toBe(200);
      expect(res.body.clean).toBe(false);
    });

    it('aprueba request sin texto', async () => {
      const res = await request(app).post('/check').send({});

      expect(res.status).toBe(200);
      expect(res.body.clean).toBe(true);
    });

    it('también responde en /moderation/check', async () => {
      const res = await request(app).post('/moderation/check').send({ text: 'foto bonita' });

      expect(res.status).toBe(200);
      expect(res.body.clean).toBe(true);
    });
  });

  describe('GET /words — lista de palabras prohibidas (solo ADMIN)', () => {
    it('ADMIN obtiene la lista de palabras', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });

      const res = await request(app).get('/words').set('Authorization', TOKEN_ADMIN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('spam');
    });

    it('USER no puede ver la lista', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });

      const res = await request(app).get('/words').set('Authorization', TOKEN_USER);

      expect(res.status).toBe(403);
    });

    it('sin token devuelve 401', async () => {
      const res = await request(app).get('/words');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /words — agregar palabra prohibida', () => {
    it('ADMIN agrega una palabra nueva', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });

      const res = await request(app)
        .post('/words')
        .set('Authorization', TOKEN_ADMIN)
        .send({ palabra: 'ofensa_nueva' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('agregada');
    });

    it('devuelve 400 si no se envía palabra', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });

      const res = await request(app)
        .post('/words')
        .set('Authorization', TOKEN_ADMIN)
        .send({});

      expect(res.status).toBe(400);
    });

    it('USER no puede agregar palabras', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });

      const res = await request(app)
        .post('/words')
        .set('Authorization', TOKEN_USER)
        .send({ palabra: 'test' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /words/:word', () => {
    it('ADMIN elimina una palabra', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-admin', rol: 'ADMIN' });

      const res = await request(app)
        .delete('/words/spam')
        .set('Authorization', TOKEN_ADMIN);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('eliminada');
    });

    it('USER no puede eliminar palabras', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-user', rol: 'USER' });

      const res = await request(app)
        .delete('/words/spam')
        .set('Authorization', TOKEN_USER);

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
