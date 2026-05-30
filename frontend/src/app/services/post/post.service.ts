import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Obtiene el feed paginado de publicaciones aprobadas
  obtenerFeed(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/posts?page=${page}&limit=${limit}`);
  }

  // Envía una nueva publicación con imagen y descripción
  crearPublicacion(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/posts/upload`, formData);
  }

  // Registra un like en una publicación (compatibilidad legacy)
  darLike(postId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/interactions/${postId}/like`, {});
  }

  // Registra un voto positivo (+1) o negativo (-1) en una publicación
  votar(publicacionId: string, tipo: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/interactions/voto`, {
      publicacion_id: publicacionId,
      tipo_voto: tipo
    });
  }

  // Publica un comentario en una publicación
  comentar(publicacionId: string, texto: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/interactions/comentar`, {
      publicacion_id: publicacionId,
      texto
    });
  }

  // Busca publicaciones por texto o hashtag codificando el término para la URL
  buscarPosts(termino: string): Observable<any> {
    const terminoSeguro = encodeURIComponent(termino);
    return this.http.get(`${this.apiUrl}/search/posts?q=${terminoSeguro}`);
  }

  // Elimina una publicación del usuario autenticado
  eliminarPost(postId: string): Observable<any> {
    const id = encodeURIComponent(String(postId).trim());
    return this.http.delete(`${this.apiUrl}/posts/delete/${id}`);
  }

  // Obtiene el feed de exploración ordenado por popularidad
  obtenerExplorar(page: number = 1, limit: number = 15): Observable<any> {
    return this.http.get(`${this.apiUrl}/posts/explore?page=${page}&limit=${limit}`);
  }

  // Obtiene los comentarios paginados de una publicación
  obtenerComentarios(postId: string, page: number = 1, limit: number = 5): Observable<any> {
    return this.http.get(`${this.apiUrl}/posts/${postId}/comments?page=${page}&limit=${limit}`);
  }
}
