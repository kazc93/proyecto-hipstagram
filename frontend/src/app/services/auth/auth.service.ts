import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Envía credenciales al backend y obtiene los tokens de sesión
  login(credenciales: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, credenciales);
  }

  // Solicita el cambio de contraseña verificando email y username
  resetearPassword(datos: { email: string; username: string; nuevaPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, datos);
  }

  // Registra un nuevo usuario en la plataforma
  registro(usuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, usuario);
  }

  // Verifica si existe un token activo en el almacenamiento local
  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    return !!token;
  }

  // Persiste el token JWT en el almacenamiento local del navegador
  guardarToken(token: string): void {
    localStorage.setItem('token', token);
  }

  // Recupera el token JWT del almacenamiento local
  obtenerToken(): string | null {
    return localStorage.getItem('token');
  }

  // Decodifica el payload del JWT para extraer el ID del usuario autenticado
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

  // Elimina el token y el rol del almacenamiento local cerrando la sesión
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
  }
}
