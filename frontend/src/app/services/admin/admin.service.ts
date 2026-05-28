import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Construye las cabeceras incluyendo el token de seguridad
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  obtenerUsuarios(): Observable<any> {
    // Hace la petición al API Gateway (que lo mandará al user-service)
    return this.http.get(`${this.apiUrl}/users`, { headers: this.getHeaders() });
  }

  // --- NUEVO MÉTODO PARA CAMBIAR ESTADO ---
  cambiarEstadoUsuario(usuarioId: string, nuevoEstado: boolean): Observable<any> {
    const body = { 
      usuario_id: usuarioId, 
      activo: nuevoEstado 
    };
    // Hacemos un PUT a /users/admin/status
    return this.http.put(`${this.apiUrl}/users/admin/status`, body, { headers: this.getHeaders() });
  }

  // --- NUEVO MÉTODO PARA CAMBIAR ROL ---
  cambiarRolUsuario(usuarioId: string, nuevoRol: string): Observable<any> {
    const body = { 
      usuario_id: usuarioId, 
      rol: nuevoRol 
    };
    return this.http.put(`${this.apiUrl}/users/admin/role`, body, { headers: this.getHeaders() });
  }

  // --- NUEVO MÉTODO PARA OBTENER LOGS ---
  // --- OBTENER AUDITORÍA CON FILTROS ---
  obtenerAuditoria(filtros?: any, page: number = 1, limit: number = 10): Observable<any> {
    const params = { ...(filtros || {}), page, limit };
    return this.http.get(`${this.apiUrl}/audit`, {
      headers: this.getHeaders(),
      params
    });
  }
  // --- MÉTODOS DE MODERACIÓN (FILTRO DE PALABRAS) ---
  obtenerPalabras(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/moderation/words`, { headers: this.getHeaders() });
  }

  agregarPalabra(palabra: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/moderation/words`, { palabra }, { headers: this.getHeaders() });
  }

  eliminarPalabra(palabra: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/moderation/words/${palabra}`, { headers: this.getHeaders() });
  }

  // --- MÉTODOS DE MODERACIÓN (PUBLICACIONES) ---
  obtenerPublicacionesModeracion(): Observable<any> {
    // Apuntamos al post-service a través del API Gateway
    return this.http.get(`${this.apiUrl}/posts/admin/moderation`, { headers: this.getHeaders() });
  }

  cambiarEstadoPublicacion(postId: string, nuevoEstado: string): Observable<any> {
    const body = { estado: nuevoEstado };
    return this.http.put(`${this.apiUrl}/posts/admin/moderation/${postId}`, body, { headers: this.getHeaders() });
  }

  obtenerAuditoriaFiltrada(filtros: any): Observable<any> {
  return this.http.get(`${this.apiUrl}/audit`, { 
    headers: this.getHeaders(),
    params: filtros 
  });
}

}