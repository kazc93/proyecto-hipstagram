jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import verificarToken, { AuthRequest } from './authMiddleware';

const buildReq = (authHeader?: string): AuthRequest =>
  ({ header: jest.fn().mockReturnValue(authHeader) } as unknown as AuthRequest);

const buildRes = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
};

const next: NextFunction = jest.fn();

describe('verificarToken (auth-service)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 401 cuando no se proporciona token', () => {
    const { res, status, json } = buildRes();
    verificarToken(buildReq(undefined), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Acceso denegado: No se proporcionó un token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 cuando el token es inválido o expirado', () => {
    (jwt.verify as jest.Mock).mockImplementationOnce(() => { throw new Error('invalid'); });

    const { res, status, json } = buildRes();
    verificarToken(buildReq('Bearer token_invalido'), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Token no válido o expirado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('llama a next() y asigna req.user cuando el token es válido', () => {
    const payload = { id: 'uuid-1', rol: 'USER' };
    (jwt.verify as jest.Mock).mockReturnValueOnce(payload);

    const req = buildReq('Bearer token_valido');
    const { res } = buildRes();
    verificarToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(payload);
  });

  it('extrae el token del header Authorization con formato Bearer', () => {
    const payload = { id: 'uuid-2', rol: 'ADMIN' };
    (jwt.verify as jest.Mock).mockReturnValueOnce(payload);

    const req = buildReq('Bearer mi_token_secreto');
    const { res } = buildRes();
    verificarToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(
      'mi_token_secreto',
      expect.any(String)
    );
    expect(next).toHaveBeenCalled();
  });
});
