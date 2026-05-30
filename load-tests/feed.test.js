/**
 * PRUEBA DE CARGA — Feed (GET /posts)
 *
 * Simula usuarios abriendo el feed simultáneamente.
 * Este es el endpoint más crítico: todos lo usan al entrar a la app.
 *
 * Fases:
 *   0-30s  → sube de 0 a 50 usuarios (carga gradual)
 *   30-60s → se mantiene en 50 usuarios (carga sostenida)
 *   60-90s → sube a 100 usuarios (pico de carga)
 *   90-120s→ baja a 0 (enfriamiento)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate    = new Rate('errors');
const feedDuration = new Trend('feed_duration', true);

export let options = {
  stages: [
    { duration: '30s', target: 50  },  // Subida gradual
    { duration: '30s', target: 50  },  // Carga sostenida
    { duration: '30s', target: 100 },  // Pico de carga
    { duration: '30s', target: 0   },  // Enfriamiento
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% de requests < 2 segundos
    http_req_failed:   ['rate<0.05'],   // Menos del 5% de errores
    errors:            ['rate<0.05'],
  },
};

const BASE_URL = 'https://3.88.254.85.nip.io';

export default function () {
  const res = http.get(`${BASE_URL}/posts?page=1&limit=10`);

  const ok = check(res, {
    'status 200':            (r) => r.status === 200,
    'responde en < 2s':      (r) => r.timings.duration < 2000,
    'tiene campo data':      (r) => JSON.parse(r.body).data !== undefined,
  });

  errorRate.add(!ok);
  feedDuration.add(res.timings.duration);

  sleep(1);
}
