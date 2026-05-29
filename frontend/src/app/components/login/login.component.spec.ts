import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  const authServiceMock = {
    login:            vi.fn(),
    guardarToken:     vi.fn(),
    resetearPassword: vi.fn(),
  };

  const routerMock = {
    navigate: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [LoginComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router,      useValue: routerMock      },
      ]
    })
    // RouterLink requiere el router completo en jsdom; como probamos lógica
    // (no template), reemplazamos el HTML para evitar la inicialización del router
    .overrideComponent(LoginComponent, {
      set: { imports: [], template: '<div></div>' }
    })
    .compileComponents();

    fixture   = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Creación ──────────────────────────────────────────────────────────────
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('usa identifier (no email) como campo de acceso', () => {
    expect(component.credenciales.identifier).toBeDefined();
    expect((component.credenciales as any).email).toBeUndefined();
  });

  // ── Login exitoso ─────────────────────────────────────────────────────────
  it('redirige al feed cuando el rol es USER', () => {
    authServiceMock.login.mockReturnValue(of({ token: 'tok', user: { rol: 'USER' } }));

    component.credenciales = { identifier: 'testuser', password: '123' };
    component.iniciarSesion();

    expect(authServiceMock.guardarToken).toHaveBeenCalledWith('tok');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/feed']);
  });

  it('redirige a /admin cuando el rol es ADMIN', () => {
    authServiceMock.login.mockReturnValue(of({ token: 'tok', user: { rol: 'ADMIN' } }));

    component.credenciales = { identifier: 'admin@test.com', password: '123' };
    component.iniciarSesion();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/admin']);
  });

  // ── Login fallido ─────────────────────────────────────────────────────────
  it('muestra mensaje de cuenta suspendida en error 403', () => {
    authServiceMock.login.mockReturnValue(throwError(() => ({ status: 403 })));

    component.iniciarSesion();

    expect(component.mensajeError).toContain('suspendida');
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('muestra mensaje de credenciales incorrectas en error 401', () => {
    authServiceMock.login.mockReturnValue(throwError(() => ({ status: 401 })));

    component.iniciarSesion();

    expect(component.mensajeError).toContain('incorrectas');
  });

  // ── Reset de contraseña ───────────────────────────────────────────────────
  it('toggleReset muestra el panel de reset', () => {
    expect(component.mostrarReset).toBe(false);
    component.toggleReset();
    expect(component.mostrarReset).toBe(true);
  });

  it('toggleReset oculta el panel de reset al llamarlo de nuevo', () => {
    component.toggleReset();
    component.toggleReset();
    expect(component.mostrarReset).toBe(false);
  });

  it('resetearPassword muestra mensaje de éxito y limpia el formulario', () => {
    authServiceMock.resetearPassword.mockReturnValue(of({ message: 'ok' }));
    component.resetCredenciales = { email: 'x@x.com', username: 'user', nuevaPassword: 'nueva123' };

    component.resetearPassword();

    expect(component.mensajeReset).toContain('actualizada');
    expect(component.resetCredenciales.email).toBe('');
  });

  it('resetearPassword muestra error 404 si el usuario no existe', () => {
    authServiceMock.resetearPassword.mockReturnValue(throwError(() => ({ status: 404 })));

    component.resetearPassword();

    expect(component.errorReset).toContain('No encontramos');
    expect(component.resetando).toBe(false);
  });

  it('resetearPassword muestra error genérico en fallo de servidor', () => {
    authServiceMock.resetearPassword.mockReturnValue(throwError(() => ({ status: 500 })));

    component.resetearPassword();

    expect(component.errorReset).toContain('error');
    expect(component.resetando).toBe(false);
  });
});
