import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { IUser } from '../interfaces/User';
import { sendToAudit } from '../services/auditHelper';

export const register = async (req: Request, res: Response) => {
    const { username, email, password, rol } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            "INSERT INTO usuarios (username, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, username, email, rol",
            [username, email, hashedPassword, rol || 'USER']
        );

        const createdUser = newUser.rows[0];

        await sendToAudit(
            createdUser.id,
            'REGISTRO_USUARIO',
            `Nuevo usuario registrado: ${username}`,
            req.headers['x-correlation-id'] as string,
            { actor_role: 'USER', entity_type: 'USUARIO', entity_id: createdUser.id, result: 'EXITO' }
        );

        res.status(201).json(createdUser);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            await sendToAudit(null, 'LOGIN_FALLIDO', `Intento fallido para email: ${email}`, req.headers['x-correlation-id'] as string,
                { actor_role: 'DESCONOCIDO', entity_type: 'SESION', result: 'FALLO' });
            return res.status(401).json({ message: "Credenciales incorrectas" });
        }

        const user: IUser = result.rows[0];

        if (!user.activo) {
            return res.status(403).json({ message: "Tu cuenta ha sido deshabilitada. Contacta al administrador." });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            await sendToAudit(user.id!.toString(), 'LOGIN_FALLIDO', `Contraseña incorrecta para: ${user.username}`, req.headers['x-correlation-id'] as string,
                { actor_role: user.rol, entity_type: 'SESION', entity_id: user.id!.toString(), result: 'FALLO' });
            return res.status(401).json({ message: "Credenciales incorrectas" });
        }

        await sendToAudit(user.id!.toString(), 'LOGIN_EXITOSO', `Sesión iniciada por ${user.username}`, req.headers['x-correlation-id'] as string,
            { actor_role: user.rol, entity_type: 'SESION', entity_id: user.id!.toString(), result: 'EXITO' });

        // --- LÓGICA DE TOKENS (ACTUALIZADA) ---
        // 1. Access Token (Corto: 15 minutos para mayor seguridad)
        const token = jwt.sign(
            { id: user.id, rol: user.rol },
            process.env.JWT_SECRET || 'hipstagram_jwt_secret_2026',
            { expiresIn: '15m' }
        );

        // 2. Refresh Token (Largo: 7 días para no molestar al usuario)
        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET || 'super_secret_refresh',
            { expiresIn: '7d' }
        );

        // 3. Guardamos el Refresh Token en la base de datos
        await pool.query(
            "UPDATE usuarios SET refresh_token = $1 WHERE id = $2",
            [refreshToken, user.id]
        );

        // 4. Enviamos ambos al frontend
        res.json({ 
            token, // El Access Token sigue siendo el mismo de antes
            refreshToken, // Nuevo campo para el refresh token
            user: { username: user.username, rol: user.rol } 
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// --- NUEVO CONTROLADOR: REFRESH TOKEN ---
export const refresh = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token requerido" });
    }

    try {
        // 1. Validar matemáticamente si el refresh token no ha caducado
        const payload: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'super_secret_refresh');

        // 2. Verificar que este token coincida con el guardado en la base de datos
        const result = await pool.query("SELECT refresh_token, rol FROM usuarios WHERE id = $1", [payload.id]);

        if (result.rows.length === 0 || result.rows[0].refresh_token !== refreshToken) {
            return res.status(403).json({ message: "Refresh token inválido o revocado" });
        }

        const usuario = result.rows[0];

        // 3. Generar un NUEVO Access Token fresquito por otros 15 minutos
        const newAccessToken = jwt.sign(
            { id: payload.id, rol: usuario.rol },
            process.env.JWT_SECRET || 'hipstagram_jwt_secret_2026',
            { expiresIn: '15m' }
        );

        // 4. Entregarlo al frontend
        res.json({ token: newAccessToken });
    } catch (error) {
        // Si el refresh token caducó, obligamos al usuario a hacer login manual
        res.status(403).json({ message: "Refresh token expirado o inválido. Inicie sesión nuevamente." });
    }
};