import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FeedComponent } from './feed.component';

// IntersectionObserver no existe en jsdom — debe ser una clase (constructor)
class MockIntersectionObserver {
  observe    = vi.fn();
  unobserve  = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

describe('FeedComponent', () => {
  let component: FeedComponent;
  let fixture: ComponentFixture<FeedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('inicia con la lista de publicaciones vacía', () => {
    expect(component.publicaciones).toEqual([]);
  });

  it('inicia en página 1', () => {
    expect(component.paginaActual).toBe(1);
  });
});
