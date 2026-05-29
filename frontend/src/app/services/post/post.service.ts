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

  // 1. Obtener todas las publicaciones (Normalmente es el GET al root)
  obtenerFeed(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/posts?page=${page}&limit=${limit}`);
  }

  // 2. Subir una nueva (Debe coincidir con Postman)
  crearPublicacion(formData: FormData): Observable<any> {
    // Agregamos /upload al final de la ruta
    return this.http.post(`${this.apiUrl}/posts/upload`, formData);
  }

  // 3. Dar Like a una publicación
  darLike(postId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/interactions/${postId}/like`, {});
  }
  //4. Votar Like/Dislike
  votar(publicacionId: string, tipo: number): Observable<any> {
  return this.http.post(`${this.apiUrl}/interactions/voto`, { 
    publicacion_id: publicacionId, 
    tipo_voto: tipo 
  });
  } 
  //5.Comentar Publicación
  comentar(publicacionId: string, texto: string): Observable<any> {
    // CAMBIAR '/posts/comentario' a '/interactions/comentar'
    return this.http.post(`${this.apiUrl}/interactions/comentar`, { 
      publicacion_id: publicacionId, 
      texto 
    });
  }
  //BuscarPost
  // Función para buscar apuntando a tu search-service
  buscarPosts(termino: string): Observable<any> {
    // encodeURIComponent convierte el "#" en "%23" para que no se pierda en el viaje
    const terminoSeguro = encodeURIComponent(termino); 
    
    return this.http.get(`${this.apiUrl}/search/posts?q=${terminoSeguro}`);
  }

  eliminarPost(postId: string): Observable<any> {
    const id = encodeURIComponent(String(postId).trim());
    return this.http.delete(`${this.apiUrl}/posts/delete/${id}`);
  }

  obtenerExplorar(page: number = 1, limit: number = 15): Observable<any> {
    return this.http.get(`${this.apiUrl}/posts/explore?page=${page}&limit=${limit}`);
  }

  obtenerComentarios(postId: string, page: number = 1, limit: number = 5): Observable<any> {
    return this.http.get(`${this.apiUrl}/posts/${postId}/comments?page=${page}&limit=${limit}`);
  }

}