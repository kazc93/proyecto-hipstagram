import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extendemos la interfaz Request de Express para que acepte nuestro usuario
export interface AuthRequest extends Request {
    user?: any;
}

const verificarToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    // El token suele venir en el header como "Bearer [token]"
    const token = req.header('Authorization')?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado: No se proporcionó un token' });
    }

    try {
        // Verificamos el token con la misma clave secreta que usas para firmarlo
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'hipstagram_jwt_secret_2026');
        req.user = verified;
        next(); // El token es válido, lo dejamos pasar a la ruta
    } catch (err) {
        res.status(401).json({ error: 'Token no válido o expirado' });
    }
};

export default verificarToken;