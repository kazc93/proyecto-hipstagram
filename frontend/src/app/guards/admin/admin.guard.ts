import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

// Protege la ruta /admin verificando que el usuario tenga sesión activa y rol ADMIN
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isLoggedIn = authService.isAuthenticated();
  const rol = localStorage.getItem('rol');

  if (isLoggedIn && rol === 'ADMIN') {
    return true;
  }

  console.warn('Acceso denegado: Se requieren privilegios de Administrador');
  router.navigate(['/feed']);
  return false;
};
