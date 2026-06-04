jest.mock('./db', () => ({ __esModule: true, default: { query: jest.fn() } }));

import request from 'supertest';
import app from './app';
import pool from './db';

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Search Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /posts', () => {
    it('devuelve resultados cuando hay coincidencias', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'post-1', descripcion: 'Foto de playa #verano', username: 'user1', likes: 5 },
          { id: 'post-2', descripcion: 'Viaje al mar #verano', username: 'user2', likes: 3 },
        ],
      } as any);

      const res = await request(app).get('/posts?q=verano');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('descripcion');
    });

    it('devuelve array vacío si no hay coincidencias', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app).get('/posts?q=terminoquenoexiste');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('devuelve 400 si no se envía término de búsqueda', async () => {
      const res = await request(app).get('/posts');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('devuelve 500 si la base de datos falla', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB caída'));

      const res = await request(app).get('/posts?q=test');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('busca por hashtag correctamente', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'post-3', descripcion: '#naturaleza en su estado puro', username: 'user3', likes: 10 }],
      } as any);

      const res = await request(app).get('/posts?q=%23naturaleza');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('devuelve múltiples campos por publicación', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'post-4', descripcion: 'test', username: 'user4', likes: 2, comentarios: [] }],
      } as any);

      const res = await request(app).get('/posts?q=test');

      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('username');
      expect(res.body[0]).toHaveProperty('likes');
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
