import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  // Login — acepta email o nombre de usuario
  credenciales = {
    identifier: '',
    password: ''
  };
  mensajeError: string = '';

  // Reset de contraseña
  mostrarReset: boolean = false;
  resetCredenciales = { email: '', username: '', nuevaPassword: '' };
  mensajeReset: string = '';
  errorReset: string = '';
  resetando: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  iniciarSesion() {
    this.mensajeError = '';
    this.authService.login(this.credenciales).subscribe({
      next: (respuesta) => {
        this.authService.guardarToken(respuesta.token);
        const rolUsuario = respuesta.user?.rol || 'USER';
        localStorage.setItem('rol', rolUsuario);
        if (rolUsuario === 'ADMIN') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/feed']);
        }
      },
      error: (err) => {
        if (err.status === 403) {
          this.mensajeError = 'Tu cuenta ha sido suspendida. Comunícate con el administrador.';
        } else {
          this.mensajeError = 'Credenciales incorrectas. Inténtalo de nuevo.';
        }
        console.error(err);
      }
    });
  }

  toggleReset() {
    this.mostrarReset = !this.mostrarReset;
    this.mensajeReset = '';
    this.errorReset = '';
    this.resetCredenciales = { email: '', username: '', nuevaPassword: '' };
  }

  resetearPassword() {
    this.mensajeReset = '';
    this.errorReset = '';
    this.resetando = true;
    this.authService.resetearPassword(this.resetCredenciales).subscribe({
      next: () => {
        this.mensajeReset = '¡Contraseña actualizada! Ya puedes iniciar sesión.';
        this.resetando = false;
        this.resetCredenciales = { email: '', username: '', nuevaPassword: '' };
        setTimeout(() => { this.mostrarReset = false; this.mensajeReset = ''; }, 3000);
      },
      error: (err) => {
        this.errorReset = err.status === 404
          ? 'No encontramos ningún usuario con ese correo y nombre de usuario.'
          : 'Ocurrió un error. Inténtalo de nuevo.';
        this.resetando = false;
        console.error(err);
      }
    });
  }
}
