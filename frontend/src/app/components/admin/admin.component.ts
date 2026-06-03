import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { AdminService } from '../../services/admin/admin.service'; 
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  
  vistaActual: 'usuarios' | 'auditoria' | 'moderacion' = 'usuarios';
  
  // Arreglo para guardar los usuarios que nos manda el backend
  usuarios: any[] = []; 
  logsAuditoria: any[] = [];
  paginaAuditoria = 1;
  totalPaginasAuditoria = 1;
  totalLogsAuditoria = 0;
  limitAuditoria = 10;

  // --- VARIABLES DE MODERACIÓN ---
  subVistaModeracion: 'posts' | 'palabras' = 'posts';
  palabrasProhibidas: string[] = []; // Ya no tiene datos quemados
  nuevaPalabra: string = ''; // Para el input del formulario
  publicacionesModeracion: any[] = []; // Aquí guardarda los posts reportados


  constructor(
    private authService: AuthService, 
    private adminService: AdminService, // <-- Lo inyectamos aquí
    private router: Router
  ) {}

  // Esto se ejecuta automáticamente al abrir el panel
  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.adminService.obtenerUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
        console.log("Usuarios cargados:", this.usuarios); // <-- Un log para confirmar
      },
      error: (err) => console.error('Error al cargar usuarios:', err)
    });
  }

  alternarEstado(usuario: any) {
    // Invertimos el estado actual (si es true pasa a false, y viceversa)
    const nuevoEstado = !usuario.activo; 

    //Preguntar al admin si está seguro
    const confirmacion = confirm(`¿Estás seguro de que deseas ${nuevoEstado ? 'ACTIVAR' : 'SUSPENDER'} a ${usuario.username}?`);
    
    if (confirmacion) {
      this.adminService.cambiarEstadoUsuario(usuario.id, nuevoEstado).subscribe({
        next: (res) => {
          // Si el backend responde con éxito, actualizamos el estado visualmente en la tabla
          usuario.activo = nuevoEstado;
          console.log("Éxito:", res.message);
        },
        error: (err) => {
          console.error('Error al cambiar el estado del usuario:', err);
          alert('Hubo un error al intentar cambiar el estado.');
        }
      });
    }
  }

  cambiarRol(usuario: any) {
    // Si es ADMIN lo bajamos a USER, si es USER lo subimos a ADMIN
    const nuevoRol = usuario.rol === 'ADMIN' ? 'USER' : 'ADMIN'; 
    const accion = nuevoRol === 'ADMIN' ? 'otorgar privilegios de ADMIN' : 'quitar privilegios de ADMIN';

    const confirmacion = confirm(`¿Estás seguro de que deseas ${accion} a ${usuario.username}?`);
    
    if (confirmacion) {
      this.adminService.cambiarRolUsuario(usuario.id, nuevoRol).subscribe({
        next: (res) => {
          // Actualizamos la vista
          usuario.rol = nuevoRol;
          console.log("Éxito:", res.message);
        },
        error: (err) => {
          console.error('Error al cambiar el rol del usuario:', err);
          alert('Hubo un error al intentar cambiar el rol.');
        }
      });
    }
  }

  cargarAuditoria(page: number = 1) {
    this.paginaAuditoria = page;
    this.adminService.obtenerAuditoria(this.filtrosAudit, page, this.limitAuditoria).subscribe({
      next: (res) => {
        this.logsAuditoria = res.data;
        this.totalLogsAuditoria = res.total;
        this.totalPaginasAuditoria = res.totalPages;
      },
      error: (err) => console.error('Error al cargar la auditoría:', err)
    });
  }

  get paginasArray(): number[] {
    return Array.from({ length: this.totalPaginasAuditoria }, (_, i) => i + 1);
  }

  cargarPalabras() {
    this.adminService.obtenerPalabras().subscribe({
      next: (data) => this.palabrasProhibidas = data,
      error: (err) => console.error('Error al cargar palabras:', err)
    });
  }

  agregarNuevaPalabra() {
    if (!this.nuevaPalabra.trim()) return; // No agregar si está vacío

    this.adminService.agregarPalabra(this.nuevaPalabra).subscribe({
      next: (res) => {
        this.palabrasProhibidas = res.palabras; // El backend nos devuelve la lista actualizada
        this.nuevaPalabra = ''; // Limpiamos el input
      },
      error: (err) => console.error('Error al agregar palabra:', err)
    });
  }

  quitarPalabra(palabra: string) {
    this.adminService.eliminarPalabra(palabra).subscribe({
      next: (res) => this.palabrasProhibidas = res.palabras,
      error: (err) => console.error('Error al eliminar palabra:', err)
    });
  }

  cargarPublicacionesModeracion() {
    this.adminService.obtenerPublicacionesModeracion().subscribe({
      next: (data) => this.publicacionesModeracion = data,
      error: (err) => console.error('Error al cargar posts para moderación:', err)
    });
  }

  cambiarEstadoPost(post: any, nuevoEstado: 'APROBADO' | 'BLOQUEADO') {
    const accion = nuevoEstado === 'APROBADO' ? 'APROBAR' : 'BLOQUEAR';
    
    if (confirm(`¿Estás seguro de que deseas ${accion} esta publicación?`)) {
      this.adminService.cambiarEstadoPublicacion(post.id, nuevoEstado).subscribe({
        next: (res) => {
          post.estado_moderacion = nuevoEstado; // Actualiza la tabla visualmente
          console.log(res.message);
        },
        error: (err) => {
          console.error('Error al cambiar estado del post:', err);
          alert('Hubo un error al aplicar la moderación.');
        }
      });
    }
  }

  eliminarPostDefinitivo(post: any) {
    if (confirm(`¿Eliminar definitivamente esta publicación? Esta acción no se puede deshacer.`)) {
      this.adminService.eliminarPublicacion(post.id).subscribe({
        next: () => {
          this.publicacionesModeracion = this.publicacionesModeracion.filter(p => p.id !== post.id);
        },
        error: (err) => {
          console.error('Error al eliminar post:', err);
          alert('Hubo un error al eliminar la publicación.');
        }
      });
    }
  }

  //filtrosAudit = { usuario_id: '', accion: '', fecha: '' };

  aplicarFiltros() {
  this.adminService.obtenerAuditoriaFiltrada(this.filtrosAudit).subscribe(data => {
    this.logsAuditoria = data;
  });
  }

  cambiarVista(vista: 'usuarios' | 'auditoria' | 'moderacion') {
    this.vistaActual = vista;
    if (vista === 'auditoria') this.cargarAuditoria();
    if (vista === 'moderacion') {
      this.cargarPalabras();
      this.cargarPublicacionesModeracion(); // <-- Cargamos los posts
    }
  }
  
  // --- VARIABLES PARA FILTROS DE AUDITORÍA ---
  filtrosAudit = {
    usuario_id: '',
    accion: '',
    fecha: ''
  };

  aplicarFiltrosAuditoria() {
    this.cargarAuditoria(1);
  }

  limpiarFiltrosAuditoria() {
    this.filtrosAudit = { usuario_id: '', accion: '', fecha: '' };
    this.cargarAuditoria(1);
  }

  irAlFeed() {
    this.router.navigate(['/feed']);
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}