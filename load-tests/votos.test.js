/**
 * PRUEBA DE CARGA — Votación (POST /interactions/voto)
 *
 * Simula múltiples usuarios votando al mismo tiempo.
 * Crítico porque requiere autenticación + escritura en DB.
 *
 * Nota: usa un token de prueba válido. Si expira, actualizar TOKEN.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '20s', target: 20 },
    { duration: '30s', target: 20 },
    { duration: '10s', target: 0  },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.10'],  // Permite hasta 10% de errores (votos duplicados son rechazados)
  },
};

const BASE_URL = 'https://3.88.254.85.nip.io';

// Token JWT válido — obtenerlo haciendo login manualmente
const TOKEN = __ENV.TOKEN || '';

export default function () {
  if (!TOKEN) {
    console.error('Falta el TOKEN. Corre: k6 run -e TOKEN=<tu_token> votos.test.js');
    return;
  }

  const payload = JSON.stringify({
    publicacion_id: __ENV.POST_ID || '',
    tipo_voto: 1,
  });

  const res = http.post(`${BASE_URL}/interactions/voto`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  });

  // 201 = voto nuevo, 400/409 = ya votó (esperado en prueba de carga)
  const ok = check(res, {
    'voto aceptado o duplicado controlado': (r) => [201, 200, 400, 409].includes(r.status),
    'responde en < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!ok);
  sleep(1);
}
