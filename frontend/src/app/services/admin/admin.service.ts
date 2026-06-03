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

  // Construye los headers HTTP con el token de autorización
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Obtiene la lista completa de usuarios registrados
  obtenerUsuarios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/users`, { headers: this.getHeaders() });
  }

  // Activa o desactiva la cuenta de un usuario
  cambiarEstadoUsuario(usuarioId: string, nuevoEstado: boolean): Observable<any> {
    const body = { usuario_id: usuarioId, activo: nuevoEstado };
    return this.http.put(`${this.apiUrl}/users/admin/status`, body, { headers: this.getHeaders() });
  }

  // Cambia el rol de un usuario entre USER y ADMIN
  cambiarRolUsuario(usuarioId: string, nuevoRol: string): Observable<any> {
    const body = { usuario_id: usuarioId, rol: nuevoRol };
    return this.http.put(`${this.apiUrl}/users/admin/role`, body, { headers: this.getHeaders() });
  }

  // Consulta el historial de auditoría con filtros y paginación
  obtenerAuditoria(filtros?: any, page: number = 1, limit: number = 10): Observable<any> {
    const params = { ...(filtros || {}), page, limit };
    return this.http.get(`${this.apiUrl}/audit`, { headers: this.getHeaders(), params });
  }

  // Obtiene la lista de palabras prohibidas del moderation-service
  obtenerPalabras(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/moderation/words`, { headers: this.getHeaders() });
  }

  // Agrega una nueva palabra a la lista de palabras prohibidas
  agregarPalabra(palabra: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/moderation/words`, { palabra }, { headers: this.getHeaders() });
  }

  // Elimina una palabra de la lista de palabras prohibidas
  eliminarPalabra(palabra: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/moderation/words/${palabra}`, { headers: this.getHeaders() });
  }

  // Obtiene todas las publicaciones para el panel de moderación
  obtenerPublicacionesModeracion(): Observable<any> {
    return this.http.get(`${this.apiUrl}/posts/admin/moderation`, { headers: this.getHeaders() });
  }

  // Cambia el estado de moderación de una publicación a APROBADO o BLOQUEADO
  cambiarEstadoPublicacion(postId: string, nuevoEstado: string): Observable<any> {
    const body = { estado: nuevoEstado };
    return this.http.put(`${this.apiUrl}/posts/admin/moderation/${postId}`, body, { headers: this.getHeaders() });
  }

  // Consulta la auditoría con filtros dinámicos
  obtenerAuditoriaFiltrada(filtros: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/audit`, { headers: this.getHeaders(), params: filtros });
  }

  // Elimina definitivamente una publicación bloqueada
  eliminarPublicacion(postId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/posts/admin/moderation/${postId}`, { headers: this.getHeaders() });
  }
}
