/**
 * PRUEBA DE CARGA — Búsqueda (GET /search/posts?q=)
 *
 * La búsqueda es la operación más pesada en base de datos:
 * usa ILIKE que hace un full scan de publicaciones y comentarios.
 * Se prueba con términos variados para simular uso real.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate      = new Rate('errors');
const searchDuration = new Trend('search_duration', true);

export let options = {
  stages: [
    { duration: '20s', target: 30 },
    { duration: '40s', target: 30 },
    { duration: '20s', target: 0  },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // Búsqueda puede ser más lenta
    http_req_failed:   ['rate<0.05'],
  },
};

const BASE_URL = 'https://3.88.254.85.nip.io';

// Términos de búsqueda variados para simular uso real
const terminos = ['foto', 'viaje', 'playa', '#naturaleza', 'amigo', 'dia', 'noche'];

export default function () {
  const termino = terminos[Math.floor(Math.random() * terminos.length)];
  const url = `${BASE_URL}/search/posts?q=${encodeURIComponent(termino)}`;

  const res = http.get(url);

  const ok = check(res, {
    'status 200':        (r) => r.status === 200,
    'responde en < 3s':  (r) => r.timings.duration < 3000,
    'respuesta es array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  errorRate.add(!ok);
  searchDuration.add(res.timings.duration);

  sleep(1);
}
