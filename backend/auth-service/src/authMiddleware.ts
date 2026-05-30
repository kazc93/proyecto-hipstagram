import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any;
}

// Verifica el token JWT del header Authorization y adjunta el usuario a la petición
const verificarToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado: No se proporcionó un token' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'hipstagram_jwt_secret_2026');
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token no válido o expirado' });
    }
};

export default verificarToken;
