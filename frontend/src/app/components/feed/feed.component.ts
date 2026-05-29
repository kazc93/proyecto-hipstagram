import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { PostService } from '../../services/post/post.service';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css'
})
export class FeedComponent implements OnInit, OnDestroy, AfterViewInit {

  publicaciones: any[] = [];
  paginaActual = 1;
  limitPorPagina = 10;
  cargandoMas = false;
  hayMasPosts = true;

  nuevoTexto: string = '';
  archivoSeleccionado: File | null = null;
  vistaPreviaImagen: string | ArrayBuffer | null = null;

  @ViewChild('sentinel') sentinel!: ElementRef;
  private observer!: IntersectionObserver;

  constructor(
    private authService: AuthService,
    private postService: PostService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.cargarFeed();
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.cargandoMas && this.hayMasPosts) {
        // NgZone.run() es necesario porque IntersectionObserver corre fuera
        // de la zona de Angular y sin esto se genera NG0900
        this.ngZone.run(() => this.cargarMas());
      }
    }, { threshold: 0.1 });
    if (this.sentinel) this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
  }

  cargarFeed() {
    this.paginaActual = 1;
    this.hayMasPosts = false;   // Bloquea cargarMas() mientras recargamos
    this.cargandoMas = true;    // Evita que el observer dispare durante la carga inicial
    this.postService.obtenerFeed(1, this.limitPorPagina).subscribe({
      next: (res) => {
        const data = res.posts ?? res;
        this.publicaciones = data;
        this.hayMasPosts = data.length >= this.limitPorPagina;
        this.cargandoMas = false;
      },
      error: (err) => {
        console.error('Error al cargar el feed', err);
        this.cargandoMas = false;
        this.hayMasPosts = false;
      }
    });
  }

  cargarMas() {
    if (this.cargandoMas || !this.hayMasPosts) return;
    this.cargandoMas = true;
    const siguientePagina = this.paginaActual + 1;
    this.postService.obtenerFeed(siguientePagina, this.limitPorPagina).subscribe({
      next: (res) => {
        const data = res.posts ?? res;
        if (data.length === 0) {
          this.hayMasPosts = false;
        } else {
          this.publicaciones = [...this.publicaciones, ...data];
          this.paginaActual = siguientePagina;
          if (data.length < this.limitPorPagina) this.hayMasPosts = false;
        }
        this.cargandoMas = false;
      },
      error: (err) => {
        console.error('Error al cargar más posts', err);
        this.cargandoMas = false;
      }
    });
  }

  seleccionarImagen(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.archivoSeleccionado = file;
      // Crear vista previa para el usuario
      const reader = new FileReader();
      reader.onload = e => this.vistaPreviaImagen = reader.result;
      reader.readAsDataURL(file);
    }
  }

  publicar() {
    if (!this.archivoSeleccionado) {
      alert('Por favor selecciona una imagen');
      return;
    }

    // Usamos FormData porque estamos enviando un archivo físico
    const formData = new FormData();
    formData.append('image', this.archivoSeleccionado);
    formData.append('descripcion', this.nuevoTexto);

    this.postService.crearPublicacion(formData).subscribe({
      next: (respuesta) => {
        // Limpiamos el formulario
        this.nuevoTexto = '';
        this.archivoSeleccionado = null;
        this.vistaPreviaImagen = null;
        // Recargamos el feed para ver la nueva foto
        this.cargarFeed();
      },
      error: (err) => console.error('Error al publicar', err)
    });
  }

 

  votar(postId: string, tipo: number) {
  this.postService.votar(postId, tipo).subscribe({
    next: () => this.cargarFeed(), // Recargamos para ver el nuevo conteo
    error: (err) => alert('Ya has votado en esta publicación')
  });
}
// 3. Agrega la función para enviar el comentario
  enviarComentario(postId: string, texto: string) {
    if (!texto.trim()) return; // Evita enviar comentarios vacíos
    
    this.postService.comentar(postId, texto).subscribe({
      next: () => {
        console.log('Comentario publicado');
        this.cargarFeed(); // Recarga para ver el comentario si lo muestras en el feed
      },
      error: (err) => console.error('Error al comentar', err)
    });
  }

  terminoBusqueda: string = '';

buscar() {
  if (!this.terminoBusqueda.trim()) {
    this.cargarFeed();
    return;
  }
  this.postService.buscarPosts(this.terminoBusqueda).subscribe({
    next: (data) => this.publicaciones = data,
    error: (err) => console.error(err)
  });
}

// Función para limpiar la búsqueda y recargar el feed completo
  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.cargarFeed();
  }

 irAPerfil() {
    const uid = this.authService.obtenerUsuarioId();
    if (uid) this.router.navigate(['/profile', uid]);
  }

 cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  esMiPublicacion(post: any): boolean {
    const uid = this.authService.obtenerUsuarioId();
    if (!uid || post?.usuario_id == null) return false;
    return (
      String(post.usuario_id).toLowerCase() === String(uid).toLowerCase()
    );
  }

  eliminarPost(postId: string) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    const id = String(postId).trim();
    this.postService.eliminarPost(id).subscribe({
      next: () => this.cargarFeed(),
      error: (err: HttpErrorResponse) => {
        const body = err.error as { message?: string } | null;
        const msg =
          body && typeof body === 'object' && body.message
            ? body.message
            : err.status === 403
              ? 'No autorizado o la publicación no existe.'
              : `No se pudo eliminar (${err.status}).`;
        alert(msg);
      }
    });
  }

  limpiarHashtags(texto: string): string {
    return texto.replace(/#\S+/g, '').trim();
  }

}