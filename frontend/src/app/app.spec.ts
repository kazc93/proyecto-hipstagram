import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    })
    // RouterOutlet no se puede inicializar en jsdom sin router completo;
    // reemplazamos el template para el test
    .overrideComponent(AppComponent, { set: { template: '<p>test</p>' } })
    .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('tiene el título frontend', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toBe('frontend');
  });
});
