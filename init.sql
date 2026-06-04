-- 1. Asegurar la extensión en el esquema public
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- 2. Tabla de Usuarios usando la ruta completa de la función
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(10) CHECK (rol IN ('ADMIN', 'USER')) DEFAULT 'USER',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    refresh_token VARCHAR(500)
);


-- Repite el mismo formato para las demás tablas:
-- DEFAULT public.uuid_generate_v4()

-- 3. Tabla de Publicaciones (Fotos)
CREATE TABLE publicaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    url_imagen TEXT NOT NULL, -- Aquí guardarás el enlace de AWS S3
    descripcion VARCHAR(128), -- Restricción de 128 caracteres según el PDF
    fecha_publicacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Hashtags (Para facilitar la búsqueda)
CREATE TABLE hashtags (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

-- 5. Relación Muchos a Muchos: Publicaciones <-> Hashtags
CREATE TABLE publicaciones_hashtags (
    publicacion_id UUID REFERENCES publicaciones(id) ON DELETE CASCADE,
    hashtag_id INT REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (publicacion_id, hashtag_id)
);

-- 6. Tabla de Votos (Likes / Dislikes)
CREATE TABLE votos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    publicacion_id UUID REFERENCES publicaciones(id) ON DELETE CASCADE,
    tipo_voto INT CHECK (tipo_voto IN (1, -1)), -- 1 para Like, -1 para Dislike
    fecha_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, publicacion_id) -- Un usuario solo vota una vez por foto
);

-- 7. Tabla de Comentarios
CREATE TABLE comentarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    publicacion_id UUID REFERENCES publicaciones(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    fecha_comentario TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla de Auditoría (Solo accesible por ADMIN según el proyecto)
CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    detalles TEXT,
    ip_origen VARCHAR(45),
    fecha_accion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    request_id VARCHAR(100),
    actor_role VARCHAR(10),
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    result VARCHAR(20) DEFAULT 'EXITO'
);


-- 9. Índices de auditoría para búsquedas eficientes por fecha, usuario y acción
CREATE INDEX idx_auditoria_fecha    ON auditoria (fecha_accion DESC);
CREATE INDEX idx_auditoria_usuario  ON auditoria (usuario_id);
CREATE INDEX idx_auditoria_accion   ON auditoria (accion);
CREATE INDEX idx_auditoria_result   ON auditoria (result);

--Añadidos
-- 1. Permitir que el ADMIN desactive usuarios
ALTER TABLE usuarios ADD COLUMN activo BOOLEAN DEFAULT TRUE;

-- 2. Permitir que moderación controle la visibilidad de los posts
ALTER TABLE publicaciones ADD COLUMN estado_moderacion VARCHAR(20) DEFAULT 'APROBADO'
CHECK (estado_moderacion IN ('PENDIENTE', 'APROBADO', 'BLOQUEADO'));

-- ─────────────────────────────────────────────────────────────
-- Usuario administrador por defecto (password: admin123)
-- Hash generado con bcrypt, 10 rondas de sal
-- ─────────────────────────────────────────────────────────────
INSERT INTO usuarios (username, email, password_hash, rol, activo)
VALUES (
    'admin',
    'admin@hipstagram.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'ADMIN',
    true
) ON CONFLICT (username) DO NOTHING;
