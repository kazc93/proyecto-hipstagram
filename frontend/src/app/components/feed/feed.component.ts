import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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

  // ── Modo Explorar ──────────────────────────────────────────────────────
  modoExplorar = false;

  // ── Publicar ───────────────────────────────────────────────────────────
  nuevoTexto: string = '';
  archivoSeleccionado: File | null = null;
  vistaPreviaImagen: string | ArrayBuffer | null = null;

  // ── Paginación de comentarios por post ────────────────────────────────
  comentariosExtra: { [postId: string]: any[] } = {};
  comentariosPagina: { [postId: string]: number } = {};
  comentariosTotal: { [postId: string]: number } = {};
  cargandoComentarios: { [postId: string]: boolean } = {};

  @ViewChild('sentinel') sentinel!: ElementRef;
  private observer!: IntersectionObserver;
  private destroy$ = new Subject<void>();

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
        this.ngZone.run(() => this.cargarMas());
      }
    }, { threshold: 0.1 });
    if (this.sentinel) this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.observer) this.observer.disconnect();
  }

  // ── Feed / Explorar ───────────────────────────────────────────────────

  cambiarModo(explorar: boolean) {
    if (this.modoExplorar === explorar) return;
    this.modoExplorar = explorar;
    this.comentariosExtra = {};
    this.comentariosPagina = {};
    this.comentariosTotal = {};
    this.cargarFeed();
  }

  cargarFeed() {
    this.paginaActual = 1;
    this.hayMasPosts = false;
    this.cargandoMas = true;

    const fuente$ = this.modoExplorar
      ? this.postService.obtenerExplorar(1, 15)
      : this.postService.obtenerFeed(1, this.limitPorPagina);

    fuente$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const data = res.posts ?? res.data ?? (Array.isArray(res) ? res : []);
        this.publicaciones = data;
        this.hayMasPosts = !this.modoExplorar && data.length >= this.limitPorPagina;
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
    if (this.cargandoMas || !this.hayMasPosts || this.modoExplorar) return;
    this.cargandoMas = true;
    const siguientePagina = this.paginaActual + 1;
    this.postService.obtenerFeed(siguientePagina, this.limitPorPagina)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const data = res.posts ?? res.data ?? (Array.isArray(res) ? res : []);
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

  // ── Publicar ──────────────────────────────────────────────────────────

  seleccionarImagen(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.archivoSeleccionado = file;
      const reader = new FileReader();
      reader.onload = () => this.ngZone.run(() => {
        this.vistaPreviaImagen = reader.result;
      });
      reader.readAsDataURL(file);
    }
  }

  publicar() {
    if (!this.archivoSeleccionado) {
      alert('Por favor selecciona una imagen');
      return;
    }
    const formData = new FormData();
    formData.append('image', this.archivoSeleccionado);
    formData.append('descripcion', this.nuevoTexto);

    this.postService.crearPublicacion(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.nuevoTexto = '';
          this.archivoSeleccionado = null;
          this.vistaPreviaImagen = null;
          this.cargarFeed();
        },
        error: (err) => console.error('Error al publicar', err)
      });
  }

  // ── Votar / Comentar ──────────────────────────────────────────────────

  votar(postId: string, tipo: number) {
    this.postService.votar(postId, tipo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.cargarFeed(),
        error: () => alert('Ya has votado en esta publicación')
      });
  }

  enviarComentario(postId: string, texto: string) {
    if (!texto.trim()) return;
    this.postService.comentar(postId, texto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.cargarFeed();
          if (this.comentariosExtra[postId]) {
            this.comentariosExtra[postId] = [];
            this.comentariosPagina[postId] = 0;
            this.cargarMasComentarios(postId);
          }
        },
        error: (err) => console.error('Error al comentar', err)
      });
  }

  // ── Paginación de comentarios ─────────────────────────────────────────

  comentariosVisibles(post: any): any[] {
    const base: any[] = post.comentarios ?? [];
    const extra: any[] = this.comentariosExtra[post.id] ?? [];
    const todos = [...base];
    for (const e of extra) {
      const existe = todos.some(b => b.texto === e.texto && b.username === e.username);
      if (!existe) todos.push(e);
    }
    return todos;
  }

  hayMasComentarios(post: any): boolean {
    const total = this.comentariosTotal[post.id];
    if (total === undefined) return (post.comentarios?.length ?? 0) >= 5;
    return this.comentariosVisibles(post).length < total;
  }

  cargarMasComentarios(postId: string) {
    if (this.cargandoComentarios[postId]) return;
    this.cargandoComentarios[postId] = true;
    const paginaSiguiente = (this.comentariosPagina[postId] ?? 0) + 1;

    this.postService.obtenerComentarios(postId, paginaSiguiente, 5)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const nuevos: any[] = res.data ?? [];
          this.comentariosExtra[postId] = [
            ...(this.comentariosExtra[postId] ?? []),
            ...nuevos
          ];
          this.comentariosPagina[postId] = paginaSiguiente;
          this.comentariosTotal[postId] = res.total ?? 0;
          this.cargandoComentarios[postId] = false;
        },
        error: (err) => {
          console.error('Error al cargar comentarios', err);
          this.cargandoComentarios[postId] = false;
        }
      });
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────

  terminoBusqueda: string = '';

  buscar() {
    if (!this.terminoBusqueda.trim()) { this.cargarFeed(); return; }
    this.postService.buscarPosts(this.terminoBusqueda)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.publicaciones = data,
        error: (err) => console.error(err)
      });
  }

  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.cargarFeed();
  }

  // ── Navegación ────────────────────────────────────────────────────────

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
    return String(post.usuario_id).toLowerCase() === String(uid).toLowerCase();
  }

  eliminarPost(postId: string) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    this.postService.eliminarPost(String(postId).trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.cargarFeed(),
        error: (err: HttpErrorResponse) => {
          const body = err.error as { message?: string } | null;
          const msg = body?.message ?? (err.status === 403 ? 'No autorizado.' : `No se pudo eliminar (${err.status}).`);
          alert(msg);
        }
      });
  }

  limpiarHashtags(texto: string): string {
    return texto.replace(/#\S+/g, '').trim();
  }
}
