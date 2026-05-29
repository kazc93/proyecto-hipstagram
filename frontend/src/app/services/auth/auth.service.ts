import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Tomamos la URL base desde el environment (http://localhost:8080)
  private apiUrl = environment.apiUrl;

  // Inyectamos el HttpClient para poder hacer peticiones
  constructor(private http: HttpClient) { }

  // Método para hacer login (acepta email o username como identifier)
  login(credenciales: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, credenciales);
  }

  // Método para resetear contraseña sin email (verifica email + username)
  resetearPassword(datos: { email: string; username: string; nuevaPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, datos);
  }

  // NUEVO: Método para registrar un usuario
  registro(usuario: any): Observable<any> {
    // Esto hará un POST a http://localhost:8080/auth/register
    return this.http.post(`${this.apiUrl}/auth/register`, usuario);
  }

  // Verifica si el usuario tiene un token guardado (sesión activa)
  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    // Retorna true si el token existe, false si no existe
    return !!token; 
  }

  // Métodos útiles para manejar el Token en el navegador
  // Guarda el token en el almacenamiento local del navegador
  guardarToken(token: string): void {
    localStorage.setItem('token', token);
  }

  // Recupera el token (lo usaremos más adelante para las peticiones)
  obtenerToken(): string | null {
    return localStorage.getItem('token');
  }

  /** ID del usuario actual desde el payload del JWT (mismo `id` que envía el backend al verificar el token). */
  obtenerUsuarioId(): string | null {
    const token = this.obtenerToken();
    if (!token) return null;
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded)) as { id?: string };
      const raw = payload?.id;
      return raw != null ? String(raw) : null;
    } catch {
      return null;
    }
  }

  // Cierra la sesión eliminando el token y el rol
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('rol'); // <-- NUEVO
  }
}