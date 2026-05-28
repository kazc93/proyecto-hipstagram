import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserPayload } from './interfaces/User';

// Extendemos la interfaz Request de Express
export interface AuthRequest extends Request {
    user?: UserPayload;
}

const verificarToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(403).json({ message: "Acceso denegado. No hay token." });
    }

    try {
        const verified = jwt.verify(
            token.replace('Bearer ', ''), 
            process.env.JWT_SECRET || 'hipstagram_jwt_secret_2026'
        ) as UserPayload;
        
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ message: "Token no válido" });
    }
};

export default verificarToken;