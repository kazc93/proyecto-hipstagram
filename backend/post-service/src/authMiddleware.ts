import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: { id: string; rol: string };
}

const verificarToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.header('Authorization');
    if (!token) return res.status(403).json({ message: "Acceso denegado" });

    try {
        const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'hipstagram_jwt_secret_2026');
        req.user = verified as { id: string; rol: string };
        next();
    } catch (err) {
        res.status(401).json({ message: "Token no válido" });
    }
};

export default verificarToken;