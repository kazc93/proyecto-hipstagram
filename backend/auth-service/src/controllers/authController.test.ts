jest.mock('../config/db', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('bcryptjs', () => ({ genSalt: jest.fn(), hash: jest.fn(), compare: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('mock_token'), verify: jest.fn() }));
jest.mock('../services/auditHelper', () => ({ sendToAudit: jest.fn().mockResolvedValue(undefined) }));

import { Request, Response } from 'express';
import { register, login, refresh } from './authController';
import pool from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendToAudit } from '../services/auditHelper';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockSendToAudit = sendToAudit as jest.MockedFunction<typeof sendToAudit>;

const buildReq = (body: object, headers: object = {}): Partial<Request> => ({
  body,
  headers: headers as any,
  ip: '127.0.0.1',
});

const buildRes = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
};

const mockUser = {
  id: 'uuid-test-1',
  username: 'testuser',
  email: 'test@test.com',
  password_hash: 'hashedpwd',
  rol: 'USER',
  activo: true,
};

describe('AuthController', () => {
  beforeEach(() => jest.clearAllMocks());

  // ───────────── register ─────────────
  describe('register', () => {
    it('crea usuario, responde 201 y audita REGISTRO_USUARIO', async () => {
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = { id: 'uuid-new', username: 'nuevo', email: 'n@n.com', rol: 'USER' };
      mockPool.query.mockResolvedValueOnce({ rows: [created] } as any);

      const { res, status, json } = buildRes();
      await register(buildReq({ username: 'nuevo', email: 'n@n.com', password: '123' }) as Request, res);

      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(created);
      expect(mockSendToAudit).toHaveBeenCalledWith('uuid-new', 'REGISTRO_USUARIO', expect.any(String), undefined, expect.objectContaining({ entity_type: 'USUARIO', result: 'EXITO' }));
    });

    it('retorna 500 si la base de datos falla', async () => {
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPool.query.mockRejectedValueOnce(new Error('DB error'));

      const { res, status } = buildRes();
      await register(buildReq({ username: 'x', email: 'x@x.com', password: '123' }) as Request, res);

      expect(status).toHaveBeenCalledWith(500);
    });
  });

  // ───────────── login ─────────────
  describe('login', () => {
    it('retorna access token y refresh token para credenciales válidas', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockUser] } as any)   // SELECT usuario
        .mockResolvedValueOnce({ rows: [] } as any);           // UPDATE refresh_token
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const { res, json } = buildRes();
      await login(buildReq({ email: 'test@test.com', password: '123' }) as Request, res);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'mock_token', refreshToken: 'mock_token' }),
      );
      expect(mockSendToAudit).toHaveBeenCalledWith('uuid-test-1', 'LOGIN_EXITOSO', expect.any(String), undefined, expect.objectContaining({ entity_type: 'SESION', result: 'EXITO' }));
    });

    it('retorna 401 y audita LOGIN_FALLIDO cuando el usuario no existe', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const { res, status } = buildRes();
      await login(buildReq({ email: 'noexiste@test.com', password: '123' }) as Request, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(mockSendToAudit).toHaveBeenCalledWith(null, 'LOGIN_FALLIDO', expect.any(String), undefined, expect.objectContaining({ result: 'FALLO' }));
    });

    it('retorna 401 y audita LOGIN_FALLIDO con contraseña incorrecta', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const { res, status } = buildRes();
      await login(buildReq({ email: 'test@test.com', password: 'wrong' }) as Request, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(mockSendToAudit).toHaveBeenCalledWith('uuid-test-1', 'LOGIN_FALLIDO', expect.any(String), undefined, expect.objectContaining({ result: 'FALLO' }));
    });

    it('retorna 403 y NO audita cuando el usuario está inactivo', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ ...mockUser, activo: false }] } as any);

      const { res, status } = buildRes();
      await login(buildReq({ email: 'test@test.com', password: '123' }) as Request, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(mockSendToAudit).not.toHaveBeenCalled();
    });

    it('retorna 500 si la base de datos falla', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB error'));

      const { res, status } = buildRes();
      await login(buildReq({ email: 'test@test.com', password: '123' }) as Request, res);

      expect(status).toHaveBeenCalledWith(500);
    });
  });

  // ───────────── refresh ─────────────
  describe('refresh', () => {
    it('retorna 401 si no se envía refreshToken', async () => {
      const { res, status } = buildRes();
      await refresh(buildReq({}) as Request, res);
      expect(status).toHaveBeenCalledWith(401);
    });

    it('retorna 403 si el refreshToken es inválido o expirado', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => { throw new Error('invalid token'); });

      const { res, status } = buildRes();
      await refresh(buildReq({ refreshToken: 'bad_token' }) as Request, res);
      expect(status).toHaveBeenCalledWith(403);
    });

    it('retorna 403 si el usuario no existe en DB', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-test-1' });
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const { res, status } = buildRes();
      await refresh(buildReq({ refreshToken: 'some_token' }) as Request, res);
      expect(status).toHaveBeenCalledWith(403);
    });

    it('retorna 403 si el refreshToken no coincide con el guardado en DB', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-test-1' });
      mockPool.query.mockResolvedValueOnce({ rows: [{ refresh_token: 'otro_token', rol: 'USER' }] } as any);

      const { res, status } = buildRes();
      await refresh(buildReq({ refreshToken: 'mi_token' }) as Request, res);
      expect(status).toHaveBeenCalledWith(403);
    });

    it('retorna nuevo access token para un refreshToken válido', async () => {
      (jwt.verify as jest.Mock).mockReturnValueOnce({ id: 'uuid-test-1' });
      mockPool.query.mockResolvedValueOnce({ rows: [{ refresh_token: 'valid_refresh', rol: 'USER' }] } as any);

      const { res, json } = buildRes();
      await refresh(buildReq({ refreshToken: 'valid_refresh' }) as Request, res);
      expect(json).toHaveBeenCalledWith({ token: 'mock_token' });
    });
  });
});
